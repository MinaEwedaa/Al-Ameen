const mongoose = require('mongoose');
const { Payment, Reservation, Shift } = require('../../src/db/models');
const { toPiastres, toEGP } = require('../../src/utils/money');
const { guard } = require('./guard');

async function reversePayment({ paymentId, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'REVERSE_PAYMENT',
    details: { payment_id: paymentId },
  });

  if (!mongoose.isValidObjectId(paymentId)) {
    throw new Error(`Invalid payment ID format: '${paymentId}'.`);
  }

  const session = await mongoose.startSession();
  let reversalPayment;
  try {
    await session.withTransaction(async () => {
      const original = await Payment.findById(paymentId).session(session);
      if (!original) {
        throw new Error(`Payment with ID '${paymentId}' not found.`);
      }

      if (original.amount <= 0) {
        throw new Error('Cannot reverse a negative or reversal payment.');
      }

      // Check if this payment was already reversed
      const alreadyReversed = await Payment.findOne({
        reversal_of_payment_id: original._id,
      }).session(session);

      if (alreadyReversed) {
        throw new Error(`Payment with ID '${paymentId}' has already been reversed.`);
      }

      // Create negative reversal payment
      const [rev] = await Payment.create(
        [
          {
            reservation_id: original.reservation_id,
            staff_id: original.staff_id,
            shift_id: original.shift_id,
            amount: -original.amount,
            payment_method: original.payment_method,
            notes: `Admin reversal: ${reason}`,
            payment_datetime: new Date(),
            payment_verified: false,
            reversal_of_payment_id: original._id,
          },
        ],
        { session }
      );

      // Decrement paid_cache on the reservation
      await Reservation.updateOne(
        { _id: original.reservation_id },
        { $inc: { paid_cache: -original.amount } },
        { session }
      );

      reversalPayment = rev;
    });
  } finally {
    await session.endSession();
  }

  return {
    reversal_payment_id: String(reversalPayment._id),
    original_payment_id: String(paymentId),
    reversed_amount: toEGP(-reversalPayment.amount),
    payment_method: reversalPayment.payment_method,
  };
}

async function addPayment({ reservationId, amount, method, shiftId, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'ADD_PAYMENT',
    details: { reservation_id: reservationId, amount, method, shift_id: shiftId },
  });

  if (!mongoose.isValidObjectId(reservationId)) {
    throw new Error(`Invalid reservation ID format: '${reservationId}'.`);
  }

  if (!mongoose.isValidObjectId(shiftId)) {
    throw new Error(`Invalid shift ID format: '${shiftId}'.`);
  }

  const amountPiastres = toPiastres(amount);
  if (amountPiastres <= 0) {
    throw new Error('Payment amount must be greater than 0.');
  }

  const session = await mongoose.startSession();
  let createdPayment;
  let remainingEgp;
  try {
    await session.withTransaction(async () => {
      const reservation = await Reservation.findById(reservationId).session(session);
      if (!reservation) {
        throw new Error(`Reservation with ID '${reservationId}' not found.`);
      }

      const shift = await Shift.findById(shiftId).session(session);
      if (!shift) {
        throw new Error(`Shift with ID '${shiftId}' not found.`);
      }

      const remainingPiastres = reservation.total_amount - (reservation.paid_cache || 0);
      if (amountPiastres > remainingPiastres) {
        throw new Error(
          `Payment amount (${toEGP(amountPiastres)}) cannot exceed remaining amount (${toEGP(remainingPiastres)}).`
        );
      }

      const [p] = await Payment.create(
        [
          {
            reservation_id: reservation._id,
            staff_id: shift.staff_id,
            shift_id: shift._id,
            amount: amountPiastres,
            payment_method: method,
            notes: `Admin corrective payment: ${reason}`,
            payment_datetime: new Date(),
            payment_verified: false,
          },
        ],
        { session }
      );

      await Reservation.updateOne(
        { _id: reservation._id },
        { $inc: { paid_cache: amountPiastres } },
        { session }
      );

      createdPayment = p;
      remainingEgp = toEGP(remainingPiastres - amountPiastres);
    });
  } finally {
    await session.endSession();
  }

  return {
    payment_id: String(createdPayment._id),
    reservation_id: String(reservationId),
    amount: toEGP(createdPayment.amount),
    payment_method: createdPayment.payment_method,
    remaining_balance: remainingEgp,
  };
}

async function checkPaidCache({ fix = false, by = 'System', reason = 'Paid cache verification audit', yes = false } = {}) {
  if (fix) {
    await guard({
      by,
      reason,
      yes,
      action: 'FIX_PAID_CACHE',
      details: { fix: true },
    });
  }

  const reservations = await Reservation.find({}).lean();
  const payments = await Payment.find({}).lean();

  // Aggregate sum of payments per reservation
  const sumByReservation = new Map();
  for (const p of payments) {
    const resId = String(p.reservation_id);
    sumByReservation.set(resId, (sumByReservation.get(resId) || 0) + p.amount);
  }

  const discrepancies = [];
  for (const r of reservations) {
    const resId = String(r._id);
    const expected = sumByReservation.get(resId) || 0;
    const actual = r.paid_cache || 0;

    if (expected !== actual) {
      discrepancies.push({
        reservation_id: resId,
        expected_piastres: expected,
        actual_piastres: actual,
        expected_egp: toEGP(expected),
        actual_egp: toEGP(actual),
        fixed: false,
      });

      if (fix) {
        await Reservation.updateOne({ _id: r._id }, { paid_cache: expected });
        discrepancies[discrepancies.length - 1].fixed = true;
      }
    }
  }

  return {
    total_reservations_checked: reservations.length,
    discrepancies_count: discrepancies.length,
    discrepancies,
  };
}

module.exports = {
  reversePayment,
  addPayment,
  checkPaidCache,
};
