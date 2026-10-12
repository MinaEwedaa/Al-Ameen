const { Schema, model } = require('mongoose');

const maintenanceIssueSchema = new Schema(
  {
    room_id: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    problem: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved'],
      default: 'open',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

maintenanceIssueSchema.index({ status: 1 });
maintenanceIssueSchema.index({ room_id: 1 });

module.exports = model('MaintenanceIssue', maintenanceIssueSchema);
