const { Schema, model } = require('mongoose');

const reservationSchema = new Schema(
  {
    guest_id: {
      type: Schema.Types.ObjectId,
      ref: 'Guest',
      required: true,
    },
    room_id: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    check_in_at: {
      type: Date,
      required: true,
    },
    check_out_at: {
      type: Date,
      required: true,
    },
    nights: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['confirmed', 'checked_in', 'checked_out', 'cancelled'],
      default: 'confirmed',
    },
    price_per_night_snapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    half_day_price_snapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    half_day_extensions: {
      type: Number,
      default: 0,
      min: 0,
    },
    early_arrival: {
      type: Boolean,
      default: false,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0, // Integer in Piastres
    },
    paid_cache: {
      type: Number,
      default: 0,
      min: 0, // Integer in Piastres
    },
    check_in_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    check_in_shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    check_out_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    check_out_shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
  },
  { timestamps: true }
);

reservationSchema.index({ room_id: 1, check_in_at: 1 });
reservationSchema.index({ status: 1 });
reservationSchema.index({ guest_id: 1 });

module.exports = model('Reservation', reservationSchema);
