const mongoose = require('mongoose');

const cleaningTaskSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'Completed', 'Inspected'],
      default: 'Pending',
    },
    notes: {
      type: String,
      trim: true,
    },
    assigned_date: {
      type: Date,
    },
    finished_date: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index on status for quick task querying
cleaningTaskSchema.index({ status: 1 });

module.exports = mongoose.model('CleaningTask', cleaningTaskSchema);
