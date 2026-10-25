const { Schema, model } = require('mongoose');

const roomTypeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    base_price: {
      type: Number,
      required: true,
      min: 0, // Integer in Piastres
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    amenities: {
      type: [String],
      default: [],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

roomTypeSchema.virtual('active')
  .get(function () {
    return this.is_active;
  })
  .set(function (val) {
    this.is_active = val;
  });

module.exports = model('RoomType', roomTypeSchema);
