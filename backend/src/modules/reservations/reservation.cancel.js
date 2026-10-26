// MANAGER-M8: cancellation with approval flow
const mongoose = require('mongoose');
const { Reservation, RoomNight, Payment, ApprovalRequest } = require('../../db/models');
const { E } = require('../../utils/errors');
const { toEgp } = require('../../utils/money');
const { sanitizeText } = require('../../utils/arabic');
const { runInTransaction } = require('../../utils/transaction');
const { audit } = require('../audit/audit.service');
const { AUDIT } = require('../audit/audit.actions');
const { notifyManagers } = require('../notifications/notify');
const { toReservationDto } = require('./reservation.dto');
const { resolveReservationByIdentifier } = require('./reservation.service');

// Net money held for a reservation, in piastres (refunds are stored negative).
async function netPaid(reservationId, session) {
  const id = new mongoose.Types.ObjectId(String(reservationId));
  const [r] = await Payment.aggregate([
    { $match: { reservation_id: id } },
    { $group: { _id: null, net: { $sum: '$amount' } } },
  ]).session(session || null);
  return r ? r.net : 0;
}

// Cancels a CONFIRMED reservation inside an existing transaction.
// Confirmed reservations never touched the room status, so freeing = deleting RoomNight rows.
async function cancelReservationInTx(reservationId, { session }) {
  const updated = await Reservation.findOneAndUpdate(
    { _id: reservationId, status: 'confirmed' },
    { $set: { status: 'cancelled' } },
    { new: true, session }
  );
  if (!updated) throw E.conflict('Reservation can no longer be cancelled');
  await RoomNight.deleteMany({ reservation_id: updated._id }, { session });
  return updated;
}

// Returns { status, body }: 200 = cancelled now, 202 = approval opened.
async function cancelReservation({ reservation_id, reason, staff, shift, ip }) {
  const cleanReason = sanitizeText(reason || '');
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw E.validation('reason is required (3-500 characters)', { field: 'reason' });
  }

  const reservation = await resolveReservationByIdentifier(reservation_id);
  if (reservation.status !== 'confirmed') {
    throw E.conflict('Only confirmed reservations can be cancelled');
  }
  if (reservation.pending_refund) {
    throw E.conflict('A refund approval is already pending for this reservation');
  }

  const net = await netPaid(reservation._id);

  // Nothing paid (or already fully refunded): cancel directly.
  if (net <= 0) {
    const updated = await runInTransaction(async (session) => {
      const r = await cancelReservationInTx(reservation._id, { session });
      await audit(
        {
          action: AUDIT.RESERVATION_CANCELLED,
          actorStaffId: staff._id,
          entity: 'Reservation',
          entityId: String(r._id),
          details: { reason: cleanReason },
          ip,
        },
        { session }
      );
      return r;
    });
    return { status: 200, body: toReservationDto(updated.toObject()) };
  }

  // Money was paid: open an approval, do NOT cancel.
  const approval = await runInTransaction(async (session) => {
    const claim = await Reservation.updateOne(
      { _id: reservation._id, status: 'confirmed', pending_refund: mongoose.trusted({ $ne: true }) },
      { $set: { pending_refund: true } },
      { session }
    );
    if (claim.modifiedCount !== 1) {
      throw E.conflict('A refund approval is already pending for this reservation');
    }

    const [ap] = await ApprovalRequest.create(
      [
        {
          reservation_id: reservation._id,
          shift_id: shift._id,
          request_type: 'CANCELLATION',
          requested_by_staff_id: staff._id,
          requested_refund_amount: net,
          net_paid_amount: net,
          reason: cleanReason,
          status: 'PENDING',
        },
      ],
      { session }
    );

    await notifyManagers(
      {
        type: 'APPROVAL_REQUEST',
        title: 'Cancellation approval',
        message: `${staff.name} requests cancellation, net paid ${toEgp(net).toFixed(2)} EGP`,
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
        details: { request_type: 'CANCELLATION', reservation_id: String(reservation._id), net_paid_amount: net },
        ip,
      },
      { session }
    );
    return ap;
  });

  return {
    status: 202,
    body: { data: { approval_id: String(approval._id), status: 'PENDING_APPROVAL' } },
  };
}

module.exports = { netPaid, cancelReservationInTx, cancelReservation };