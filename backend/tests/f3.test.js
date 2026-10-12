const request = require('supertest');
const argon2 = require('argon2');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
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
const { authenticate } = require('../src/middleware/auth');
const { requireRole } = require('../src/middleware/requireRole');
const requireShift = require('../src/middleware/requireShift');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 3: Shift Engine & Attendance', () => {
  let morningStaff;
  let eveningStaff;
  const password = 'Password123';
  const today = '2026-10-15'; // Arbitrary fixed date for Cairo tests

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
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

    morningStaff = await Staff.create({
      username: 'ahmed_morning',
      name: 'Ahmed Morning',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    eveningStaff = await Staff.create({
      username: 'sarah_evening',
      name: 'Sarah Evening',
      password_hash: passwordHash,
      default_shift_type: 'evening',
      role: 'receptionist',
      active: true,
    });
  });

  test('login within scheduled shift hours opens active Shift and records Attendance present', async () => {
    // 07:10 Cairo time is 10 minutes into morning shift (grace period is 15m)
    const loginTime = DateTime.fromISO(`${today}T07:10:00`, { zone: ZONE }).toISO();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', loginTime)
      .send({ username: 'ahmed_morning', password });

    expect(res.status).toBe(200);
    expect(res.body.read_only).toBe(false);
    expect(res.body.shift).toBeDefined();
    expect(res.body.shift.shift_date).toBe(today);
    expect(res.body.shift.shift_type).toBe('morning');
    expect(res.body.shift.start_time).toBe('07:00');
    expect(res.body.shift.end_time).toBe('16:00');
    expect(res.body.shift.status).toBe('active');

    // Verify Shift DB document
    const shiftDoc = await Shift.findOne({ staff_id: morningStaff._id, shift_date: today });
    expect(shiftDoc).toBeDefined();
    expect(shiftDoc.status).toBe('active');

    // Verify Attendance DB document
    const attendanceDoc = await Attendance.findOne({ shift_id: shiftDoc._id });
    expect(attendanceDoc).toBeDefined();
    expect(attendanceDoc.status).toBe('present');
    expect(attendanceDoc.date).toBe(today);
  });

  test('login after 15 minutes grace period marks Attendance as late', async () => {
    // 07:25 Cairo time is 25 minutes into morning shift (> 15m)
    const loginTime = DateTime.fromISO(`${today}T07:25:00`, { zone: ZONE }).toISO();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', loginTime)
      .send({ username: 'ahmed_morning', password });

    expect(res.status).toBe(200);
    expect(res.body.read_only).toBe(false);

    const shiftDoc = await Shift.findOne({ staff_id: morningStaff._id, shift_date: today });
    const attendanceDoc = await Attendance.findOne({ shift_id: shiftDoc._id });
    expect(attendanceDoc.status).toBe('late');
  });

  test('login in 30-minute pre-shift window returns read_only: true and shift: null', async () => {
    // 06:40 Cairo time is 20 minutes before 07:00 start (inside 06:30-07:00 window)
    const earlyTime = DateTime.fromISO(`${today}T06:40:00`, { zone: ZONE }).toISO();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', earlyTime)
      .send({ username: 'ahmed_morning', password });

    expect(res.status).toBe(200);
    expect(res.body.read_only).toBe(true);
    expect(res.body.shift).toBeNull();

    // Shift is not yet created in DB
    const shiftDoc = await Shift.findOne({ staff_id: morningStaff._id, shift_date: today });
    expect(shiftDoc).toBeNull();

    // GET /shifts/current returns 404 in pre-shift read-only session
    const token = res.body.access_token;
    const currentRes = await request(app)
      .get('/api/v1/shifts/current')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-time', earlyTime);

    expect(currentRes.status).toBe(404);
    expect(currentRes.body.error.code).toBe('NOT_FOUND');
  });

  test('write during pre-shift read-only window returns 403 FORBIDDEN', async () => {
    const earlyTime = DateTime.fromISO(`${today}T06:40:00`, { zone: ZONE }).toISO();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', earlyTime)
      .send({ username: 'ahmed_morning', password });
    const token = loginRes.body.access_token;

    // Write attempt before start time (at 06:45)
    const writeTime = DateTime.fromISO(`${today}T06:45:00`, { zone: ZONE }).toISO();
    const writeRes = await request(app)
      .post('/api/v1/test-shift-write')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-time', writeTime)
      .send({});

    expect(writeRes.status).toBe(403);
    expect(writeRes.body.error.code).toBe('FORBIDDEN');
    expect(writeRes.body.error.message).toContain('read-only until your shift starts');
  });

  test('first write after scheduled start auto-opens shift for early login session', async () => {
    const earlyTime = DateTime.fromISO(`${today}T06:40:00`, { zone: ZONE }).toISO();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', earlyTime)
      .send({ username: 'ahmed_morning', password });
    const token = loginRes.body.access_token;

    // Time reaches 07:05 (shift has now started)
    const startTime = DateTime.fromISO(`${today}T07:05:00`, { zone: ZONE }).toISO();
    const writeRes = await request(app)
      .post('/api/v1/test-shift-write')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-time', startTime)
      .send({});

    expect(writeRes.status).toBe(200);
    expect(writeRes.body.ok).toBe(true);

    // Shift and attendance are now opened
    const shiftDoc = await Shift.findOne({ staff_id: morningStaff._id, shift_date: today });
    expect(shiftDoc).toBeDefined();
    expect(shiftDoc.status).toBe('active');
  });

  test('login outside shift hours returns 403 OUTSIDE_SHIFT_HOURS', async () => {
    // 18:00 Cairo time is after morning shift ended (16:00)
    const lateTime = DateTime.fromISO(`${today}T18:00:00`, { zone: ZONE }).toISO();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', lateTime)
      .send({ username: 'ahmed_morning', password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OUTSIDE_SHIFT_HOURS');
  });

  test('login on date with cancel exception returns 403 NOT_SCHEDULED', async () => {
    // Add cancel exception for morning staff today
    await ShiftException.create({
      staff_id: morningStaff._id,
      shift_date: today,
      shift_type: 'morning',
      kind: 'cancel',
    });

    const shiftTime = DateTime.fromISO(`${today}T08:00:00`, { zone: ZONE }).toISO();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', shiftTime)
      .send({ username: 'ahmed_morning', password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_SCHEDULED');
  });

  test('login on date with swap exception allows swapped shift type', async () => {
    // Swap morning staff to evening shift
    await ShiftException.create({
      staff_id: morningStaff._id,
      shift_date: today,
      shift_type: 'evening',
      kind: 'swap',
    });

    const eveningTime = DateTime.fromISO(`${today}T17:00:00`, { zone: ZONE }).toISO();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', eveningTime)
      .send({ username: 'ahmed_morning', password });

    expect(res.status).toBe(200);
    expect(res.body.shift.shift_type).toBe('evening');
    expect(res.body.shift.start_time).toBe('16:00');
    expect(res.body.shift.end_time).toBe('23:00');
  });

  test('GET /shifts/current returns active shift details', async () => {
    const shiftTime = DateTime.fromISO(`${today}T08:00:00`, { zone: ZONE }).toISO();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', shiftTime)
      .send({ username: 'ahmed_morning', password });
    const token = loginRes.body.access_token;

    const res = await request(app)
      .get('/api/v1/shifts/current')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-time', shiftTime);

    expect(res.status).toBe(200);
    expect(res.body.shift_date).toBe(today);
    expect(res.body.shift_type).toBe('morning');
    expect(res.body.status).toBe('active');
    expect(res.body.staff_id).toBe(String(morningStaff._id));
  });

  test('GET /shifts/current/summary returns financial totals in EGP and counts', async () => {
    const shiftTime = DateTime.fromISO(`${today}T08:00:00`, { zone: ZONE }).toISO();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', shiftTime)
      .send({ username: 'ahmed_morning', password });
    const token = loginRes.body.access_token;
    const shiftId = loginRes.body.shift.shift_id;

    // Seed room and sample operational records bound to this shift
    const room = await Room.create({
      room_number: '101',
      room_type: 'VIP',
      price_per_night: toPiastres(2000),
      half_day_price: toPiastres(1000),
    });

    // Seed payments (amount in Piastres: 100000 = 1000 EGP, 50000 = 500 EGP)
    const dummyResvId = '507f191e810c19729de860ea';
    await Payment.create({
      reservation_id: dummyResvId,
      staff_id: morningStaff._id,
      shift_id: shiftId,
      amount: 100000, // 1000.00 EGP
      payment_method: 'cash',
      payment_datetime: new Date(),
    });
    await Payment.create({
      reservation_id: dummyResvId,
      staff_id: morningStaff._id,
      shift_id: shiftId,
      amount: 50000, // 500.00 EGP
      payment_method: 'instapay',
      payment_datetime: new Date(),
    });

    // Seed a cleaning task in this shift
    await CleaningTask.create({
      room_id: room._id,
      shift_id: shiftId,
      assigned_by_staff_id: morningStaff._id,
      priority: 'high',
      status: 'pending',
    });

    // Fetch summary
    const res = await request(app)
      .get('/api/v1/shifts/current/summary')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-time', shiftTime);

    expect(res.status).toBe(200);
    expect(res.body.shift.shift_id).toBe(shiftId);
    expect(res.body.payments.cash).toBe(1000.0);
    expect(res.body.payments.instapay).toBe(500.0);
    expect(res.body.payments.vodafone_cash).toBe(0.0);
    expect(res.body.payments.total).toBe(1500.0);
    expect(res.body.cleaning_tasks).toHaveLength(1);
    expect(res.body.pending.cleaning_tasks).toHaveLength(1);
    expect(res.body.rooms_handled).toContain(String(room._id));
  });

  test('PATCH /shifts/current/handover closes shift, updates attendance, generates PDF report', async () => {
    const shiftTime = DateTime.fromISO(`${today}T08:00:00`, { zone: ZONE }).toISO();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', shiftTime)
      .send({ username: 'ahmed_morning', password });
    const token = loginRes.body.access_token;
    const shiftId = loginRes.body.shift.shift_id;

    const handoverTime = DateTime.fromISO(`${today}T16:05:00`, { zone: ZONE }).toISO();
    const notes = 'Room 101 guest requested late checkout tomorrow.';

    const handoverRes = await request(app)
      .patch('/api/v1/shifts/current/handover')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-time', handoverTime)
      .send({ shift_notes: notes });

    expect(handoverRes.status).toBe(200);
    expect(handoverRes.body.status).toBe('handed_over');
    expect(handoverRes.body.shift_notes).toBe(notes);
    expect(handoverRes.body.handed_over_at).toBeDefined();

    // Verify DB shift is handed_over
    const updatedShift = await Shift.findById(shiftId);
    expect(updatedShift.status).toBe('handed_over');
    expect(updatedShift.shift_notes).toBe(notes);

    // Verify Attendance has check_out_at
    const attendanceDoc = await Attendance.findOne({ shift_id: shiftId });
    expect(attendanceDoc.check_out_at).toBeDefined();

    // Verify ShiftReport PDF stored with SHA256
    const reportDoc = await ShiftReport.findOne({ shift_id: shiftId });
    expect(reportDoc).toBeDefined();
    expect(reportDoc.pdf).toBeInstanceOf(Buffer);
    expect(reportDoc.sha256).toBeDefined();

    // Verify GET /shifts/{shift_id}/report downloads the PDF
    const reportRes = await request(app)
      .get(`/api/v1/shifts/${shiftId}/report`)
      .set('Authorization', `Bearer ${token}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.headers['content-type']).toContain('application/pdf');
    expect(reportRes.body).toBeInstanceOf(Buffer);
    expect(reportRes.body.length).toBeGreaterThan(500);

    // Post-handover write attempt returns 409 SHIFT_CLOSED
    const postHandoverWrite = await request(app)
      .post('/api/v1/test-shift-write')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(postHandoverWrite.status).toBe(409);
    expect(postHandoverWrite.body.error.code).toBe('SHIFT_CLOSED');
  });

  test('write attempt returns 409 SHIFT_HANDOVER_ONLY when newer shift has opened', async () => {
    // 1. Morning staff logs in at 08:00
    const mTime = DateTime.fromISO(`${today}T08:00:00`, { zone: ZONE }).toISO();
    const mLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', mTime)
      .send({ username: 'ahmed_morning', password });
    const mToken = mLogin.body.access_token;

    // 2. Evening staff logs in at 16:00 and opens the next shift slot
    const eTime = DateTime.fromISO(`${today}T16:00:00`, { zone: ZONE }).toISO();
    const eLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', eTime)
      .send({ username: 'sarah_evening', password });
    expect(eLogin.status).toBe(200);

    // 3. Morning receptionist tries to write after evening shift opened
    const writeRes = await request(app)
      .post('/api/v1/test-shift-write')
      .set('Authorization', `Bearer ${mToken}`)
      .set('x-test-time', eTime)
      .send({});

    expect(writeRes.status).toBe(409);
    expect(writeRes.body.error.code).toBe('SHIFT_HANDOVER_ONLY');
  });
});
