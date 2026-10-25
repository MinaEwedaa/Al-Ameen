const { Schema, model } = require('mongoose');

const passwordResetRequestSchema = new Schema(
  {
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    requested_ip: {
      type: String,
      default: null,
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

passwordResetRequestSchema.index({ status: 1, createdAt: -1 });
passwordResetRequestSchema.index({ staff_id: 1, status: 1 });

module.exports = model('PasswordResetRequest', passwordResetRequestSchema);
