const { Schema, model } = require('mongoose');

const approvalRequestSchema = new Schema(
  {
    reservation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    request_type: {
      type: String,
      enum: ['REFUND', 'DISCOUNT', 'CANCELLATION', 'UPGRADE', 'PRICE_OVERRIDE'],
      required: true,
    },
    requested_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    requested_refund_amount: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    net_paid_amount: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    approved_refund_amount: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    amount_retained: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    new_room_id: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
    },
    decided_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    manager_comment: {
      type: String,
      default: null,
    },
    decided_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

approvalRequestSchema.index({ status: 1, createdAt: -1 });
approvalRequestSchema.index({ reservation_id: 1 });

module.exports = model('ApprovalRequest', approvalRequestSchema);
