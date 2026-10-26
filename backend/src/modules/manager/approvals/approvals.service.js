// Manager Approvals Service (M8): list, detail, and the money decision (one transaction)
const mongoose = require('mongoose');
const {
  ApprovalRequest, Reservation, Payment, CancellationSettlement, Shift, Staff, Guest, Room,
} = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { toEgp, toPiastres } = require('../../../utils/money');
const { sanitizeText } = require('../../../utils/arabic');
const { runInTransaction } = require('../../../utils/transaction');
const { audit } = require('../../audit/audit.service');
const { AUDIT } = require('../../audit/audit.actions');
const { notifyStaff } = require('../../notifications/notify');
const { netPaid, cancelReservationInTx } = require('../../reservations/reservation.cancel');
const { toApprovalDto } = require('./approvals.dto');

const T = mongoose.trusted;
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const TYPES = ['REFUND', 'DISCOUNT', 'CANCELLATION', 'UPGRADE', 'PRICE_OVERRIDE'];
const MONEY_TYPES = ['CANCELLATION', 'REFUND'];
const idOrNull = (v) => (v ? String(v) : null);

// One batched lookup of guest name / room number for a page of approvals
async function loadReservationSummaries(reservationIds) {
  const out = new Map();
  const ids = [...new Set(reservationIds.filter(Boolean).map(String))];
  if (!ids.length) return out;

  const reservations = await Reservation.find({ _id: T({ $in: ids }) })
    .select('guest_id room_id check_in_at check_out_at status')
    .lean();
  const guestIds = [...new Set(reservations.map((r) => String(r.guest_id)))];
  const roomIds = [...new Set(reservations.map((r) => String(r.room_id)))];
  const [guests, rooms] = await Promise.all([
    Guest.find({ _id: T({ $in: guestIds }) }).select('name').lean(),
    Room.find({ _id: T({ $in: roomIds }) }).select('room_number').lean(),
  ]);
  const gMap = new Map(guests.map((g) => [String(g._id), g.name]));
  const rMap = new Map(rooms.map((r) => [String(r._id), r.room_number]));

  for (const r of reservations) {
    out.set(String(r._id), {
      guest_name: gMap.get(String(r.guest_id)) || null,
      room_number: rMap.get(String(r.room_id)) || null,
      check_in: r.check_in_at ? r.check_in_at.toISOString() : null,
      check_out: r.check_out_at ? r.check_out_at.toISOString() : null,
      status: r.status,
    });
  }
  return out;
}

async function loadStaffNames(staffIds) {
  const ids = [...new Set(staffIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const staff = await Staff.find({ _id: T({ $in: ids }) }).select('name').lean();
  return new Map(staff.map((s) => [String(s._id), s.name]));
}

async function listApprovals({ status = 'PENDING', request_type, booking_id, page = 1, limit = 20 }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const filter = {};
  const st = String(status || 'PENDING').toUpperCase();
  if (st !== 'ALL') {
    if (!STATUSES.includes(st)) throw E.validation('Invalid status', { field: 'status' });
    filter.status = st;
  }
  if (request_type) {
    const t = String(request_type).toUpperCase();
    if (!TYPES.includes(t)) throw E.validation('Invalid request_type', { field: 'request_type' });
    filter.request_type = t;
  }
  if (booking_id) {
    if (!mongoose.isValidObjectId(booking_id)) throw E.validation('Invalid booking_id', { field: 'booking_id' });
    filter.reservation_id = booking_id;
  }

  const total = await ApprovalRequest.countDocuments(filter);
  const rows = await ApprovalRequest.find(filter)
    .sort({ createdAt: -1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  const [names, summaries] = await Promise.all([
    loadStaffNames(rows.map((r) => r.requested_by_staff_id)),
    loadReservationSummaries(rows.map((r) => r.reservation_id)),
  ]);

  return {
    data: rows.map((r) =>
      toApprovalDto(r, {
        requesterName: names.get(String(r.requested_by_staff_id)) || null,
        reservation: summaries.get(String(r.reservation_id)) || null,
      })
    ),
    meta: { page: p, limit: l, total, total_pages: Math.ceil(total / l) || 1 },
  };
}

async function getApprovalById(id) {
  if (!mongoose.isValidObjectId(id)) throw E.notFound('Approval request not found');
  const a = await ApprovalRequest.findById(id).lean();
  if (!a) throw E.notFound('Approval request not found');

  const [names, summaries] = await Promise.all([
    loadStaffNames([a.requested_by_staff_id]),
    loadReservationSummaries([a.reservation_id]),
  ]);

  // Pending: show the live net. Decided: keep the final stored value.
  let netOverride;
  if (a.status === 'PENDING' && a.reservation_id) netOverride = await netPaid(a.reservation_id);

  return toApprovalDto(a, {
    requesterName: names.get(String(a.requested_by_staff_id)) || null,
    reservation: summaries.get(String(a.reservation_id)) || null,
    netOverride,
  });
}

function parseApprovedAmount(raw) {
  const n = Number(raw);
  if (raw === '' || typeof raw === 'boolean' || !Number.isFinite(n) || n < 0) {
    throw E.validation('approved_refund_amount must be a number >= 0', { field: 'approved_refund_amount' });
  }
  try {
    return toPiastres(n);
  } catch (e) {
    throw E.validation('approved_refund_amount must have at most 2 decimal places', {
      field: 'approved_refund_amount',
    });
  }
}

async function decideApproval(id, body, actor, ip) {
  if (!mongoose.isValidObjectId(id)) throw E.notFound('Approval request not found');

  const { action, approved_refund_amount, manager_comment } = body || {};
  const act = String(action || '').toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(act)) {
    throw E.validation('action must be APPROVE or REJECT', { field: 'action' });
  }
  const comment = manager_comment ? sanitizeText(String(manager_comment)) : null;
  if (comment && comment.length > 500) {
    throw E.validation('manager_comment must not exceed 500 characters', { field: 'manager_comment' });
  }
  if (act === 'REJECT' && !comment) {
    throw E.validation('manager_comment is required when rejecting', { field: 'manager_comment' });
  }
  const hasAmount = approved_refund_amount !== undefined && approved_refund_amount !== null;
  const approvedInput = act === 'APPROVE' && hasAmount ? parseApprovedAmount(approved_refund_amount) : null;
  const now = new Date();

  return runInTransaction(async (session) => {
    // 1. Atomic claim. The $ne is the database-level "no self approval" rule.
    const claimed = await ApprovalRequest.findOneAndUpdate(
      { _id: id, status: 'PENDING', requested_by_staff_id: T({ $ne: actor._id }) },
      {
        $set: {
          status: act === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          decided_by_staff_id: actor._id,
          decided_at: now,
          manager_comment: comment,
        },
      },
      { new: true, session }
    );

    if (!claimed) {
      const cur = await ApprovalRequest.findById(id).session(session).lean();
      if (!cur) throw E.notFound('Approval request not found');
      if (String(cur.requested_by_staff_id) === String(actor._id)) {
        throw E.forbidden('Cannot decide your own request', 'CANNOT_APPROVE_OWN_REQUEST');
      }
      throw E.conflict('Already decided', 'RECORD_ALREADY_DECIDED');
    }

    const isMoney = MONEY_TYPES.includes(claimed.request_type);
    const respond = ({ net = claimed.net_paid_amount || 0, approved = 0, retained = 0, execution = null }) => ({
      approval_id: String(claimed._id),
      booking_id: idOrNull(claimed.reservation_id),
      request_type: claimed.request_type,
      status: claimed.status,
      net_paid_amount: toEgp(net),
      approved_refund_amount: toEgp(approved),
      retained_amount: toEgp(retained),
      decided_by_staff_id: String(actor._id),
      decided_at: now.toISOString(),
      execution_result: execution,
    });

    // 2. REJECT: leave the reservation untouched, just clear the pending flag
    if (act === 'REJECT') {
      if (isMoney && claimed.reservation_id) {
        await Reservation.updateOne({ _id: claimed.reservation_id }, { $set: { pending_refund: false } }, { session });
      }
      await notifyStaff(
        claimed.requested_by_staff_id,
        { type: 'APPROVAL_DECISION', title: 'Request rejected', message: comment, refType: 'ApprovalRequest', refId: claimed._id },
        { session }
      );
      await audit(
        {
          action: AUDIT.REJECTED_APPROVAL,
          actorStaffId: actor._id,
          entity: 'ApprovalRequest',
          entityId: String(claimed._id),
          details: { request_type: claimed.request_type },
          ip,
        },
        { session }
      );
      return respond({});
    }

    // 3. APPROVE of DISCOUNT / UPGRADE / PRICE_OVERRIDE: record only
    if (!isMoney) {
      if (hasAmount) {
        throw E.validation('approved_refund_amount is only allowed for CANCELLATION or REFUND', {
          field: 'approved_refund_amount',
        });
      }
      await notifyStaff(
        claimed.requested_by_staff_id,
        {
          type: 'APPROVAL_DECISION',
          title: 'Request approved',
          message: comment || 'Decision recorded. Please apply it manually.',
          refType: 'ApprovalRequest',
          refId: claimed._id,
        },
        { session }
      );
      await audit(
        {
          action: AUDIT.APPROVED_APPROVAL,
          actorStaffId: actor._id,
          entity: 'ApprovalRequest',
          entityId: String(claimed._id),
          details: { request_type: claimed.request_type, recorded_only: true },
          ip,
        },
        { session }
      );
      return respond({});
    }

    // 4. APPROVE of CANCELLATION / REFUND: this is the money path
    if (!hasAmount) {
      throw E.validation('approved_refund_amount is required for this request type', {
        field: 'approved_refund_amount',
      });
    }
    if (!claimed.reservation_id) throw E.conflict('Request has no reservation');

    const approved = approvedInput;
    const net = await netPaid(claimed.reservation_id, session);
    if (net <= 0) throw E.conflict('Nothing left to refund (already refunded?)');
    if (approved > net) {
      throw E.validation('approved_refund_amount must not exceed net_paid_amount', {
        field: 'approved_refund_amount',
        issue: '<= net_paid_amount',
      });
    }
    const retained = net - approved;

    // Shift for the refund: the requester's active shift, else the latest active shift of anyone
    let shift = await Shift.findOne({ staff_id: claimed.requested_by_staff_id, status: 'active' })
      .sort({ start_at: -1 })
      .session(session)
      .lean();
    if (!shift) shift = await Shift.findOne({ status: 'active' }).sort({ start_at: -1 }).session(session).lean();
    if (!shift) {
      throw E.conflict('No active shift to record the refund. Try again when a shift is open.');
    }

    let refundPaymentId = null;
    if (approved > 0) {
      const [pay] = await Payment.create(
        [
          {
            reservation_id: claimed.reservation_id,
            staff_id: shift.staff_id,
            shift_id: shift._id,
            amount: -approved,
            payment_method: 'cash',
            notes: 'Refund (approval ' + String(claimed._id) + ')',
            payment_datetime: now,
            payment_verified: false,
            payment_type: 'refund',
            approval_id: claimed._id,
            approved_by_staff_id: actor._id,
          },
        ],
        { session }
      );
      refundPaymentId = pay._id;

      // Keep paid_cache equal to the net money held
      const dec = await Reservation.updateOne(
        { _id: claimed.reservation_id, paid_cache: T({ $gte: approved }) },
        { $inc: { paid_cache: -approved } },
        { session }
      );
      if (dec.modifiedCount !== 1) throw E.conflict('Reservation paid amount is out of sync');
    }

    let settlementId = null;
    if (claimed.request_type === 'CANCELLATION') {
      await cancelReservationInTx(claimed.reservation_id, { session }); // 409 + rollback if it can't be cancelled
      const [st] = await CancellationSettlement.create(
        [
          {
            approval_id: claimed._id,
            reservation_id: claimed.reservation_id,
            shift_id: shift._id,
            net_paid_amount: net,
            refunded_amount: approved,
            retained_amount: retained,
            refund_payment_id: refundPaymentId,
            decided_by_staff_id: actor._id,
          },
        ],
        { session }
      );
      settlementId = st._id;
      await Reservation.updateOne(
        { _id: claimed.reservation_id },
        { $set: { refund_settled: true, pending_refund: false, settlement_id: st._id } },
        { session }
      );
    } else {
      await Reservation.updateOne({ _id: claimed.reservation_id }, { $set: { pending_refund: false } }, { session });
    }

    await ApprovalRequest.updateOne(
      { _id: claimed._id },
      { $set: { net_paid_amount: net, approved_refund_amount: approved, amount_retained: retained } },
      { session }
    );

    await notifyStaff(
      claimed.requested_by_staff_id,
      {
        type: 'APPROVAL_DECISION',
        title: 'Request approved',
        message: 'Refund approved: ' + toEgp(approved).toFixed(2) + ' EGP',
        refType: 'ApprovalRequest',
        refId: claimed._id,
      },
      { session }
    );
    await audit(
      {
        action: AUDIT.APPROVED_APPROVAL,
        actorStaffId: actor._id,
        entity: 'ApprovalRequest',
        entityId: String(claimed._id),
        details: { request_type: claimed.request_type, net, approved, retained },
        ip,
      },
      { session }
    );

    const resv = await Reservation.findById(claimed.reservation_id).select('status room_id').session(session).lean();
    const room = resv ? await Room.findById(resv.room_id).select('status').session(session).lean() : null;

    return respond({
      net,
      approved,
      retained,
      execution: {
        booking_status: resv ? resv.status : null,
        room_status: room ? room.status : null, // raw value for now; will go through the M5 mapper
        refund_payment_id: idOrNull(refundPaymentId),
        settlement_id: idOrNull(settlementId),
        shift_id: String(shift._id),
      },
    });
  });
}

module.exports = { listApprovals, getApprovalById, decideApproval };