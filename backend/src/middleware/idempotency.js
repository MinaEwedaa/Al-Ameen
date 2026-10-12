const crypto = require('crypto');
const IdempotencyKey = require('../db/models/IdempotencyKey');
const { E } = require('../utils/errors');

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/; // UUID بيعدّي

// JSON بترتيب ثابت للمفاتيح (حتى جوه الـ objects) عشان {a,b} و{b,a} يطلعوا نفس الـ hash
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort()
    .map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

module.exports = () => async (req, res, next) => {
  try {
    const key = req.get('Idempotency-Key');
    if (!key || !KEY_PATTERN.test(key)) {
      throw E.validation('Idempotency-Key header is required (8-100 chars: letters, digits, - or _)');
    }

    const staffId = req.auth.staff._id;
    const hash = crypto.createHash('sha256')
      .update(req.method + ' ' + req.originalUrl + ' ' + stableStringify(req.body))
      .digest('hex');

    // مهم: ده بره أي transaction بتاعة العملية الأساسية، عمدًا
    let rec;
    try {
      rec = await IdempotencyKey.create({
        staff_id: staffId, key, request_hash: hash, status: 'in_progress',
      });
    } catch (e) {
      if (e.code !== 11000) throw e; // 11000 = duplicate key = الـ key مستخدم قبل كده
      const old = await IdempotencyKey.findOne({ staff_id: staffId, key }).lean();
      if (!old) throw E.conflict('Please retry the request');
      if (old.request_hash !== hash) throw E.validation('Idempotency-Key was used with a different request');
      if (old.status === 'done') {
        res.set('Idempotent-Replayed', 'true');
        return res.status(old.response_status).json(old.response_body);
      }
      throw E.conflict('A request with this key is still being processed');
    }

    // نلفّ res.json: لو الرد ناجح (2xx) نخزّنه، لو فشل نمسح الـ key عشان إعادة المحاولة تتنفذ من جديد
    const sendJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await IdempotencyKey.updateOne(
            { _id: rec._id },
            { status: 'done', response_status: res.statusCode, response_body: body }
          );
        } else {
          await IdempotencyKey.deleteOne({ _id: rec._id, status: 'in_progress' });
        }
      } catch (err) {
        req.log?.error({ err }, 'idempotency bookkeeping failed');
      }
      return sendJson(body);
    };

    // شبكة أمان لو الرد خرج من غير json
   // شبكة أمان: أي key لسه in_progress بعد ما الرد خلص بيتمسح عشان إعادة المحاولة تتنفذ
res.on('finish', () => {
  IdempotencyKey.deleteOne({ _id: rec._id, status: 'in_progress' }).catch(() => {});
});

    next();
  } catch (e) { next(e); }
};