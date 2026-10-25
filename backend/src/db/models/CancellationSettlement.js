const { Schema, model } = require('mongoose');

const cancellationSettlementSchema = new Schema(
  {
    approval_id: {
      type: Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      required: true,
      unique: true,
    },
    reservation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    net_paid_amount: {
      type: Number,
      required: true, // Integer in Piastres
    },
    refunded_amount: {
      type: Number,
      required: true, // Integer in Piastres
    },
    retained_amount: {
      type: Number,
      required: true, // Integer in Piastres
    },
    refund_payment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    decided_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
  },
  { timestamps: true }
);

cancellationSettlementSchema.index({ shift_id: 1 });
cancellationSettlementSchema.index({ reservation_id: 1 });

// Block edits on settlements (append-only)
const blocked = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];

for (const op of blocked) {
  cancellationSettlementSchema.pre(op, function () {
    throw new Error('CancellationSettlement is append-only');
  });
}

cancellationSettlementSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('CancellationSettlement is append-only');
  }
});

module.exports = model('CancellationSettlement', cancellationSettlementSchema);
