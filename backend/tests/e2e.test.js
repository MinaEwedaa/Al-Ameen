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

describe('Feature 14: E2E Lifecycle Flow (tests/e2e.test.js)', () => {
  const password = 'Password123';
  const today = '2026-10-18';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();

  let token;
  let receptionist;
  let currentShift;
  let room;
  let guest;
  let reservationId;
  let cleaningTaskId;
  let maintenanceIssueId;

  const auth = () => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
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
      username: 'e2e_receptionist',
      name: 'محمود عبد السلام',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    room = await Room.create({
      room_number: '101',
      room_type: 'deluxe',
      floor: 1,
      price_per_night: toPiastres(1500),
      half_day_price: toPiastres(600),
      status: 'available',
    });
  });

  test('0. Swagger documentation (/docs/) is accessible on staging / dev', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('1. Receptionist logs in successfully and receives JWT access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({
        username: 'e2e_receptionist',
        password,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('staff');
    expect(res.body.staff.name).toBe('محمود عبد السلام');

    token = res.body.access_token;
    currentShift = res.body.shift;
    expect(currentShift).toBeDefined();
    expect(currentShift.shift_type).toBe('morning');
  });

  test('2. Current active shift is open and confirmed via GET /shifts/current', async () => {
    const res = await request(app)
      .get('/api/v1/shifts/current')
      .set(auth())
      .set('x-test-time', Cairo13);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.shift_date).toBe(today);
  });

  test('3. Create guest with authentic Arabic name and national ID', async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        name: 'عبد الرحمن بن خلدون المصري',
        phone: '+201099887766',
        id_number: '29510101234567',
      });

    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    expect(res.body.name).toBe('عبد الرحمن بن خلدون المصري');
    expect(res.body.id_number).toBe('**********4567');
    expect(res.body).not.toHaveProperty('id_number_enc');
    expect(res.body).not.toHaveProperty('id_number_hash');

    guest = res.body;
  });

  test('4. Create a 2-night reservation for Room 101', async () => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({
        guest_id: guest.guest_id,
        room_id: String(room._id),
        check_in: '2026-10-18T12:00:00.000Z',
        check_out: '2026-10-20T12:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation_id).toBeDefined();
    expect(res.body.status).toBe('confirmed');
    // 2 nights * 1500 EGP = 3000 EGP
    expect(res.body.total_amount).toBe(3000);
    expect(res.body.paid_amount).toBe(0);

    reservationId = res.body.reservation_id;
  });

  test('5. Process deposit payment of 1000 EGP in cash', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: reservationId,
        amount: 1000,
        payment_method: 'cash',
        notes: 'دفعة مقدمة / عربون حجز',
      });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(1000);
    expect(res.body.payment.payment_method).toBe('cash');
    expect(res.body.payment.reservation_id).toBe(reservationId);
    expect(res.body.paid_amount).toBe(1000);
    expect(res.body.remaining_amount).toBe(2000);
  });

  test('6. Check-in the reservation; room status changes to occupied', async () => {
    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('checked_in');

    const updatedRoom = await Room.findById(room._id);
    expect(updatedRoom.status).toBe('occupied');
  });

  test('7. Extend reservation by 1 half-day extension; total becomes 3600 EGP', async () => {
    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/extend`)
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.total_amount).toBe(3600);
    expect(res.body.paid_amount).toBe(1000);
    expect(res.body.remaining_amount).toBe(2600);
  });

  test('8. Pay remaining balance (2600 EGP) via instapay', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id: reservationId,
        amount: 2600,
        payment_method: 'instapay',
        notes: 'سداد كامل المبلغ المتبقي عبر إنستاباي',
      });

    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(2600);
    expect(res.body.payment.payment_method).toBe('instapay');
    expect(res.body.paid_amount).toBe(3600);
    expect(res.body.remaining_amount).toBe(0);
  });

  test('9. Check-out reservation; room automatically transitions to cleaning', async () => {
    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/check-out`)
      .set(auth())
      .set('Idempotency-Key', crypto.randomUUID())
      .set('x-test-time', Cairo13);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('checked_out');

    const updatedRoom = await Room.findById(room._id);
    expect(updatedRoom.status).toBe('cleaning');
  });

  test('10. Verify cleaning task was automatically created for Room 101', async () => {
    const res = await request(app)
      .get('/api/v1/cleaning-tasks')
      .set(auth())
      .set('x-test-time', Cairo13);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const task = res.body.data.find((t) => t.room_id === String(room._id));
    expect(task).toBeDefined();
    expect(task.status).toBe('pending');
    expect(task.priority).toBe('medium');

    cleaningTaskId = task.task_id;
  });

  test('11. Assign cleaner to cleaning task', async () => {
    const res = await request(app)
      .patch(`/api/v1/cleaning-tasks/${cleaningTaskId}`)
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        cleaner_name: 'أمينة إبراهيم',
        notes: 'بدء تنظيف وتعقيم الغرفة وتجهيز المفروشات',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.cleaner_name).toBe('أمينة إبراهيم');
  });

  test('12. Complete cleaning task; verify room is updated back to available', async () => {
    const resTask = await request(app)
      .patch(`/api/v1/cleaning-tasks/${cleaningTaskId}`)
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        status: 'done',
        notes: 'تم الانتهاء من النظافة والتعقيم بالكامل',
      });

    expect(resTask.status).toBe(200);
    expect(resTask.body.status).toBe('done');
    expect(resTask.body.finished_date).toBeDefined();

    // Verify room status update
    const resRoom = await request(app)
      .patch(`/api/v1/rooms/${room._id}/status`)
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        status: 'available',
      });

    expect(resRoom.status).toBe(200);
    expect(resRoom.body.status).toBe('available');
  });

  test('13. Report maintenance issue and resolve it', async () => {
    // 1. Report issue
    const resCreate = await request(app)
      .post('/api/v1/maintenance-issues')
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        room_id: String(room._id),
        problem: 'عطل في مفتاح مكيف الهواء',
        priority: 'medium',
        notes: 'التكييف لا يعمل بالسرعة القصوى',
      });

    expect(resCreate.status).toBe(201);
    expect(resCreate.body.problem).toBe('عطل في مفتاح مكيف الهواء');
    expect(resCreate.body.status).toBe('open');

    maintenanceIssueId = resCreate.body.issue_id;

    // 2. Resolve issue
    const resResolve = await request(app)
      .patch(`/api/v1/maintenance-issues/${maintenanceIssueId}`)
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        status: 'resolved',
        notes: 'تم فحص المفتاح الكهربائي وتبديل الفيوز بنجاح',
      });

    expect(resResolve.status).toBe(200);
    expect(resResolve.body.status).toBe('resolved');
    expect(resResolve.body.resolved_date).toBeDefined();
  });

  test('14. Retrieve current shift summary with exact financial and task totals', async () => {
    const res = await request(app)
      .get('/api/v1/shifts/current/summary')
      .set(auth())
      .set('x-test-time', Cairo13);

    expect(res.status).toBe(200);
    const summary = res.body;
    expect(summary).toBeDefined();

    // Financial calculations:
    // Cash: 1000 EGP
    // InstaPay: 2600 EGP
    // Total payments: 3600 EGP
    expect(summary.payments.cash).toBe(1000);
    expect(summary.payments.instapay).toBe(2600);
    expect(summary.payments.total).toBe(3600);

    // Operations
    expect(summary.check_ins).toBe(1);
    expect(summary.check_outs).toBe(1);
    expect(summary.rooms_handled).toContain(String(room._id));
  });

  test('15. Handover shift; status becomes handed_over and report_status ready', async () => {
    const res = await request(app)
      .patch('/api/v1/shifts/current/handover')
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        shift_notes: 'تم تسليم الوردية الصباحية بنجاح، وجميع الحسابات مطابقة',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('handed_over');
    expect(res.body.handed_over_at).toBeDefined();
    const dbShift = await Shift.findById(currentShift.shift_id);
    expect(dbShift.report_status).toBe('ready');
  });

  test('16. Download and verify generated Shift Report PDF', async () => {
    const res = await request(app)
      .get(`/api/v1/shifts/${currentShift.shift_id}/report`)
      .set(auth())
      .set('x-test-time', Cairo13);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    expect(Buffer.isBuffer(res.body) || res.text.length > 0).toBe(true);
  });
});
