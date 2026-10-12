const { Schema, model } = require('mongoose');

const idempotencyKeySchema = new Schema(
  {
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    request_hash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'done'],
      default: 'in_progress',
    },
    response_status: {
      type: Number,
      default: null,
    },
    response_body: {
      type: Schema.Types.Mixed,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24-hour TTL in MongoDB
    },
  },
  { timestamps: true }
);

idempotencyKeySchema.index({ staff_id: 1, key: 1 }, { unique: true });

module.exports = model('IdempotencyKey', idempotencyKeySchema);
