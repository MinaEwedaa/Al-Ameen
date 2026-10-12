const { Schema, model } = require('mongoose');

const sessionSchema = new Schema(
  {
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    refresh_hash: {
      type: String,
      required: true,
    },
    previous_refresh_hash: {
      type: String,
      default: null,
    },
    expires_at: {
      type: Date,
      required: true,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
    scheduled_shift: {
      type: String, // 'yyyy-MM-dd_shiftType'
      default: null,
    },
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    last_seen_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ staff_id: 1, refresh_hash: 1 });

module.exports = model('Session', sessionSchema);
