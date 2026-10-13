
const request = require('supertest');
const argon2 = require('argon2');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
  Guest,
  Shift,
  ShiftException,
  Attendance,
  Payment,
  Reservation,
  CleaningTask,
  MaintenanceIssue,
  Room,
  ShiftReport,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { decrypt } = require('../src/utils/crypto');

const password = 'Password123';
const today = '2026-10-15';

const loginTime = DateTime.fromISO(`${today}T07:10:00`, {
  zone: ZONE,
}).toISO();

describe('F6 Guests API', () => {
  let token;

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Guest.deleteMany({}),
      Shift.deleteMany({}),
      ShiftException.deleteMany({}),
      Attendance.deleteMany({}),
      Payment.deleteMany({}),
      Reservation.deleteMany({}),
      CleaningTask.deleteMany({}),
      MaintenanceIssue.deleteMany({}),
      Room.deleteMany({}),
      ShiftReport.deleteMany({}),
    ]);

    const passwordHash = await argon2.hash(password);

    await Staff.create({
      username: 'ahmed_morning',
      name: 'Ahmed Morning',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', loginTime)
      .send({
        username: 'ahmed_morning',
        password,
      });

    if (loginRes.status !== 200) {
      throw new Error(
        `Login failed: status=${loginRes.status}, text=${loginRes.text}`
      );
    }

    token = loginRes.body.access_token;
  });

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  const testGuest = {
    name: 'أَحْمَد مُحَمَّد',
    phone: '01012345678',
    id_number: 'AB12345678',
  };

  test('creates a guest and returns only a masked ID number', async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);
      if (res.status !== 201) {
  throw new Error(
    `Create guest failed: status=${res.status}, body=${res.text}`
  );
}

    expect(res.status).toBe(201);
    expect(res.body.guest_id).toBeDefined();
    expect(res.body.name).toBe(testGuest.name);
    expect(res.body.id_number).toBe('**********5678');
    expect(res.body.id_number_enc).toBeUndefined();
    expect(res.body.id_number_hash).toBeUndefined();

    const saved = await Guest.findById(res.body.guest_id);

    expect(saved).not.toBeNull();
    expect(saved.id_number_enc).not.toBe(testGuest.id_number);
    expect(decrypt(saved.id_number_enc)).toBe(testGuest.id_number);
  });

  test('rejects a duplicate ID number, including Arabic digits', async () => {
    const first = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send({
        ...testGuest,
        name: 'ضيف آخر',
        id_number: 'AB١٢٣٤٥٦٧٨',
      });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
    expect(second.body.error.guest_id).toBe(first.body.guest_id);
  });

  test('searches by normalized Arabic name', async () => {
    const created = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);

    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/guests')
      .set(auth())
      .query({ name: 'احمد محمد' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.guests[0].guest_id).toBe(created.body.guest_id);
  });

  test('searches by phone using Arabic digits', async () => {
    const created = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);

    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/guests')
      .set(auth())
      .query({ phone: '٠١٠١٢٣٤٥٦٧٨' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.guests[0].guest_id).toBe(created.body.guest_id);
  });

  test('requires at least one search filter', async () => {
    const res = await request(app)
      .get('/api/v1/guests')
      .set(auth());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('searches by exact ID number only', async () => {
    const created = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);

    expect(created.status).toBe(201);

    const exact = await request(app)
      .get('/api/v1/guests')
      .set(auth())
      .query({ id_number: 'AB12345678' });

    expect(exact.status).toBe(200);
    expect(exact.body.total).toBe(1);

    const partial = await request(app)
      .get('/api/v1/guests')
      .set(auth())
      .query({ id_number: 'AB1234' });

    expect(partial.status).toBe(400);
  });

  test('removes bidirectional override characters from names', async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send({
        ...testGuest,
        name: 'Ahmed\u202E123',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).not.toContain('\u202E');
  });

  test('does not treat regex input as a pattern', async () => {
    const created = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);

    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/v1/guests')
      .set(auth())
      .query({ name: '.*' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test('gets a guest by ID without exposing encrypted fields', async () => {
    const created = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', loginTime)
      .send(testGuest);

    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/v1/guests/${created.body.guest_id}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.id_number).toBe('**********5678');
    expect(res.body.id_number_enc).toBeUndefined();
    expect(res.body.id_number_hash).toBeUndefined();
  });
});
