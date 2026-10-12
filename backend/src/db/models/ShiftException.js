const { Schema, model } = require('mongoose');

const shiftExceptionSchema = new Schema(
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
    kind: {
      type: String,
      enum: ['cancel', 'swap', 'extra'],
      required: true,
    },
  },
  { timestamps: true }
);

shiftExceptionSchema.index(
  { staff_id: 1, shift_date: 1, shift_type: 1 },
  { unique: true }
);

module.exports = model('ShiftException', shiftExceptionSchema);
