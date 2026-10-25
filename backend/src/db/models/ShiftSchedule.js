const { Schema, model } = require('mongoose');

const shiftScheduleSchema = new Schema(
  {
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    shift_date: {
      type: String, // 'yyyy-MM-dd'
      required: true,
    },
    shift_type: {
      type: String,
      enum: ['morning', 'evening', 'night'],
      required: true,
    },
    start_at: {
      type: Date,
      required: true,
    },
    end_at: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    cancel_reason: {
      type: String,
      default: null,
    },
    created_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
  },
  { timestamps: true }
);

shiftScheduleSchema.index({ staff_id: 1, shift_date: 1, shift_type: 1 }, { unique: true });
shiftScheduleSchema.index({ shift_date: 1 });
shiftScheduleSchema.index({ staff_id: 1, start_at: 1 });

module.exports = model('ShiftSchedule', shiftScheduleSchema);
