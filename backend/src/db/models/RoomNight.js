const { Schema, model } = require('mongoose');

const roomNightSchema = new Schema(
  {
    room_id: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    day: {
      type: String, // 'yyyy-MM-dd'
      required: true,
    },
    reservation_id: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index prevents overlapping double bookings for the same room night
roomNightSchema.index({ room_id: 1, day: 1 }, { unique: true });

module.exports = model('RoomNight', roomNightSchema);
