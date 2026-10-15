process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test-placeholder';

process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_long_enough_for_security_1234567890abcdef';
process.env.ID_ENC_KEY = process.env.ID_ENC_KEY || Buffer.alloc(32).toString('base64');
process.env.ID_HMAC_KEY = process.env.ID_HMAC_KEY || Buffer.alloc(32).toString('base64');
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.LATE_GRACE_MINUTES = '15';
// supertest بيعمل كل الطلبات من نفس الـ IP، فنرفع حد الـ login limiter في الاختبارات بس.
// rateLimit.js بيقرا القيمة دي فقط لما NODE_ENV === 'test'.
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
process.env.GENERAL_RATE_LIMIT_MAX = '5000';
// قيمة مؤقتة عشان env.js ما يرميش خطأ وقت الـ require (الـ URI الحقيقي بيتحط تحت في beforeAll)
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test_placeholder';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// نسخة MongoDB اللي بتشتغل في الاختبارات. لو عايزة تجربي نسخة تانية:
// $env:MONGOMS_VERSION="6.0.19"; npx jest ...   (في PowerShell)
let repl;

beforeAll(async () => {
  const replOpts = { replSet: { count: 1 } };
  if (process.env.MONGOMS_VERSION) {
    replOpts.binary = { version: process.env.MONGOMS_VERSION };
  }
  repl = await MongoMemoryReplSet.create(replOpts);
  process.env.MONGODB_URI = repl.getUri();
  await mongoose.connect(repl.getUri());
}, 300000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (repl) {
    await repl.stop();
  }
}, 60000);