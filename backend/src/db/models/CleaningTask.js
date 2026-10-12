const { Schema, model } = require('mongoose');

const cleaningTaskSchema = new Schema(
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
    assigned_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'done'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    cleaner_name: {
      type: String,
      default: null,
      trim: true,
    },
    assigned_at: {
      type: Date,
      default: Date.now,
    },
    finished_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

cleaningTaskSchema.index({ status: 1 });
cleaningTaskSchema.index({ room_id: 1 });

module.exports = model('CleaningTask', cleaningTaskSchema);
