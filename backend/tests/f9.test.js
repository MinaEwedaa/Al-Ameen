const request = require('supertest');
const argon2 = require('argon2');
const crypto = require('crypto');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
  Shift,
  Attendance,
  Room,
  RoomNight,
  Reservation,
  Payment,
  Guest,
  CleaningTask,
  RoomStatusHistory,
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 9: Check-in, Extend, and Check-out', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();
  const Cairo09 = DateTime.fromISO(`${today}T09:00:00`, { zone: ZONE }).toISO();

  const uid = () => crypto.randomUUID();
  const toIsoDateTime = (s) => (s && s.length === 10 ? `${s}T14:00:00.000Z` : s);

  let token;
  let staff;
  let shift;

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  const createGuest = async (idNum = 'AB12345678') => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        name: 'كريم عادل',
        phone: '01098765432',
        id_number: idNum,
      });
    expect(res.status).toBe(201);
    return res.body.guest_id;
  };

  const createRoom = (overrides = {}) =>
    Room.create({
      room_number: '201',
      room_type: 'deluxe',
      floor: 2,
      price_per_night: toPiastres(1500),
      half_day_price: toPiastres(500),
      status: 'available',
      ...overrides,
    });

  const createBooking = async ({
    guest_id,
    room_id,
    check_in = '2026-10-15T14:00:00.000Z',
    check_out = '2026-10-18T11:00:00.000Z',
    key,
    nowTime,
  }) => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', key || uid())
      .set('x-test-time', nowTime || Cairo13)
      .send({
        guest_id,
        room_id,
        check_in: toIsoDateTime(check_in),
        check_out: toIsoDateTime(check_out),
      });
    if (res.status !== 201) {
      throw new Error(`Booking failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
  };

  const recordPayment = async (reservation_id, amount, key, nowTime) => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', key || uid())
      .set('x-test-time', nowTime || Cairo13)
      .send({
        reservation_id,
        amount,
        payment_method: 'cash',
      });
    if (res.status !== 201) {
      throw new Error(`Payment failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body;
  };

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Shift.deleteMany({}),
      Attendance.deleteMany({}),
      Room.deleteMany({}),
      RoomNight.deleteMany({}),
      Reservation.deleteMany({}),
      Payment.collection.deleteMany({}),
      Guest.deleteMany({}),
      CleaningTask.deleteMany({}),
      RoomStatusHistory.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);

    const passwordHash = await argon2.hash(password);
    staff = await Staff.create({
      username: 'reception_f9',
      name: 'Receptionist F9',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({ username: 'reception_f9', password });

    expect(loginRes.status).toBe(200);
    token = loginRes.body.access_token;
    shift = loginRes.body.shift;
  });

  describe('Check-in (POST /api/v1/reservations/:id/check-in)', () => {
    test('check-in without any payment is blocked with 409 PAYMENT_REQUIRED', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
      expect(res.body.error.message).toContain('Record at least one payment before check-in');

      // Verify room remains available
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('available');
    });

    test('check-in with payment succeeds, sets occupied, writes status history and audit', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      // Pay deposit (e.g. 1500 EGP)
      await recordPayment(booking.reservation_id, 1500);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('checked_in');
      expect(res.body.early_arrival).toBe(false);
      expect(res.body.check_in_staff_id).toBe(String(staff._id));
      expect(res.body.check_in_shift_id).toBe(String(shift.shift_id));

      // Verify room is occupied
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('occupied');

      // Verify RoomStatusHistory recorded
      const history = await RoomStatusHistory.findOne({ room_id: room._id });
      expect(history).toBeDefined();
      expect(history.status).toBe('occupied');

      // Verify AuditLog recorded
      const auditLog = await AuditLog.findOne({
        action: 'CHECK_IN',
        entity_id: booking.reservation_id,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.actor_staff_id).toEqual(staff._id);
    });

    test('check-in fails with 409 if room is currently in cleaning or maintenance', async () => {
      const guestId = await createGuest();
      const room = await createRoom({ status: 'cleaning' });
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      await recordPayment(booking.reservation_id, 1000);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('cleaning');
    });

    test('early arrival at 09:00 on check-in day without early_arrival: true throws 409', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      await recordPayment(booking.reservation_id, 1000);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo09)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Guest arrived before scheduled time');
    });

    test('early arrival at 09:00 with early_arrival: true adds half_day_price to total_amount', async () => {
      const guestId = await createGuest();
      const room = await createRoom(); // price 1500, half_day 500
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18', // 3 nights -> 4500 EGP
      });
      expect(booking.total_amount).toBe(4500);

      await recordPayment(booking.reservation_id, 1000);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo09)
        .send({ early_arrival: true });

      expect(res.status).toBe(200);
      expect(res.body.early_arrival).toBe(true);
      // 4500 + 500 = 5000 EGP
      expect(res.body.total_amount).toBe(5000);
      expect(res.body.remaining_amount).toBe(4000);
    });

    test('early_arrival: true after 12:00 PM returns 409 CONFLICT', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      await recordPayment(booking.reservation_id, 1000);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13) // 13:00 is after 12:00
        .send({ early_arrival: true });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Arrival is not early');
    });

    test('arrival days before check-in date returns 409 CONFLICT', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: '2026-10-20', // in future
        check_out: '2026-10-23',
      });

      await recordPayment(booking.reservation_id, 1000);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Too early');
    });

    test('arrival at 03:00 AM on booking that started yesterday at 12:00 succeeds as normal check-in', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      // booking started yesterday
      const yesterday = '2026-10-14';
      const CairoYesterday12 = DateTime.fromISO(`${yesterday}T12:00:00`, { zone: ZONE }).toISO();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: yesterday,
        check_out: '2026-10-17',
        nowTime: CairoYesterday12,
      });

      await recordPayment(booking.reservation_id, 1000, undefined, CairoYesterday12);

      // Guest arrives at 03:00 AM today (15 hours after yesterday 12:00 PM start)
      const Cairo03 = DateTime.fromISO(`${today}T03:00:00`, { zone: ZONE }).toISO();
      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo03)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('checked_in');
      expect(res.body.early_arrival).toBe(false);
      // No extra charge
      expect(res.body.total_amount).toBe(4500);
    });

    test('check-in is idempotent: second call with same key returns original response with Idempotent-Replayed: true', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      await recordPayment(booking.reservation_id, 1000);

      const key = uid();
      const res1 = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', key)
        .set('x-test-time', Cairo13)
        .send({});

      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', key)
        .set('x-test-time', Cairo13)
        .send({});

      expect(res2.status).toBe(200);
      expect(res2.headers['idempotent-replayed']).toBe('true');
      expect(res2.body.status).toBe('checked_in');
    });
  });

  describe('Extend Stay (POST /api/v1/reservations/:id/extend)', () => {
    test('extend increments half_day_extensions and adds half_day_price to total', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });
      await recordPayment(booking.reservation_id, 1500);

      // Check in first
      await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      // First extension
      const extRes1 = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/extend`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);

      expect(extRes1.status).toBe(200);
      expect(extRes1.body.half_day_extensions).toBe(1);
      expect(extRes1.body.total_amount).toBe(5000); // 4500 + 500
      expect(extRes1.body.remaining_amount).toBe(3500); // 5000 - 1500

      // Second extension
      const extRes2 = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/extend`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);

      expect(extRes2.status).toBe(200);
      expect(extRes2.body.half_day_extensions).toBe(2);
      expect(extRes2.body.total_amount).toBe(5500); // 4500 + 1000
    });

    test('extend is blocked with 409 if another booking starts on checkout day', async () => {
      const guestId1 = await createGuest('AB11111111');
      const guestId2 = await createGuest('CD22222222');
      const room = await createRoom();

      // Guest 1: 2026-10-15 to 2026-10-18
      const booking1 = await createBooking({
        guest_id: guestId1,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });
      await recordPayment(booking1.reservation_id, 1000);
      await request(app)
        .post(`/api/v1/reservations/${booking1.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      // Guest 2 has a booking starting on 2026-10-18 (checkout day of Guest 1)
      await createBooking({
        guest_id: guestId2,
        room_id: String(room._id),
        check_in: '2026-10-18',
        check_out: '2026-10-20',
      });

      // Guest 1 tries to extend past 12:00 on checkout day
      const extRes = await request(app)
        .post(`/api/v1/reservations/${booking1.reservation_id}/extend`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);

      expect(extRes.status).toBe(409);
      expect(extRes.body.error.code).toBe('CONFLICT');
      expect(extRes.body.error.message).toContain('Another booking starts that day');
    });
  });

  describe('Check-out (POST /api/v1/reservations/:id/check-out)', () => {
    test('check-out with remaining unpaid balance is blocked with 409 BALANCE_DUE', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18', // total 4500
      });

      // Pay 2000 (leaves 2500 balance due)
      await recordPayment(booking.reservation_id, 2000);
      await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-out`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BALANCE_DUE');
      expect(res.body.error.message).toContain('2500.00 EGP remaining');

      // Room remains occupied
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('occupied');
    });

    test('check-out after full payment succeeds, sets room to cleaning, creates pending CleaningTask and audit', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18', // total 4500
      });

      // Pay 1500 deposit
      await recordPayment(booking.reservation_id, 1500);
      await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      // Pay remaining 3000
      await recordPayment(booking.reservation_id, 3000);

      const res = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-out`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('checked_out');
      expect(res.body.check_out_staff_id).toBe(String(staff._id));
      expect(res.body.check_out_shift_id).toBe(String(shift.shift_id));

      // Room status set to cleaning
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('cleaning');

      // Cleaning task created
      const task = await CleaningTask.findOne({ room_id: room._id });
      expect(task).toBeDefined();
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
      expect(task.cleaner_name).toBeNull();
      expect(task.assigned_by_staff_id).toBeNull();

      // Room status history recorded
      const history = await RoomStatusHistory.findOne({
        room_id: room._id,
        status: 'cleaning',
      });
      expect(history).toBeDefined();

      // Audit log recorded
      const auditLog = await AuditLog.findOne({
        action: 'CHECK_OUT',
        entity_id: booking.reservation_id,
      });
      expect(auditLog).toBeDefined();
    });

    test('check-out called twice returns 409 CONFLICT', async () => {
      const guestId = await createGuest();
      const room = await createRoom();
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-18',
      });

      await recordPayment(booking.reservation_id, 4500);
      await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      const res1 = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-out`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-out`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Full Operational Cycle', () => {
    test('guest -> room -> booking -> payment -> check-in -> extend -> pay remainder -> check-out -> cleaning task verified', async () => {
      // 1. Guest
      const guestId = await createGuest('FULLCYCLE1234');
      // 2. Room
      const room = await createRoom({ room_number: '305' });
      // 3. Booking (2 nights: 3000 EGP)
      const booking = await createBooking({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: today,
        check_out: '2026-10-17',
      });
      expect(booking.total_amount).toBe(3000);

      // 4. Initial Payment (1000 EGP deposit)
      await recordPayment(booking.reservation_id, 1000);

      // 5. Check-in
      const cinRes = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});
      expect(cinRes.status).toBe(200);
      expect(cinRes.body.status).toBe('checked_in');

      // 6. Extend Stay (adds 500 EGP -> total 3500, remaining 2500)
      const extRes = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/extend`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);
      expect(extRes.status).toBe(200);
      expect(extRes.body.total_amount).toBe(3500);
      expect(extRes.body.remaining_amount).toBe(2500);

      // 7. Settle remaining 2500 balance
      await recordPayment(booking.reservation_id, 2500);

      // 8. Check-out
      const coutRes = await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-out`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);
      expect(coutRes.status).toBe(200);
      expect(coutRes.body.status).toBe('checked_out');

      // 9. Verify room is in cleaning status
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('cleaning');

      // 10. Verify cleaning task created for housekeeping
      const task = await CleaningTask.findOne({ room_id: room._id });
      expect(task).toBeDefined();
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('medium');
    });
  });
});
