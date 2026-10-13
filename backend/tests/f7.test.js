const request = require('supertest');
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
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 7: Reservations', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const NOW = DateTime.fromISO(`${today}T13:00:00`, {
    zone: ZONE,
  }).toISO();

  let passwordHash;
  let token;

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  const createGuest = async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', NOW)
      .send({
        name: 'أحمد محمد',
        phone: '01012345678',
        id_number: 'AB12345678',
      });
    expect(res.status).toBe(201);
    return res.body.guest_id;
  };

  const createRoom = (overrides = {}) =>
    Room.create({
      room_number: '101',
      room_type: 'double',
      floor: 1,
      description: 'Sea view',
      price_per_night: toPiastres(1500),
      half_day_price: toPiastres(500),
      ...overrides,
    });

  const book = (body, key) =>
    request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('x-test-time', NOW)
      .set('Idempotency-Key', key)
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
      .send({
        username: 'ahmed_morning',
        password,
      });

    if (loginRes.status !== 200) {
      throw new Error(
        `Login failed: status=${loginRes.status}, body=${loginRes.text}`
      );
    }

    token = loginRes.body.access_token;
  });

  test('creates a reservation and reserves each night', async () => {
    const guest_id = await createGuest();
    const room = await createRoom();

    const reservationRes = await book(
      {
        guest_id,
        room_id: String(room._id),
        check_in: '2026-10-15T14:00:00.000Z',
        check_out: '2026-10-17T11:00:00.000Z',
      },
      '3f2b8c1e-5a47-4d9e-9b6a-1c2d3e4f5a6b'
    );

    expect(reservationRes.status).toBe(201);
    expect(reservationRes.body.reservation_id).toBeDefined();
    expect(reservationRes.body.guest_id).toBe(guest_id);
    expect(reservationRes.body.room_id).toBe(String(room._id));
    expect(reservationRes.body.status).toBe('confirmed');
    expect(reservationRes.body.total_amount).toBe(3000);
    expect(reservationRes.body.paid_amount).toBe(0);
    expect(reservationRes.body.remaining_amount).toBe(3000);

    const saved = await Reservation.findById(
      reservationRes.body.reservation_id
    );

    expect(saved).not.toBeNull();
    expect(saved.nights).toBe(2);

    const roomNights = await RoomNight.find({
      reservation_id: saved._id,
    });

    expect(roomNights).toHaveLength(2);
  });

  test('rejects a reservation with check_in in the past', async () => {
    const guest_id = await createGuest();
    const room = await createRoom();

    const res = await book(
      {
        guest_id,
        room_id: String(room._id),
        check_in: '2026-10-14T12:00:00+03:00',
        check_out: '2026-10-16T12:00:00+03:00',
      },
      '7c1d9a52-8e3b-4f60-a2d4-5b6c7d8e9f01'
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Reservation.countDocuments({})).toBe(0);
  });

  test('rejects check_out that is not after check_in', async () => {
    const guest_id = await createGuest();
    const room = await createRoom();

    const res = await book(
      {
        guest_id,
        room_id: String(room._id),
        check_in: '2026-10-16T12:00:00+03:00',
        check_out: '2026-10-16T12:00:00+03:00',
      },
      'a1b2c3d4-0001-4000-8000-000000000001'
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await Reservation.countDocuments({})).toBe(0);
  });

  test('rejects a room under maintenance', async () => {
    const guest_id = await createGuest();
    const room = await createRoom({ status: 'maintenance' });

    const res = await book(
      {
        guest_id,
        room_id: String(room._id),
        check_in: '2026-10-16T12:00:00+03:00',
        check_out: '2026-10-18T12:00:00+03:00',
      },
      'a1b2c3d4-0002-4000-8000-000000000002'
    );

    expect(res.status).toBe(409);
    expect(await Reservation.countDocuments({})).toBe(0);
  });

  test('rejects double booking of the same room and dates', async () => {
    const guest_id = await createGuest();
    const room = await createRoom();
    const body = {
      guest_id,
      room_id: String(room._id),
      check_in: '2026-10-16T12:00:00+03:00',
      check_out: '2026-10-18T12:00:00+03:00',
    };

    const first = await book(body, 'a1b2c3d4-0003-4000-8000-000000000003');
    expect(first.status).toBe(201);

    const second = await book(body, 'a1b2c3d4-0004-4000-8000-000000000004');
    expect(second.status).toBe(409);

    expect(await Reservation.countDocuments({})).toBe(1);
    expect(await RoomNight.countDocuments({})).toBe(2);
  });

  test('replays the same response for the same Idempotency-Key', async () => {
    const guest_id = await createGuest();
    const room = await createRoom();
    const body = {
      guest_id,
      room_id: String(room._id),
      check_in: '2026-10-16T12:00:00+03:00',
      check_out: '2026-10-18T12:00:00+03:00',
    };
    const key = 'a1b2c3d4-0005-4000-8000-000000000005';

    const first = await book(body, key);
    expect(first.status).toBe(201);

    const second = await book(body, key);
    expect(second.status).toBe(201);
    expect(second.body.reservation_id).toBe(first.body.reservation_id);
    expect(second.headers['idempotent-replayed']).toBe('true');

    expect(await Reservation.countDocuments({})).toBe(1);
  });
});
