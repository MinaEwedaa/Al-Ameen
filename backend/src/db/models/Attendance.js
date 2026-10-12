const { Schema, model } = require('mongoose');

const attendanceSchema = new Schema(
  {
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      unique: true,
    },
    date: {
      type: String, // 'yyyy-MM-dd'
      required: true,
    },
    status: {
      type: String,
      enum: ['present', 'late'],
      required: true,
    },
    check_in_at: {
      type: Date,
      required: true,
    },
    check_out_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = model('Attendance', attendanceSchema);
