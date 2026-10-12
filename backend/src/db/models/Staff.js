const { Schema, model } = require('mongoose');

const staffSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    default_shift_type: {
      type: String,
      enum: ['morning', 'evening', 'night'],
      default: 'morning',
    },
    role: {
      type: String,
      enum: ['receptionist', 'manager'],
      default: 'receptionist',
    },
    active: {
      type: Boolean,
      default: true,
    },
    failed_attempts: {
      type: Number,
      default: 0,
    },
    lock_level: {
      type: Number,
      default: 0,
    },
    locked_until: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = model('Staff', staffSchema);
