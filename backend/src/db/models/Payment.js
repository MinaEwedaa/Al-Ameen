const { Schema, model } = require('mongoose');

const paymentSchema = new Schema(
  {
    reservation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
    },
    amount: {
      type: Number,
      required: true, // Integer in Piastres (positive for payment, negative for correction)
    },
    payment_method: {
      type: String,
      enum: ['cash', 'instapay', 'vodafone_cash'],
      required: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    payment_datetime: {
      type: Date,
      required: true,
    },
    payment_verified: {
      type: Boolean,
      default: false,
    },
    reversal_of_payment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    idempotency_key: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ reservation_id: 1 });
paymentSchema.index({ shift_id: 1 });
paymentSchema.index(
  { staff_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: 'string' } } }
);

module.exports = model('Payment', paymentSchema);
