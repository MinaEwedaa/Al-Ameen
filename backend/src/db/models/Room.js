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
    view: {
      type: String,
      enum: ['nile', 'garden', 'city'],
      default: null,
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
      enum: ['available', 'occupied', 'cleaning', 'maintenance', 'out_of_service'],
      default: 'available',
    },
    room_type_id: {
      type: Schema.Types.ObjectId,
      ref: 'RoomType',
      index: true,
    },
    inspected: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = model('Room', roomSchema);
