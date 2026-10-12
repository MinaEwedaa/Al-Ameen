const { Schema, model } = require('mongoose');

const roomStatusHistorySchema = new Schema(
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
    status: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    changed_at: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

roomStatusHistorySchema.index({ room_id: 1, changed_at: -1 });

module.exports = model('RoomStatusHistory', roomStatusHistorySchema);
