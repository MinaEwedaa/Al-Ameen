const { Schema, model } = require('mongoose');

const idempotencyKeySchema = new Schema({
  staff_id: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  key: { type: String, required: true, trim: true, maxlength: 100 },
  request_hash: { type: String, required: true },
  status: { type: String, enum: ['in_progress', 'done'], default: 'in_progress' },
  response_status: { type: Number },
  response_body: { type: Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now },
});

// نفس الموظف ما يقدرش يستخدم نفس الـ key مرتين
idempotencyKeySchema.index({ staff_id: 1, key: 1 }, { unique: true });
// السجل بيتمسح لوحده بعد 24 ساعة
idempotencyKeySchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = model('IdempotencyKey', idempotencyKeySchema);