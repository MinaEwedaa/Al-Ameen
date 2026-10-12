const { Schema, model } = require('mongoose');

const guestSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    name_search: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    id_number_enc: {
      type: String,
      required: true,
    },
    id_number_hash: {
      type: String,
      required: true,
      unique: true,
    },
    id_number_last4: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

guestSchema.index({ name_search: 1 });
guestSchema.index({ phone: 1 });

module.exports = model('Guest', guestSchema);
