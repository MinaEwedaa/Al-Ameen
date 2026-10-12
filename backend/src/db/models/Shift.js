const { Schema, model } = require('mongoose');

const shiftSchema = new Schema(
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
      enum: ['active', 'handed_over'],
      default: 'active',
    },
    handed_over_at: {
      type: Date,
      default: null,
    },
    shift_notes: {
      type: String,
      default: null,
    },
    report_status: {
      type: String,
      enum: ['pending', 'ready', 'failed'],
      default: null,
    },
  },
  { timestamps: true }
);

// One active or opened shift per date and shift_type slot
shiftSchema.index({ shift_date: 1, shift_type: 1 }, { unique: true });
shiftSchema.index({ staff_id: 1, status: 1 });

module.exports = model('Shift', shiftSchema);
