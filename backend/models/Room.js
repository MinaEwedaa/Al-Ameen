const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    room_number: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
    },
    room_type: {
      type: String,
      enum: ['VIP', 'Normal'],
      required: [true, 'Room type is required'],
    },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Occupied', 'Cleaning', 'Under Maintenance'],
      default: 'Available',
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index on status for frequent filtering
roomSchema.index({ status: 1 });

module.exports = mongoose.model('Room', roomSchema);
