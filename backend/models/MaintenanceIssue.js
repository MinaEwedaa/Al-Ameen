const mongoose = require('mongoose');

const maintenanceIssueSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    problem: {
      type: String,
      required: [true, 'Problem description is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved'],
      default: 'Open',
    },
    notes: {
      type: String,
      trim: true,
    },
    created_date: {
      type: Date,
      default: Date.now,
    },
    resolved_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index on status and priority for filtering and triage
maintenanceIssueSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('MaintenanceIssue', maintenanceIssueSchema);
