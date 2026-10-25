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
    // M1 fields
    payment_type: {
      type: String,
      enum: ['payment', 'refund', 'correction'],
      default: 'payment',
    },
    approval_id: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    approved_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
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


const blocked = (op) => async function () {
  throw new Error(`Payments are append-only: ${op} is not allowed`);
};

[
  'updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete',
  'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany',
].forEach((op) => paymentSchema.pre(op, blocked(op)));

paymentSchema.pre('save', async function () {
  if (!this.isNew) throw new Error('Payments are append-only: save on an existing payment is not allowed');
});

module.exports = model('Payment', paymentSchema);