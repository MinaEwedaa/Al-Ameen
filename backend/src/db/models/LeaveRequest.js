const { Schema, model } = require('mongoose');

const leaveRequestSchema = new Schema(
  {
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    leave_type: {
      type: String,
      enum: ['ANNUAL', 'SICK', 'UNPAID', 'EMERGENCY'],
      required: true,
    },
    start_date: {
      type: String, // 'yyyy-MM-dd'
      required: true,
    },
    end_date: {
      type: String, // 'yyyy-MM-dd'
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
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
    shifts_cancelled_count: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ status: 1, staff_id: 1 });
leaveRequestSchema.index({ staff_id: 1, start_date: 1 });

module.exports = model('LeaveRequest', leaveRequestSchema);
