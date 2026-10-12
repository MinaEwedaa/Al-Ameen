const { Schema, model } = require('mongoose');

const shiftReportSchema = new Schema(
  {
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      unique: true,
    },
    pdf: {
      type: Buffer,
      required: true,
    },
    sha256: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = model('ShiftReport', shiftReportSchema);
