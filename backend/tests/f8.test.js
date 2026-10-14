const request = require('supertest');
const { randomUUID } = require('crypto');
const argon2 = require('argon2');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
  Shift,
  Attendance,
  Room,
  RoomNight,
  Reservation,
  Guest,
  Payment,
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 8: Payments', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const NOW = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();

  let passwordHash;
  let token;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const nextKey = () => randomUUID();
  

  const createGuest = async (id_number = 'AB12345678', phone = '01012345678') => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', NOW)
      .send({ name: 'Ahmed Mohamed', phone, id_number });
    expect(res.status).toBe(201);
    return res.body.guest_id;
  };

  const createRoom = (overrides = {}) =>
    Room.create({
      room_number: '101',
      room_type: 'double',
      floor: 1,
      description: 'Sea view',
      price_per_night: toPiastres(500),
      half_day_price: toPiastres(200),
      ...overrides,
    });

  const book = (body, key = nextKey()) =>
    request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('x-test-time', NOW)
      .set('Idempotency-Key', key)
      .send(body);

  // 2 nights x 500 = 1000 EGP
  const makeReservation = async (roomOverrides = {}, checkIn = '2026-10-15T12:00:00+03:00', checkOut = '2026-10-17T12:00:00+03:00') => {
    const guest_id = await createGuest(`ID${Date.now()}${Math.floor(Math.random() * 1e6)}`, `010${Math.floor(10000000 + Math.random() * 89999999)}`);
    const room = await createRoom(roomOverrides);
    const res = await book({
      guest_id,
      room_id: String(room._id),
      check_in: checkIn,
      check_out: checkOut,
    });
    expect(res.status).toBe(201);
    return { room, reservation_id: res.body.reservation_id, guest_id };
  };

  const pay = (body, key = nextKey(), headers = {}) =>
    request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('x-test-time', NOW)
      .set('Idempotency-Key', key)
      .set(headers)
      .send(body);

  beforeAll(async () => {
    passwordHash = await argon2.hash(password);
  });

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Shift.deleteMany({}),
      Attendance.deleteMany({}),
      Room.deleteMany({}),
      RoomNight.deleteMany({}),
      Reservation.deleteMany({}),
      Guest.deleteMany({}),
      Payment.collection.deleteMany({}), // الـ hooks بتمنع deleteMany العادية
      AuditLog.collection.deleteMany({}),
    ]);

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
      .set('x-test-time', NOW)
      .send({ username: 'ahmed_morning', password });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: status=${loginRes.status}, body=${loginRes.text}`);
    }
    token = loginRes.body.access_token;
  });

  test('records a deposit and returns the new totals', async () => {
    const { reservation_id } = await makeReservation();

    const res = await pay({ reservation_id, amount: 300, payment_method: 'cash', notes: 'Deposit' });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(300);
    expect(res.body.payment.payment_verified).toBe(false);
    expect(res.body.paid_amount).toBe(300);
    expect(res.body.remaining_amount).toBe(700);

    const saved = await Reservation.findById(reservation_id);
    expect(saved.paid_cache).toBe(30000);
    expect(await Payment.countDocuments({})).toBe(1);
  });

  test('allows paying the whole remaining amount, then rejects any more', async () => {
    const { reservation_id } = await makeReservation();

    const full = await pay({ reservation_id, amount: 1000, payment_method: 'instapay' });
    expect(full.status).toBe(201);
    expect(full.body.remaining_amount).toBe(0);

    const extra = await pay({ reservation_id, amount: 1, payment_method: 'cash' });
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects zero, negative, 3-decimal and over-remaining amounts', async () => {
    const { reservation_id } = await makeReservation();

    for (const amount of [0, -50, 10.123, 1000.01]) {
      const res = await pay({ reservation_id, amount, payment_method: 'cash' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }

    expect(await Payment.countDocuments({})).toBe(0);
    expect((await Reservation.findById(reservation_id)).paid_cache).toBe(0);
  });

  test('over-remaining message includes the remaining amount', async () => {
    const { reservation_id } = await makeReservation();
    const res = await pay({ reservation_id, amount: 2000, payment_method: 'cash' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('1000.00');
  });

  test('concurrent payments cannot exceed the remaining amount', async () => {
    const { reservation_id } = await makeReservation();

    const [a, b] = await Promise.all([
      pay({ reservation_id, amount: 700, payment_method: 'cash' }),
      pay({ reservation_id, amount: 700, payment_method: 'cash' }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);

    const saved = await Reservation.findById(reservation_id);
    expect(saved.paid_cache).toBe(70000);
    expect(await Payment.countDocuments({})).toBe(1);
  });

  test('same Idempotency-Key records one payment only', async () => {
    const { reservation_id } = await makeReservation();
    const key = nextKey();
    const body = { reservation_id, amount: 400, payment_method: 'cash' };

    const first = await pay(body, key);
    expect(first.status).toBe(201);

    const second = await pay(body, key);
    expect(second.status).toBe(201);
    expect(second.body.payment.payment_id).toBe(first.body.payment.payment_id);
    expect(second.headers['idempotent-replayed']).toBe('true');

    expect(await Payment.countDocuments({})).toBe(1);
    expect((await Reservation.findById(reservation_id)).paid_cache).toBe(40000);
  });

  test('pays by room_id for a confirmed reservation of the current stay day', async () => {
    const { room, reservation_id } = await makeReservation();

    const res = await pay({ room_id: String(room._id), amount: 250, payment_method: 'vodafone_cash' });

    expect(res.status).toBe(201);
    expect(res.body.payment.reservation_id).toBe(reservation_id);
    expect(res.body.remaining_amount).toBe(750);
  });

  test('pay by room_id with no matching reservation returns 404', async () => {
    const room = await createRoom();
    const res = await pay({ room_id: String(room._id), amount: 100, payment_method: 'cash' });
    expect(res.status).toBe(404);
  });

  test('pay with unknown reservation returns 404', async () => {
    const res = await pay({
      reservation_id: '6acdc9c681d42a01709fcb7a',
      amount: 100,
      payment_method: 'cash',
    });
    expect(res.status).toBe(404);
  });

  test('rejects an unsupported payment method', async () => {
    const { reservation_id } = await makeReservation();
    const res = await pay({ reservation_id, amount: 100, payment_method: 'card' });
    expect(res.status).toBe(400);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  test('rejects payment on a cancelled reservation', async () => {
    const { reservation_id } = await makeReservation();
    await Reservation.updateOne({ _id: reservation_id }, { status: 'cancelled' });

    const res = await pay({ reservation_id, amount: 100, payment_method: 'cash' });
    expect(res.status).toBe(409);
    expect(await Payment.countDocuments({})).toBe(0);
  });

  test('ignores shift_id and staff_id sent in the body', async () => {
    const { reservation_id } = await makeReservation();
    const staff = await Staff.findOne({ username: 'ahmed_morning' });
    const fakeId = '6acdc9c681d42a01709fcb7a';

    const res = await pay({
      reservation_id,
      amount: 100,
      payment_method: 'cash',
      shift_id: fakeId,
      staff_id: fakeId,
    });

    expect(res.status).toBe(201);
    expect(res.body.payment.staff_id).toBe(String(staff._id));
    expect(res.body.payment.shift_id).not.toBe(fakeId);
  });

  test('GET /payments returns only the current shift payments', async () => {
    const { reservation_id } = await makeReservation();
    await pay({ reservation_id, amount: 100, payment_method: 'cash' });

    // دفعة من وردية تانية (مدخلة مباشرة في الداتا بيز)
    const staff = await Staff.findOne({ username: 'ahmed_morning' });
    await Payment.collection.insertOne({
      reservation_id: new (require('mongoose').Types.ObjectId)(reservation_id),
      staff_id: staff._id,
      shift_id: new (require('mongoose').Types.ObjectId)(),
      amount: 5000,
      payment_method: 'cash',
      notes: '',
      payment_datetime: new Date(),
      payment_verified: false,
      reversal_of_payment_id: null,
      idempotency_key: null,
    });

    const res = await request(app)
      .get('/api/v1/payments')
      .set(auth())
      .set('x-test-time', NOW);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].amount).toBe(100);
    expect(res.body.meta.total).toBe(1);
  });

  test('GET /reservations/{id}/payments returns all payments with totals', async () => {
    const { reservation_id } = await makeReservation();
    await pay({ reservation_id, amount: 100, payment_method: 'cash' });
    await pay({ reservation_id, amount: 200, payment_method: 'instapay' });

    const res = await request(app)
      .get(`/api/v1/reservations/${reservation_id}/payments`)
      .set(auth())
      .set('x-test-time', NOW);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total_amount).toBe(1000);
    expect(res.body.paid_amount).toBe(300);
    expect(res.body.remaining_amount).toBe(700);
  });

  test('payments are append-only (update and delete are blocked)', async () => {
    const { reservation_id } = await makeReservation();
    await pay({ reservation_id, amount: 100, payment_method: 'cash' });

    await expect(Payment.updateOne({}, { amount: 1 })).rejects.toThrow(/append-only/);
    await expect(Payment.deleteOne({})).rejects.toThrow(/append-only/);
    await expect(Payment.deleteMany({})).rejects.toThrow(/append-only/);
  });

  test('without a token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Idempotency-Key', nextKey())
      .send({ reservation_id: '6acdc9c681d42a01709fcb7a', amount: 1, payment_method: 'cash' });
    expect(res.status).toBe(401);
  });
});