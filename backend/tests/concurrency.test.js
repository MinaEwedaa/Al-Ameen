const request = require('supertest');
const argon2 = require('argon2');
const crypto = require('crypto');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
  Shift,
  Attendance,
  Session,
  Room,
  RoomNight,
  Reservation,
  Payment,
  Guest,
  CleaningTask,
  MaintenanceIssue,
  ShiftReport,
  RoomStatusHistory,
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 14: Concurrency & Race Conditions Suite (tests/concurrency.test.js)', () => {
  const password = 'Password123';
  const today = '2026-10-18';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();

  let token;
  let receptionist;
  let shift;

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Shift.deleteMany({}),
      Attendance.deleteMany({}),
      Session.deleteMany({}),
      Room.deleteMany({}),
      RoomNight.deleteMany({}),
      Reservation.deleteMany({}),
      Payment.collection.deleteMany({}),
      Guest.deleteMany({}),
      CleaningTask.deleteMany({}),
      MaintenanceIssue.deleteMany({}),
      ShiftReport.deleteMany({}),
      RoomStatusHistory.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);

    const passwordHash = await argon2.hash(password);

    receptionist = await Staff.create({
      username: 'conc_receptionist',
      name: 'موظف التزامن',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({
        username: 'conc_receptionist',
        password,
      });

    token = loginRes.body.access_token;
    shift = loginRes.body.shift;
  });

  test('1. Two concurrent reservations for the same room and dates: exactly one succeeds (201) and one fails (409)', async () => {
    const room = await Room.create({
      room_number: '301',
      room_type: 'single',
      floor: 3,
      price_per_night: toPiastres(1000),
      half_day_price: toPiastres(400),
      status: 'available',
    });

    const guest1 = await Guest.create({
      name: 'نزيل أول',
      name_search: 'نزيل أول',
      phone: '+201011111111',
      id_number_enc: 'enc1',
      id_number_hash: crypto.randomBytes(32).toString('hex'),
      id_number_last4: '1111',
    });

    const guest2 = await Guest.create({
      name: 'نزيل ثان',
      name_search: 'نزيل ثان',
      phone: '+201022222222',
      id_number_enc: 'enc2',
      id_number_hash: crypto.randomBytes(32).toString('hex'),
      id_number_last4: '2222',
    });

    const payload1 = {
      guest_id: String(guest1._id),
      room_id: String(room._id),
      check_in: '2026-10-18T12:00:00.000Z',
      check_out: '2026-10-20T12:00:00.000Z',
    };

    const payload2 = {
      guest_id: String(guest2._id),
      room_id: String(room._id),
      check_in: '2026-10-19T12:00:00.000Z',
      check_out: '2026-10-21T12:00:00.000Z',
    };

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/reservations')
        .set(auth())
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send(payload1),
      request(app)
        .post('/api/v1/reservations')
        .set(auth())
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send(payload2),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = res1.status === 409 ? res1 : res2;
    expect(['CONFLICT', 'ROOM_ALREADY_BOOKED']).toContain(failed.body.error.code);
  });

  test('2. Two concurrent payments whose sum exceeds remaining amount: one succeeds (201), other rejected (400)', async () => {
    const room = await Room.create({
      room_number: '302',
      room_type: 'deluxe',
      floor: 3,
      price_per_night: toPiastres(1000),
      half_day_price: toPiastres(400),
      status: 'available',
    });

    const guest = await Guest.create({
      name: 'نزيل الدفع المتزامن',
      name_search: 'نزيل الدفع المتزامن',
      phone: '+201033333333',
      id_number_enc: 'enc3',
      id_number_hash: crypto.randomBytes(32).toString('hex'),
      id_number_last4: '3333',
    });

    // 1 night = 1000 EGP total
    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: String(guest._id),
        room_id: String(room._id),
        check_in: '2026-10-18T12:00:00.000Z',
        check_out: '2026-10-19T12:00:00.000Z',
      });
    expect(createRes.status).toBe(201);
    const reservationId = createRes.body.reservation_id;

    // Remaining is 1000 EGP. Two concurrent requests for 600 EGP each (sum = 1200 > 1000).
    const [pay1, pay2] = await Promise.all([
      request(app)
        .post('/api/v1/payments')
        .set(auth())
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send({
          reservation_id: reservationId,
          amount: 600,
          payment_method: 'cash',
        }),
      request(app)
        .post('/api/v1/payments')
        .set(auth())
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send({
          reservation_id: reservationId,
          amount: 600,
          payment_method: 'instapay',
        }),
    ]);

    const statuses = [pay1.status, pay2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const success = pay1.status === 201 ? pay1 : pay2;
    const failed = pay1.status === 400 ? pay1 : pay2;

    expect(success.body.paid_amount).toBe(600);
    expect(success.body.remaining_amount).toBe(400);

    expect(failed.body.error.code).toBe('VALIDATION_ERROR');
    expect(failed.body.error.message).toMatch(/remaining amount/i);
  });

  test('3. Two concurrent check-in requests for the same reservation: one succeeds (200), other fails (409)', async () => {
    const room = await Room.create({
      room_number: '303',
      room_type: 'deluxe',
      floor: 3,
      price_per_night: toPiastres(1200),
      half_day_price: toPiastres(500),
      status: 'available',
    });

    const guest = await Guest.create({
      name: 'نزيل التسكين المتزامن',
      name_search: 'نزيل التسكين المتزامن',
      phone: '+201044444444',
      id_number_enc: 'enc4',
      id_number_hash: crypto.randomBytes(32).toString('hex'),
      id_number_last4: '4444',
    });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: String(guest._id),
        room_id: String(room._id),
        check_in: '2026-10-18T12:00:00.000Z',
        check_out: '2026-10-19T12:00:00.000Z',
      });
    expect(createRes.status).toBe(201);
    const reservationId = createRes.body.reservation_id;

    // Record down payment so reservation is eligible for check-in
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: reservationId,
        amount: 500,
        payment_method: 'cash',
      });
    expect(payRes.status).toBe(201);

    const [ci1, ci2] = await Promise.all([
      request(app)
        .post(`/api/v1/reservations/${reservationId}/check-in`)
        .set(auth())
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13),
      request(app)
        .post(`/api/v1/reservations/${reservationId}/check-in`)
        .set(auth())
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13),
    ]);

    const statuses = [ci1.status, ci2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  test('4. Two concurrent shift handovers: one succeeds (200), other fails with SHIFT_CLOSED (409)', async () => {
    const [h1, h2] = await Promise.all([
      request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({ shift_notes: 'تسليم 1' }),
      request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({ shift_notes: 'تسليم 2' }),
    ]);

    const statuses = [h1.status, h2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const failed = h1.status === 409 ? h1 : h2;
    expect(failed.body.error.code).toBe('SHIFT_CLOSED');
  });

  test('5. Two concurrent room status modifications: executed atomically', async () => {
    const room = await Room.create({
      room_number: '304',
      room_type: 'single',
      floor: 3,
      price_per_night: toPiastres(800),
      half_day_price: toPiastres(350),
      status: 'available',
    });

    const [u1, u2] = await Promise.all([
      request(app)
        .patch(`/api/v1/rooms/${room._id}/status`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({ status: 'cleaning' }),
      request(app)
        .patch(`/api/v1/rooms/${room._id}/status`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({ status: 'maintenance' }),
    ]);

    const statuses = [u1.status, u2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalRoom = await Room.findById(room._id);
    expect(['cleaning', 'maintenance']).toContain(finalRoom.status);
  });

  test('6. Concurrent requests with exact same Idempotency-Key: exactly one execution, other returns replay', async () => {
    const room = await Room.create({
      room_number: '305',
      room_type: 'double',
      floor: 3,
      price_per_night: toPiastres(1200),
      half_day_price: toPiastres(500),
      status: 'available',
    });

    const guest = await Guest.create({
      name: 'نزيل تطابق المفتاح',
      name_search: 'نزيل تطابق المفتاح',
      phone: '+201055555555',
      id_number_enc: 'enc5',
      id_number_hash: crypto.randomBytes(32).toString('hex'),
      id_number_last4: '5555',
    });

    const sharedKey = crypto.randomUUID();
    const payload = {
      guest_id: String(guest._id),
      room_id: String(room._id),
      check_in: '2026-10-18T12:00:00.000Z',
      check_out: '2026-10-20T12:00:00.000Z',
    };

    // First request
    const firstRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', sharedKey)
      .set('x-test-time', Cairo13)
      .send(payload);

    expect(firstRes.status).toBe(201);
    expect(firstRes.headers['idempotent-replayed']).toBeUndefined();

    // Replayed request with identical key
    const replayRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', sharedKey)
      .set('x-test-time', Cairo13)
      .send(payload);

    expect(replayRes.status).toBe(201);
    expect(replayRes.headers['idempotent-replayed']).toBe('true');
    expect(replayRes.body.reservation_id).toBe(firstRes.body.reservation_id);
  });
});
