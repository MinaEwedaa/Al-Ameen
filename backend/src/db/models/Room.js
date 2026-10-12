const { Schema, model } = require('mongoose');

const roomSchema = new Schema(
  {
    room_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    room_type: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    floor: {
      type: Number,
    },
    price_per_night: {
      type: Number,
      required: true,
      min: 0, // Integer in Piastres (1 EGP = 100 Piastres)
    },
    half_day_price: {
      type: Number,
      required: true,
      min: 0, // Integer in Piastres (1 EGP = 100 Piastres)
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'cleaning', 'maintenance'],
      default: 'available',
    },
  },
  { timestamps: true }
);

module.exports = model('Room', roomSchema);
