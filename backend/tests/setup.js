process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_must_be_long_enough_for_security_1234567890abcdef';
process.env.ID_ENC_KEY = process.env.ID_ENC_KEY || Buffer.alloc(32).toString('base64');
process.env.ID_HMAC_KEY = process.env.ID_HMAC_KEY || Buffer.alloc(32).toString('base64');
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.COOKIE_SECURE = 'false';
process.env.LATE_GRACE_MINUTES = '15';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let repl;

beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = repl.getUri();
  await mongoose.connect(repl.getUri());
}, 60000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (repl) {
    await repl.stop();
  }
}, 30000);
