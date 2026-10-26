// MANAGER-M8: receptionist side, opens approval requests
const mongoose = require('mongoose');
const { ApprovalRequest, Reservation, Room } = require('../../db/models');
const { E } = require('../../utils/errors');
const { toEgp, toPiastres } = require('../../utils/money');
const { sanitizeText } = require('../../utils/arabic');
const { runInTransaction } = require('../../utils/transaction');
const { audit } = require('../audit/audit.service');
const { AUDIT } = require('../audit/audit.actions');
const { notifyManagers } = require('../notifications/notify');
const { netPaid } = require('../reservations/reservation.cancel');
const { toApprovalDto } = require('../manager/approvals/approvals.dto');

const T = mongoose.trusted;
const ACTIVE = ['confirmed', 'checked_in'];
const TYPES = ['REFUND', 'DISCOUNT', 'CANCELLATION', 'UPGRADE', 'PRICE_OVERRIDE'];
const MONEY_TYPES = ['REFUND', 'CANCELLATION'];

async function createApprovalRequest(body, staff, shift, ip) {
  const { request_type, booking_id, reason, requested_refund_amount, new_room_id } = body || {};

  const type = String(request_type || '').toUpperCase();
  if (!TYPES.includes(type)) throw E.validation('Invalid request_type', { field: 'request_type' });
  if (!mongoose.isValidObjectId(booking_id)) throw E.validation('Valid booking_id is required', { field: 'booking_id' });

  const cleanReason = sanitizeText(String(reason || ''));
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw E.validation('reason is required (3-500 characters)', { field: 'reason' });
  }

  let requested = null;
  if (requested_refund_amount !== undefined && requested_refund_amount !== null) {
    if (!MONEY_TYPES.includes(type)) {
      throw E.validation('requested_refund_amount is only allowed for REFUND or CANCELLATION', {
        field: 'requested_refund_amount',
      });
    }
    const n = Number(requested_refund_amount);
    if (typeof requested_refund_amount === 'boolean' || !Number.isFinite(n) || n <= 0) {
      throw E.validation('requested_refund_amount must be greater than 0', { field: 'requested_refund_amount' });
    }
    try {
      requested = toPiastres(n);
    } catch (e) {
      throw E.validation('requested_refund_amount must have at most 2 decimal places', {
        field: 'requested_refund_amount',
      });
    }
  }

  if (type === 'UPGRADE') {
    if (!mongoose.isValidObjectId(new_room_id)) {
      throw E.validation('new_room_id is required for UPGRADE', { field: 'new_room_id' });
    }
  } else if (new_room_id) {
    throw E.validation('new_room_id is only allowed for UPGRADE', { field: 'new_room_id' });
  }

  const created = await runInTransaction(async (session) => {
    const reservation = await Reservation.findById(booking_id).session(session).lean();
    if (!reservation) throw E.notFound('Reservation not found');
    if (!ACTIVE.includes(reservation.status)) throw E.conflict('Reservation is not active');

    // One PENDING request per reservation and type
    const dup = await ApprovalRequest.exists({
      reservation_id: reservation._id,
      request_type: type,
      status: 'PENDING',
    }).session(session);
    if (dup) throw E.conflict('A pending request of this type already exists for this reservation');

    let net = 0;
    if (MONEY_TYPES.includes(type)) {
      if (reservation.pending_refund) {
        throw E.conflict('A refund approval is already pending for this reservation');
      }
      if (type === 'CANCELLATION' && reservation.status !== 'confirmed') {
        throw E.conflict('Only confirmed reservations can be cancelled');
      }
      net = await netPaid(reservation._id, session);
      if (net <= 0) throw E.badRequest('Nothing to refund: no net payments on this reservation');
      if (requested !== null && requested > net) {
        throw E.validation('requested_refund_amount must not exceed net_paid_amount', {
          field: 'requested_refund_amount',
          issue: '<= net_paid_amount',
        });
      }
    }

    if (type === 'UPGRADE') {
      if (String(reservation.room_id) === String(new_room_id)) {
        throw E.validation('new_room_id must differ from the current room', { field: 'new_room_id' });
      }
      const room = await Room.exists({ _id: new_room_id }).session(session);
      if (!room) throw E.notFound('Room not found');
    }

    const [ap] = await ApprovalRequest.create(
      [
        {
          reservation_id: reservation._id,
          shift_id: shift._id,
          request_type: type,
          requested_by_staff_id: staff._id,
          requested_refund_amount: MONEY_TYPES.includes(type) ? (requested !== null ? requested : net) : 0,
          net_paid_amount: net,
          new_room_id: type === 'UPGRADE' ? new_room_id : null,
          reason: cleanReason,
          status: 'PENDING',
        },
      ],
      { session }
    );

    if (MONEY_TYPES.includes(type)) {
      await Reservation.updateOne({ _id: reservation._id }, { $set: { pending_refund: true } }, { session });
    }

    await notifyManagers(
      {
        type: 'APPROVAL_REQUEST',
        title: 'Approval request',
        message: staff.name + ' - ' + type + (net > 0 ? ' (' + toEgp(net).toFixed(2) + ' EGP)' : ''),
        refType: 'ApprovalRequest',
        refId: ap._id,
      },
      { session }
    );

    await audit(
      {
        action: AUDIT.CREATED_APPROVAL_REQUEST,
        actorStaffId: staff._id,
        entity: 'ApprovalRequest',
        entityId: String(ap._id),
        details: { request_type: type, reservation_id: String(reservation._id), net_paid_amount: net },
        ip,
      },
      { session }
    );
    return ap.toObject();
  });

  return toApprovalDto(created, { requesterName: staff.name });
}

module.exports = { createApprovalRequest };