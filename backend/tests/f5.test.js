const request = require('supertest');
const argon2 = require('argon2');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
  Shift,
  Attendance,
  Room,
  RoomNight,
  Reservation,
  RoomStatusHistory,
  MaintenanceIssue,
  Payment,
  Guest,
  AuditLog,
} = require('../src/db/models');
const { ZONE, noonCairo, stayDays } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 5: Rooms & Dashboard', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const at = (hhmm) => DateTime.fromISO(`${today}T${hhmm}:00`, { zone: ZONE }).toISO();
  const NOW = at('13:00');

  let passwordHash;
  let token;
  let shiftId;
  let staff;

  const get = (url, tok = token, time = NOW) =>
    request(app).get(url).set('Authorization', `Bearer ${tok}`).set('x-test-time', time);
  const patch = (url, body, tok = token, time = NOW) =>
    request(app)
      .patch(url)
      .set('Authorization', `Bearer ${tok}`)
      .set('x-test-time', time)
      .send(body);

  const makeStaff = (username, type) =>
    Staff.create({
      username,
      name: username,
      password_hash: passwordHash,
      default_shift_type: type,
      role: 'receptionist',
      active: true,
    });
  const login = (username, time) =>
    request(app).post('/api/v1/auth/login').set('x-test-time', time).send({ username, password });

  const makeRoom = (over = {}) =>
    Room.create({
      room_number: '101',
      room_type: 'double',
      floor: 1,
      description: 'Sea view',
      price_per_night: toPiastres(1500),
      half_day_price: toPiastres(500),
      ...over,
    });

  const makeReservation = async (room, inDay, nights, status = 'confirmed', guestId) => {
    const outDay = DateTime.fromISO(inDay).plus({ days: nights }).toFormat('yyyy-MM-dd');
    const r = await Reservation.create({
      guest_id: guestId || new mongoose.Types.ObjectId(),
      room_id: room._id,
      check_in_at: noonCairo(inDay),
      check_out_at: noonCairo(outDay),
      nights,
      status,
      price_per_night_snapshot: room.price_per_night,
      half_day_price_snapshot: room.half_day_price,
      total_amount: nights * room.price_per_night,
    });
    await RoomNight.insertMany(
      stayDays(inDay, nights).map((day) => ({ room_id: room._id, day, reservation_id: r._id }))
    );
    return r;
  };

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
      RoomStatusHistory.deleteMany({}),
      MaintenanceIssue.deleteMany({}),
      Guest.deleteMany({}),
      Payment.collection.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);

    staff = await makeStaff('ahmed_morning', 'morning');
    const res = await login('ahmed_morning', NOW);
    expect(res.status).toBe(200);
    token = res.body.access_token;
    shiftId = res.body.shift.shift_id;
  });

  test('rooms and dashboard require authentication (401)', async () => {
    const r1 = await request(app).get('/api/v1/rooms');
    expect(r1.status).toBe(401);
    expect(r1.body.error.code).toBe('UNAUTHORIZED');
    const r2 = await request(app).get('/api/v1/dashboard');
    expect(r2.status).toBe(401);
  });

  test('GET /rooms returns DTOs: string ids, prices in EGP, sorted by room number', async () => {
    await makeRoom({ room_number: '205', floor: 2, room_type: 'suite' });
    await makeRoom({ room_number: '101', view: 'garden' });

    const res = await get('/api/v1/rooms');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(res.body.data.map((r) => r.room_number)).toEqual(['101', '205']);
    const r = res.body.data[0];
    expect(typeof r.room_id).toBe('string');
    expect(r.floor).toBe(1);
    expect(r.view).toBe('garden');
    expect(r.price_per_night).toBe(1500);
    expect(r.half_day_price).toBe(500);
    expect(r.status).toBe('available');
    expect(r.current_guest_name).toBeNull();
  });

  test('GET /rooms filters by status and room_type and paginates', async () => {
    await makeRoom({ room_number: '101' });
    await makeRoom({ room_number: '102', status: 'maintenance' });
    await makeRoom({ room_number: '103', room_type: 'suite' });

    const m = await get('/api/v1/rooms?status=maintenance');
    expect(m.body.data.map((r) => r.room_number)).toEqual(['102']);
    expect(m.body.meta.total).toBe(1);

    const s = await get('/api/v1/rooms?room_type=suite');
    expect(s.body.data.map((r) => r.room_number)).toEqual(['103']);

    const p = await get('/api/v1/rooms?page=2&limit=2');
    expect(p.body.data).toHaveLength(1);
    expect(p.body.meta).toEqual({ page: 2, limit: 2, total: 3 });

    const bad = await get('/api/v1/rooms?status=banana');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('reserved is derived from a confirmed reservation on the current stay day, not stored', async () => {
    const room = await makeRoom();
    const resv = await makeReservation(room, today, 1);

    const a = await get(`/api/v1/rooms/${room._id}`);
    expect(a.body.status).toBe('reserved');
    expect((await Room.findById(room._id)).status).toBe('available'); // مش متخزنة

    await Reservation.updateOne({ _id: resv._id }, { status: 'cancelled' });
    const b = await get(`/api/v1/rooms/${room._id}`);
    expect(b.body.status).toBe('available');
  });

  test('occupied room shows current_guest_name from the checked-in reservation', async () => {
    const room = await makeRoom({ status: 'occupied' });
    const { insertedId } = await Guest.collection.insertOne({ name: 'أحمد محمد' });
    await makeReservation(room, today, 1, 'checked_in', insertedId);

    const res = await get(`/api/v1/rooms/${room._id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('occupied');
    expect(res.body.current_guest_name).toBe('أحمد محمد');
  });

  test('GET /rooms/:id returns 404 for unknown or malformed ids', async () => {
    const unknown = await get(`/api/v1/rooms/${new mongoose.Types.ObjectId()}`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    const bad = await get('/api/v1/rooms/not-an-id');
    expect(bad.status).toBe(404);
  });

  test('availability excludes booked rooms and maintenance rooms', async () => {
    const a = await makeRoom({ room_number: '101' });
    await makeRoom({ room_number: '102' });
    await makeRoom({ room_number: '103', status: 'maintenance' });
    await makeReservation(a, '2026-10-20', 3); // الأيام 20 و21 و22

    const res = await get(
      '/api/v1/rooms/availability?check_in=' +
        encodeURIComponent('2026-10-21T12:00:00+03:00') +
        '&check_out=' +
        encodeURIComponent('2026-10-23T12:00:00+03:00')
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.room_number)).toEqual(['102']);
  });

  test('availability allows a booking that starts on another booking checkout day', async () => {
    const a = await makeRoom({ room_number: '101' });
    await makeReservation(a, '2026-10-20', 3); // يوم الخروج 23

    const res = await get(
      '/api/v1/rooms/availability?check_in=' +
        encodeURIComponent('2026-10-23T12:00:00+03:00') +
        '&check_out=' +
        encodeURIComponent('2026-10-24T12:00:00+03:00')
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.room_number)).toEqual(['101']);
  });

  test('availability rejects check_out <= check_in and missing params with 400', async () => {
    const same = await get(
      '/api/v1/rooms/availability?check_in=' +
        encodeURIComponent('2026-10-23T12:00:00+03:00') +
        '&check_out=' +
        encodeURIComponent('2026-10-23T12:00:00+03:00')
    );
    expect(same.status).toBe(400);
    expect(same.body.error.code).toBe('VALIDATION_ERROR');

    const missing = await get(
      '/api/v1/rooms/availability?check_in=' + encodeURIComponent('2026-10-23T12:00:00+03:00')
    );
    expect(missing.status).toBe(400);
  });

  test('PATCH status: available -> maintenance writes history (shift + notes) and audit', async () => {
    const room = await makeRoom();
    const res = await patch(`/api/v1/rooms/${room._id}/status`, {
      status: 'maintenance',
      notes: 'AC leaking',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('maintenance');
    expect(res.body.notes).toBe('AC leaking');
    expect(res.body.room_id).toBe(String(room._id));
    expect(res.body.shift_id).toBe(shiftId);
    expect(typeof res.body.history_id).toBe('string');

    expect((await Room.findById(room._id)).status).toBe('maintenance');
    const hist = await RoomStatusHistory.find({ room_id: room._id });
    expect(hist).toHaveLength(1);
    expect(String(hist[0].staff_id)).toBe(String(staff._id));

    const audits = await AuditLog.find({ action: 'ROOM_STATUS_CHANGED' });
    expect(audits).toHaveLength(1);
    expect(audits[0].entity_id).toBe(String(room._id));
  });

  test('PATCH status: every forbidden transition returns 409 INVALID_STATUS_TRANSITION', async () => {
    const occupied = await makeRoom({ room_number: '301', status: 'occupied' });
    const reserved = await makeRoom({ room_number: '302' });
    await makeReservation(reserved, today, 1);
    const maint = await makeRoom({ room_number: '303', status: 'maintenance' });

    const cases = [
      [occupied, 'available'],
      [occupied, 'cleaning'],
      [reserved, 'cleaning'],
      [reserved, 'maintenance'],
      [maint, 'maintenance'], // نفس الحالة
    ];
    for (const [room, status] of cases) {
      const res = await patch(`/api/v1/rooms/${room._id}/status`, { status });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    }
    expect(await RoomStatusHistory.countDocuments({})).toBe(0);
  });

  test('PATCH status: reserved/occupied in the body are rejected with 400', async () => {
    const room = await makeRoom();
    for (const status of ['reserved', 'occupied', 'banana']) {
      const res = await patch(`/api/v1/rooms/${room._id}/status`, { status });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('PATCH status: notes are sanitized (hidden bidi characters removed)', async () => {
    const room = await makeRoom();
    const res = await patch(`/api/v1/rooms/${room._id}/status`, {
      status: 'cleaning',
      notes: 'AC\u202E leak',
    });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('AC leak');
  });

  test('PATCH status from a read-only session returns 403 FORBIDDEN', async () => {
    await makeStaff('omar_night', 'night');
    const ro = await login('omar_night', at('22:40')); // قبل بداية الليلي بـ 20 دقيقة
    expect(ro.status).toBe(200);
    expect(ro.body.read_only).toBe(true);

    const room = await makeRoom();
    const res = await patch(
      `/api/v1/rooms/${room._id}/status`,
      { status: 'cleaning' },
      ro.body.access_token,
      at('22:45')
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await Room.findById(room._id)).status).toBe('available');
  });

  test('PATCH status: two concurrent requests, one wins and one gets 409', async () => {
    const room = await makeRoom();
    const url = `/api/v1/rooms/${room._id}/status`;
    const results = await Promise.all([
      patch(url, { status: 'maintenance' }),
      patch(url, { status: 'maintenance' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await RoomStatusHistory.countDocuments({ room_id: room._id })).toBe(1);
  });

  test('PATCH status returns 404 for an unknown room', async () => {
    const res = await patch(`/api/v1/rooms/${new mongoose.Types.ObjectId()}/status`, {
      status: 'cleaning',
    });
    expect(res.status).toBe(404);
  });

  test('GET status-history is newest first and paginated', async () => {
    const room = await makeRoom();
    const url = `/api/v1/rooms/${room._id}/status`;
    await patch(url, { status: 'cleaning' }, token, at('13:00'));
    await patch(url, { status: 'available', notes: 'done' }, token, at('13:10'));

    const res = await get(`/api/v1/rooms/${room._id}/status-history`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map((h) => h.status)).toEqual(['available', 'cleaning']);
    expect(res.body.data[0].notes).toBe('done');
    expect(res.body.data[1].notes).toBeNull();
  });

  test('GET status-history returns 404 for an unknown room', async () => {
    const res = await get(`/api/v1/rooms/${new mongoose.Types.ObjectId()}/status-history`);
    expect(res.status).toBe(404);
  });

  test('GET /dashboard counts derived statuses, open issues and current-shift payments', async () => {
    await makeRoom({ room_number: '101' }); // available
    const r2 = await makeRoom({ room_number: '102' });
    await makeReservation(r2, today, 1); // reserved
    await makeRoom({ room_number: '103', status: 'cleaning' });
    const r4 = await makeRoom({ room_number: '104', status: 'maintenance' });
    await makeRoom({ room_number: '105', status: 'occupied' });

    await MaintenanceIssue.create({ room_id: r4._id, problem: 'AC', status: 'open' });
    await MaintenanceIssue.create({ room_id: r4._id, problem: 'Lamp', status: 'resolved' });

    const resvId = new mongoose.Types.ObjectId();
    const base = { reservation_id: resvId, staff_id: staff._id, payment_datetime: new Date() };
    await Payment.create({ ...base, shift_id: shiftId, amount: 100000, payment_method: 'cash' });
    await Payment.create({ ...base, shift_id: shiftId, amount: 50000, payment_method: 'instapay' });
    await Payment.create({
      ...base,
      shift_id: new mongoose.Types.ObjectId(), // وردية تانية: ما تتحسبش
      amount: 99900,
      payment_method: 'cash',
    });

    const res = await get('/api/v1/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.total_rooms).toBe(5);
    expect(res.body.rooms_by_status).toEqual({
      available: 1,
      reserved: 1,
      occupied: 1,
      cleaning: 1,
      maintenance: 1,
    });
    expect(res.body.rooms_needing_cleaning).toBe(1);
    expect(res.body.open_maintenance_issues).toBe(1);
    expect(res.body.shift_payments_total).toEqual({
      cash: 1000,
      instapay: 500,
      vodafone_cash: 0,
      total: 1500,
    });
  });

  test('GET /dashboard in a read-only session returns zero payments', async () => {
    await makeStaff('omar_night', 'night');
    const ro = await login('omar_night', at('22:40'));
    await makeRoom();

    const res = await get('/api/v1/dashboard', ro.body.access_token, at('22:45'));
    expect(res.status).toBe(200);
    expect(res.body.total_rooms).toBe(1);
    expect(res.body.shift_payments_total).toEqual({
      cash: 0,
      instapay: 0,
      vodafone_cash: 0,
      total: 0,
    });
  });
});