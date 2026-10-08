const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: [true, 'Staff reference is required'],
    },
    shift_notes: {
      type: String,
      trim: true,
    },
    start_time: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    end_time: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true;
          const startTime = this.start_time || (this.get && this.get('start_time'));
          if (!startTime) return true;
          return new Date(value) > new Date(startTime);
        },
        message: 'End time must be after start time',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index on staff and start_time
shiftSchema.index({ staff: 1, start_time: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
