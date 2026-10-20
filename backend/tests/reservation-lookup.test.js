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
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Reservations Lookup & Stay Folio API (GET /reservations and GET /reservations/:id)', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();
  const uid = () => crypto.randomUUID();
  const toIsoDateTime = (s) => (s && s.length === 10 ? `${s}T12:00:00+03:00` : s);

  let token;
  let staff;
  let shift;

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  const createGuest = async (idNum = 'EG12345678') => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        name: 'أحمد محمود',
        phone: '01011223344',
        id_number: idNum,
      });
    expect(res.status).toBe(201);
    return res.body.guest_id;
  };

  const createRoom = (overrides = {}) =>
    Room.create({
      room_number: '501',
      room_type: 'deluxe',
      floor: 5,
      price_per_night: toPiastres(2000),
      half_day_price: toPiastres(800),
      status: 'available',
      ...overrides,
    });

  beforeEach(async () => {
    await Staff.deleteMany({});
    await Shift.deleteMany({});
    await Attendance.deleteMany({});
    await Room.deleteMany({});
    await RoomNight.deleteMany({});
    await Reservation.deleteMany({});
    await Payment.collection.deleteMany({});
    await Guest.deleteMany({});

    staff = await Staff.create({
      username: 'lookup_tester',
      name: 'Receptionist Lookup Tester',
      email: 'lookup.tester@hotel.com',
      password_hash: await argon2.hash(password),
      role: 'receptionist',
      default_shift_type: 'morning',
      is_active: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({ username: 'lookup_tester', password });
    expect(loginRes.status).toBe(200);
    token = loginRes.body.access_token;
    shift = loginRes.body.shift;
  });

  test('GET /reservations returns paginated reservations list', async () => {
    const guestId = await createGuest('EG11112222');
    const room = await createRoom({ room_number: '502' });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-18'),
      });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get('/api/v1/reservations')
      .set(auth());

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.meta.total).toBe(1);
    expect(listRes.body.data[0].reservation_id).toBe(createRes.body.reservation_id);
    expect(listRes.body.data[0].total_amount).toBe(6000);
    expect(listRes.body.data[0].remaining_amount).toBe(6000);
  });

  test('GET /reservations filters by status and room_id', async () => {
    const guestId = await createGuest('EG33334444');
    const room1 = await createRoom({ room_number: '503' });
    const room2 = await createRoom({ room_number: '504' });

    await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room1._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });

    await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room2._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });

    // Filter by room1 (503)
    const resRoom1 = await request(app)
      .get('/api/v1/reservations')
      .query({ room_id: '503' })
      .set(auth());

    expect(resRoom1.status).toBe(200);
    expect(resRoom1.body.data.length).toBe(1);
    expect(resRoom1.body.data[0].room_id).toBe(String(room1._id));

    // Filter by status confirmed
    const resConfirmed = await request(app)
      .get('/api/v1/reservations')
      .query({ status: 'confirmed' })
      .set(auth());

    expect(resConfirmed.status).toBe(200);
    expect(resConfirmed.body.data.length).toBe(2);
  });

  test('GET /reservations/:id returns complete ReservationDetail with guest, room, payments and stay folio', async () => {
    const guestId = await createGuest('EG55556666');
    const room = await createRoom({ room_number: '505' });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });
    const resId = createRes.body.reservation_id;

    // Record down payment
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: resId,
        amount: 1500,
        payment_method: 'instapay',
        notes: 'عربون حجز من العميل',
      });
    expect(payRes.status).toBe(201);

    // 1. Fetch by reservation_id
    const detailRes = await request(app)
      .get(`/api/v1/reservations/${resId}`)
      .set(auth());

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.reservation_id).toBe(resId);
    expect(detailRes.body.total_amount).toBe(4000);
    expect(detailRes.body.paid_amount).toBe(1500);
    expect(detailRes.body.remaining_amount).toBe(2500);

    // Check nested populated guest and room
    expect(detailRes.body.guest.name).toBe('أحمد محمود');
    expect(detailRes.body.guest.phone).toBe('+201011223344');
    expect(detailRes.body.room.room_number).toBe('505');

    // Check payments list
    expect(detailRes.body.payments.length).toBe(1);
    expect(detailRes.body.payments[0].amount).toBe(1500);
    expect(detailRes.body.payments[0].payment_method).toBe('instapay');

    // 2. Fetch by room number (505) directly!
    const roomDetailRes = await request(app)
      .get('/api/v1/reservations/505')
      .set('x-test-time', Cairo13)
      .set(auth());

    expect(roomDetailRes.status).toBe(200);
    expect(roomDetailRes.body.reservation_id).toBe(resId);
    expect(roomDetailRes.body.guest.name).toBe('أحمد محمود');
  });

  test('GET /reservations/:id returns 404 for non-existent reservation or room', async () => {
    const res = await request(app)
      .get('/api/v1/reservations/999')
      .set(auth());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('POST /reservations/:id/check-in allows checking in by room number directly', async () => {
    const guestId = await createGuest('EG77778888');
    const room = await createRoom({ room_number: '506' });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });
    const resId = createRes.body.reservation_id;

    // Record down payment
    await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: resId,
        amount: 1000,
        payment_method: 'cash',
      });

    // Check in by room number '506' directly!
    const checkInRes = await request(app)
      .post('/api/v1/reservations/506/check-in')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({});

    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.reservation_id).toBe(resId);
    expect(checkInRes.body.status).toBe('checked_in');

    const updatedRoom = await Room.findById(room._id);
    expect(updatedRoom.status).toBe('occupied');
  });

  test('POST /reservations/:id/check-in by room number handles early arrival before 12:00', async () => {
    const guestId = await createGuest('EG99990000');
    const room = await createRoom({ room_number: '507' });
    const Cairo09 = DateTime.fromISO(`${today}T09:00:00`, { zone: ZONE }).toISO();

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo09)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });
    const resId = createRes.body.reservation_id;

    // Record down payment
    await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo09)
      .send({
        reservation_id: resId,
        amount: 2000,
        payment_method: 'instapay',
      });

    // Check in at 09:00 AM by room number '507' with early_arrival: true
    const checkInRes = await request(app)
      .post('/api/v1/reservations/507/check-in')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo09)
      .send({ early_arrival: true });

    expect(checkInRes.status).toBe(200);
    expect(checkInRes.body.reservation_id).toBe(resId);
    expect(checkInRes.body.status).toBe('checked_in');
    expect(checkInRes.body.early_arrival).toBe(true);
    // 2 nights @ 2000 = 4000 + 800 half_day = 4800
    expect(checkInRes.body.total_amount).toBe(4800);
  });

  test('POST /reservations/:id/extend allows extending stay by room number directly', async () => {
    const guestId = await createGuest('EG12348888');
    const room = await createRoom({ room_number: '508' });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-18'),
      });
    const resId = createRes.body.reservation_id;

    // Record down payment
    await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: resId,
        amount: 2000,
        payment_method: 'cash',
      });

    // Check in
    await request(app)
      .post(`/api/v1/reservations/${resId}/check-in`)
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({});

    // Extend stay by room number '508' directly!
    const extRes = await request(app)
      .post('/api/v1/reservations/508/extend')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13);

    expect(extRes.status).toBe(200);
    expect(extRes.body.reservation_id).toBe(resId);
    expect(extRes.body.half_day_extensions).toBe(1);
    // 3 nights @ 2000 = 6000 + 800 half-day = 6800
    expect(extRes.body.total_amount).toBe(6800);
    expect(extRes.body.remaining_amount).toBe(4800); // 6800 - 2000 paid
  });

  test('POST /reservations/:id/extend by room number is blocked if another booking starts on checkout day', async () => {
    const guestId1 = await createGuest('EG11119999');
    const guestId2 = await createGuest('EG22229999');
    const room = await createRoom({ room_number: '509' });

    // Guest 1: today to 2026-10-18
    const createRes1 = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId1,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-18'),
      });
    const resId1 = createRes1.body.reservation_id;

    await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: resId1,
        amount: 1000,
        payment_method: 'cash',
      });

    await request(app)
      .post(`/api/v1/reservations/${resId1}/check-in`)
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({});

    // Guest 2 has a booking starting on 2026-10-18 (checkout day of Guest 1)
    await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId2,
        room_id: String(room._id),
        check_in: toIsoDateTime('2026-10-18'),
        check_out: toIsoDateTime('2026-10-20'),
      });

    // Guest 1 tries to extend by room number '509'
    const extConflictRes = await request(app)
      .post('/api/v1/reservations/509/extend')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13);

    expect(extConflictRes.status).toBe(409);
    expect(extConflictRes.body.error.message).toContain('Another booking starts that day');
  });

  test('POST /reservations/:id/check-out by room number is blocked if balance is remaining (409 BALANCE_DUE)', async () => {
    const guestId = await createGuest('EG55551111');
    const room = await createRoom({ room_number: '510' });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });
    const resId = createRes.body.reservation_id;

    // Partial payment: 1000 out of 4000
    await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: resId,
        amount: 1000,
        payment_method: 'cash',
      });

    // Check in
    await request(app)
      .post(`/api/v1/reservations/${resId}/check-in`)
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({});

    // Attempt check-out by room number '510' while balance is 3000 EGP
    const checkOutRes = await request(app)
      .post('/api/v1/reservations/510/check-out')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13);

    expect(checkOutRes.status).toBe(409);
    expect(checkOutRes.body.error.code).toBe('BALANCE_DUE');
    expect(checkOutRes.body.error.message).toContain('3000.00 EGP remaining');
  });

  test('POST /reservations/:id/check-out by room number succeeds after full payment, transitions room to cleaning and creates CleaningTask', async () => {
    const guestId = await createGuest('EG66662222');
    const room = await createRoom({ room_number: '511' });

    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: toIsoDateTime(today),
        check_out: toIsoDateTime('2026-10-17'),
      });
    const resId = createRes.body.reservation_id;

    // Full payment: 4000 EGP
    await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: resId,
        amount: 4000,
        payment_method: 'instapay',
      });

    // Check in
    await request(app)
      .post(`/api/v1/reservations/${resId}/check-in`)
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({});

    // Check out by room number '511' directly!
    const checkOutRes = await request(app)
      .post('/api/v1/reservations/511/check-out')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13);

    expect(checkOutRes.status).toBe(200);
    expect(checkOutRes.body.reservation_id).toBe(resId);
    expect(checkOutRes.body.status).toBe('checked_out');

    // Verify room status changed to 'cleaning'
    const updatedRoom = await Room.findById(room._id);
    expect(updatedRoom.status).toBe('cleaning');

    // Verify auto-generated CleaningTask
    const { CleaningTask } = require('../src/db/models');
    const task = await CleaningTask.findOne({ room_id: room._id });
    expect(task).not.toBeNull();
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('medium');
  });
});
