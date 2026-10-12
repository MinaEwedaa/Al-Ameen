const AuditLog = require('../../db/models/AuditLog');
const env = require('../../config/env');
const { isValidAction } = require('./audit.actions');

// أي مفتاح اسمه فيه الكلمات دي بيتخفّى قبل التسجيل (حماية لو حد غلط وحط بيانات حساسة)
const SENSITIVE_KEY = /(password|passwd|_hash|id_number|token|secret|authorization|cookie)/i;
const MAX_DEPTH = 4;
const MAX_DETAILS_BYTES = 10000;

// Mongo مش بيحب مفاتيح فيها نقطة أو بتبدأ بـ $ (ممكن حد يستغلها). بنبدّلها.
const safeKey = (k) => k.replace(/\./g, '_').replace(/^\$/, '_');

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return '[too deep]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Date || value._bsontype) return value; // تاريخ أو ObjectId
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[safeKey(k)] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function prepareDetails(details) {
  const clean = redact(details || {});
  const size = Buffer.byteLength(JSON.stringify(clean) || '{}', 'utf8');
  return size > MAX_DETAILS_BYTES ? { truncated: true, size_bytes: size } : clean;
}

// إضافة فقط. لو العملية فيها فلوس أو حجز، مرّري { session } عشان السجل يتحفظ أو يتلغي مع العملية.
async function audit(
  { action, actorStaffId = null, entity = null, entityId = null, details = {}, ip = null },
  { session } = {}
) {
  if (!isValidAction(action)) {
    // في التطوير والاختبار نوقف عشان الغلطة تتصلح. في الـ production ما نوقفش شغل الفندق بسبب اسم حدث.
    if (env.nodeEnv !== 'production') throw new Error('Unknown audit action: ' + action);
    console.error('[audit] unknown action:', action);
  }
  await AuditLog.create(
    [{
      at: new Date(),
      action: String(action),
      actor_staff_id: actorStaffId,
      entity,
      entity_id: entityId == null ? null : String(entityId),
      details: prepareDetails(details),
      ip,
    }],
    { session }
  );
}

// للأحداث اللي برّه أي transaction (زي LOGIN_FAILED): لو التسجيل فشل ما نكسرش الطلب
async function auditSafe(entry) {
  try {
    await audit(entry);
  } catch (err) {
    console.error('[audit] failed:', err.message);
  }
}

module.exports = { audit, auditSafe };