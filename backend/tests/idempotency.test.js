const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const idempotent = require('../src/middleware/idempotency');
const errorHandler = require('../src/middleware/errorHandler');
const IdempotencyKey = require('../src/db/models/IdempotencyKey');
const { E } = require('../src/utils/errors');

const staffA = String(new mongoose.Types.ObjectId());
const staffB = String(new mongoose.Types.ObjectId());
const KEY = 'test-key-12345678';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ينتظر لحد ما الشرط يتحقق (للعمليات اللي بتحصل بعد خروج الرد)
async function waitFor(check, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await sleep(25);
  }
  return false;
}

let counter = 0;
let flakyAttempts = 0;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.log = { error() {} };
    req.auth = { staff: { _id: req.get('x-test-staff') } };
    next();
  });
  app.post('/pay', idempotent(), (req, res) => { counter += 1; res.status(201).json({ ok: true, n: counter }); });
  app.post('/slow', idempotent(), async (req, res) => { counter += 1; await sleep(300); res.status(201).json({ ok: true, n: counter }); });
  app.post('/empty', idempotent(), (req, res) => { counter += 1; res.status(204).end(); });
  app.post('/flaky', idempotent(), (req, res, next) => {
    flakyAttempts += 1;
    if (flakyAttempts === 1) return next(E.conflict('fail once'));
    res.status(201).json({ ok: true, attempt: flakyAttempts });
  });
  app.post('/boom', idempotent(), (req, res, next) => next(new Error('boom')));
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const post = (path, { staff = staffA, key = KEY, body = {} } = {}) => {
  const r = request(app).post(path).set('x-test-staff', staff);
  if (key) r.set('Idempotency-Key', key);
  return r.send(body);
};

beforeAll(async () => { await IdempotencyKey.init(); }); // نستنى الـ indexes تتبني
beforeEach(async () => { counter = 0; flakyAttempts = 0; await IdempotencyKey.deleteMany({}); });

test('نفس الـ key مرتين: العملية تتنفذ مرة واحدة والرد مطابق', async () => {
  const r1 = await post('/pay', { body: { amount: 100 } });
  const r2 = await post('/pay', { body: { amount: 100 } });
  expect(counter).toBe(1);
  expect(r1.status).toBe(201);
  expect(r2.status).toBe(201);
  expect(r2.body).toEqual(r1.body);
  expect(r2.headers['idempotent-replayed']).toBe('true');
  expect(r1.headers['idempotent-replayed']).toBeUndefined();
});

test('الرد الناجح بيتخزن كامل: الحالة وكود الرد والجسم', async () => {
  await post('/pay', { body: { amount: 100 } });
  const rec = await IdempotencyKey.findOne({ staff_id: staffA, key: KEY }).lean();
  expect(rec.status).toBe('done');
  expect(rec.response_status).toBe(201);
  expect(rec.response_body).toEqual({ ok: true, n: 1 });
});

test('ترتيب الحقول في الـ body مش بيفرق', async () => {
  await post('/pay', { body: { a: 1, b: { x: 1, y: 2 } } });
  const r2 = await post('/pay', { body: { b: { y: 2, x: 1 }, a: 1 } });
  expect(counter).toBe(1);
  expect(r2.headers['idempotent-replayed']).toBe('true');
});

test('نفس الـ key بجسم مختلف: 400', async () => {
  await post('/pay', { body: { amount: 100 } });
  const r2 = await post('/pay', { body: { amount: 200 } });
  expect(r2.status).toBe(400);
  expect(r2.body.error.code).toBe('VALIDATION_ERROR');
  expect(counter).toBe(1);
});

test('نفس الـ key على endpoint تاني (حتى بنفس الجسم): 400', async () => {
  await post('/pay', { body: { amount: 100 } });
  const r2 = await post('/slow', { body: { amount: 100 } });
  expect(r2.status).toBe(400);
  expect(counter).toBe(1);
});

test('طلبين متزامنين بنفس الـ key: واحد بس بيتنفذ', async () => {
  const [a, b] = await Promise.all([post('/slow'), post('/slow')]);
  expect(counter).toBe(1);
  expect([a.status, b.status]).toContain(201);
  expect([201, 409]).toContain(a.status);
  expect([201, 409]).toContain(b.status);
});

test('طلب فشل (409): الـ key بيتمسح وإعادة المحاولة بتتنفذ من جديد', async () => {
  const r1 = await post('/flaky');
  expect(r1.status).toBe(409);
  expect(await IdempotencyKey.countDocuments()).toBe(0);
  const r2 = await post('/flaky');
  expect(r2.status).toBe(201);
  expect(flakyAttempts).toBe(2);
});

test('طلب فشل (500): الـ key بيتمسح برضو', async () => {
  const r1 = await post('/boom');
  expect(r1.status).toBe(500);
  expect(await IdempotencyKey.countDocuments()).toBe(0);
});

test('رد ناجح من غير json (204): الـ key ما يفضلش عالق', async () => {
  const r1 = await post('/empty');
  expect(r1.status).toBe(204);
  const cleaned = await waitFor(async () => (await IdempotencyKey.countDocuments()) === 0);
  expect(cleaned).toBe(true);
  await post('/empty'); // إعادة المحاولة بتتنفذ (مش بتتعلّق على 409 24 ساعة)
  expect(counter).toBe(2);
});

test('نفس الـ key من موظفين مختلفين: مفيش تعارض', async () => {
  await post('/pay', { staff: staffA });
  const r2 = await post('/pay', { staff: staffB });
  expect(counter).toBe(2);
  expect(r2.headers['idempotent-replayed']).toBeUndefined();
});

test('من غير Idempotency-Key أو key قصير: 400', async () => {
  const r1 = await post('/pay', { key: null });
  const r2 = await post('/pay', { key: 'abc' });
  expect(r1.status).toBe(400);
  expect(r2.status).toBe(400);
  expect(counter).toBe(0);
});

test('key أطول من 100 حرف أو فيه رموز غلط: 400', async () => {
  const tooLong = await post('/pay', { key: 'a'.repeat(101) });
  const badChars = await post('/pay', { key: 'bad key with spaces!!' });
  expect(tooLong.status).toBe(400);
  expect(badChars.status).toBe(400);
  expect(counter).toBe(0);
});

test('الـ indexes: unique على staff_id+key، وTTL بعد 24 ساعة على created_at', async () => {
  const idx = await IdempotencyKey.collection.indexes();
  const uq = idx.find((i) => i.key.staff_id === 1 && i.key.key === 1);
  const ttl = idx.find((i) => i.key.created_at === 1);
  expect(uq && uq.unique).toBe(true);
  expect(ttl && ttl.expireAfterSeconds).toBe(86400);
});