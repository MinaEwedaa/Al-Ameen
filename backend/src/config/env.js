require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET', 'ID_ENC_KEY', 'ID_HMAC_KEY', 'ALLOWED_ORIGINS'];
for (const k of required) {
  if (!process.env[k]) {
    throw new Error('Missing env var: ' + k);
  }
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  idEncKey: Buffer.from(process.env.ID_ENC_KEY, 'base64'),
  idHmacKey: Buffer.from(process.env.ID_HMAC_KEY, 'base64'),
  allowedOrigins: process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
  lateGraceMinutes: Number(process.env.LATE_GRACE_MINUTES || 15),
};
