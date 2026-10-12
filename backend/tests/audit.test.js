const mongoose = require('mongoose');
const AuditLog = require('../src/db/models/AuditLog');
const env = require('../src/config/env');
const { audit, auditSafe } = require('../src/modules/audit/audit.service');
const { AUDIT } = require('../src/modules/audit/audit.actions');

const staffId = new mongoose.Types.ObjectId();
const entityId = new mongoose.Types.ObjectId();

beforeAll(async () => { await AuditLog.init(); });
// الـ deleteMany العادي ممنوع على AuditLog (ده المطلوب)، فبننضّف بالـ collection المباشر
beforeEach(async () => { await AuditLog.collection.deleteMany({}); });

test('بيسجل العملية بكل بياناتها، والـ entity_id بيتخزن String', async () => {
  await audit({ action: AUDIT.CHECK_IN, actorStaffId: staffId, entity: 'Reservation', entityId, details: { note: 'x' }, ip: '1.2.3.4' });
  const doc = await AuditLog.findOne({ action: 'CHECK_IN' }).lean();
  expect(String(doc.actor_staff_id)).toBe(String(staffId));
  expect(doc.entity).toBe('Reservation');
  expect(doc.entity_id).toBe(String(entityId));
  expect(doc.ip).toBe('1.2.3.4');
  expect(doc.at).toBeInstanceOf(Date);
});

test('جوه transaction ونجحت: السجل يتحفظ', async () => {
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    await audit({ action: AUDIT.CHECK_OUT, actorStaffId: staffId, entity: 'Reservation', entityId }, { session });
  });
  await session.endSession();
  expect(await AuditLog.countDocuments()).toBe(1);
});

test('جوه transaction وفشلت: السجل ما يتكتبش', async () => {
  const session = await mongoose.startSession();
  await expect(session.withTransaction(async () => {
    await audit({ action: AUDIT.CHECK_OUT, actorStaffId: staffId, entity: 'Reservation', entityId }, { session });
    throw new Error('boom');
  })).rejects.toThrow('boom');
  await session.endSession();
  expect(await AuditLog.countDocuments()).toBe(0);
});

test('اسم عملية غلط بيترفض، وعمليات ADMIN_ مقبولة', async () => {
  await expect(audit({ action: 'CHEKC_IN' })).rejects.toThrow('Unknown audit action');
  await expect(audit({ action: 'ADMIN_CREATE_STAFF', details: { by: 'x' } })).resolves.toBeUndefined();
  expect(await AuditLog.countDocuments({ action: 'ADMIN_CREATE_STAFF' })).toBe(1);
});

test('في الـ production: اسم عملية غلط ما بيوقفش الشغل (بيتسجل بس)', async () => {
  const old = env.nodeEnv;
  env.nodeEnv = 'production';
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await expect(audit({ action: 'SOME_UNKNOWN_ACTION' })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  } finally {
    env.nodeEnv = old;
    spy.mockRestore();
  }
});

test('البيانات الحساسة في details بتتخفّى (حتى لو الاسم فيه كلمة زيادة)', async () => {
  await audit({
    action: AUDIT.GUEST_CREATED,
    details: {
      id_number: '29801011234567',
      new_password: 'p1',
      nested: { password: 'p2', access_token: 't', ok: 1 },
      refreshToken: 'r',
      id_number_hash: 'h',
      fine: 'visible',
    },
  });
  const doc = await AuditLog.findOne({ action: 'GUEST_CREATED' }).lean();
  expect(doc.details.id_number).toBe('[REDACTED]');
  expect(doc.details.new_password).toBe('[REDACTED]');
  expect(doc.details.nested.password).toBe('[REDACTED]');
  expect(doc.details.nested.access_token).toBe('[REDACTED]');
  expect(doc.details.refreshToken).toBe('[REDACTED]');
  expect(doc.details.id_number_hash).toBe('[REDACTED]');
  expect(doc.details.nested.ok).toBe(1);
  expect(doc.details.fine).toBe('visible');
});

test('مفاتيح خطرة ($ أو نقطة) بتتبدّل، والـ ObjectId بيفضل زي ما هو', async () => {
  await audit({ action: AUDIT.ROOM_STATUS_CHANGED, details: { $where: 'x', 'a.b': 1, ref: entityId } });
  const doc = await AuditLog.findOne({ action: 'ROOM_STATUS_CHANGED' }).lean();
  expect(doc.details._where).toBe('x');
  expect(doc.details.a_b).toBe(1);
  expect(String(doc.details.ref)).toBe(String(entityId));
});

test('details الكبيرة (فوق 10KB) بتتخزن كعلامة بدل النص كله', async () => {
  await audit({ action: AUDIT.EXTEND, details: { big: 'x'.repeat(20000) } });
  const doc = await AuditLog.findOne({ action: 'EXTEND' }).lean();
  expect(doc.details.truncated).toBe(true);
  expect(doc.details.size_bytes).toBeGreaterThan(10000);
  expect(doc.details.big).toBeUndefined();
});

test('auditSafe ما بيرميش خطأ حتى لو التسجيل فشل', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(auditSafe({ action: 'NOT_A_REAL_ACTION' })).resolves.toBeUndefined();
  await expect(auditSafe({ action: AUDIT.LOGIN_FAILED, details: { username: 'ahmed' } })).resolves.toBeUndefined();
  expect(await AuditLog.countDocuments({ action: 'LOGIN_FAILED' })).toBe(1);
  spy.mockRestore();
});

test('التعديل والمسح مرفوضين (append-only)', async () => {
  await audit({ action: AUDIT.CHECK_IN, actorStaffId: staffId });
  const doc = await AuditLog.findOne();
  await expect(AuditLog.updateOne({ _id: doc._id }, { action: 'X' }).exec()).rejects.toThrow('append-only');
  await expect(AuditLog.findOneAndUpdate({ _id: doc._id }, { action: 'X' }).exec()).rejects.toThrow('append-only');
  await expect(AuditLog.replaceOne({ _id: doc._id }, { action: 'X' }).exec()).rejects.toThrow('append-only');
  await expect(AuditLog.deleteOne({ _id: doc._id }).exec()).rejects.toThrow('append-only');
  await expect(AuditLog.deleteMany({}).exec()).rejects.toThrow('append-only');
  doc.action = 'X';
  await expect(doc.save()).rejects.toThrow('append-only');
  const fresh = await AuditLog.findOne().lean();
  expect(fresh.action).toBe('CHECK_IN');
  expect(await AuditLog.countDocuments()).toBe(1);
});