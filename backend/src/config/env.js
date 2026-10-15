require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET', 'ID_ENC_KEY', 'ID_HMAC_KEY', 'ALLOWED_ORIGINS'];
for (const k of required) {
  if (!process.env[k]) {
    throw new Error('Missing env var: ' + k);
  }
}

function parseKey32(val) {
  if (!val) return Buffer.alloc(32);
  if (Buffer.isBuffer(val)) return val.length === 32 ? val : val.subarray(0, 32);
  const str = String(val).trim();
  if (/^[0-9a-fA-F]{64}$/.test(str)) {
    return Buffer.from(str, 'hex');
  }
  const b64 = Buffer.from(str, 'base64');
  if (b64.length === 32) {
    return b64;
  }
  const buf = Buffer.from(str);
  if (buf.length === 32) return buf;
  if (buf.length > 32) return buf.subarray(0, 32);
  return Buffer.concat([buf, Buffer.alloc(32 - buf.length)]);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  idEncKey: parseKey32(process.env.ID_ENC_KEY),
  idHmacKey: parseKey32(process.env.ID_HMAC_KEY),
  allowedOrigins: process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  lateGraceMinutes: Number(process.env.LATE_GRACE_MINUTES || 15),
};
