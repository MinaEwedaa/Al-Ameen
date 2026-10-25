const { Schema, model } = require('mongoose');

const notificationSchema = new Schema(
  {
    recipient_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'APPROVAL_REQUEST',
        'APPROVAL_DECISION',
        'LEAVE_REQUEST',
        'LEAVE_DECISION',
        'CRITICAL_MAINTENANCE',
        'CRITICAL_COMPLAINT',
        'SHIFT_REPORT_SUBMITTED',
        'SYSTEM',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    ref_type: {
      type: String,
      default: null,
    },
    ref_id: {
      type: Schema.Types.Mixed,
      default: null,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient_staff_id: 1, is_read: 1, createdAt: -1 });

module.exports = model('Notification', notificationSchema);
