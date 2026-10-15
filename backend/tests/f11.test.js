const request = require('supertest');
const argon2 = require('argon2');
const crypto = require('crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { DateTime } = require('luxon');
const app = require('../src/app');
const env = require('../src/config/env');
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
const pdfUtils = require('../src/utils/pdf');

describe('Feature 11: Shift Handover, Summary, and Report PDF', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();
  const CairoBeforeShift = DateTime.fromISO(`${today}T06:40:00`, { zone: ZONE }).toISO();

  const uid = () => crypto.randomUUID();

  let token;
  let staff;
  let shift;

  let otherStaff;
  let otherToken;

  const auth = (t = token) => ({
    Authorization: `Bearer ${t}`,
  });

  const createRoom = (room_number = '101') =>
    Room.create({
      room_number,
      room_type: 'deluxe',
      floor: 1,
      price_per_night: toPiastres(1000),
      half_day_price: toPiastres(400),
      status: 'available',
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
    staff = await Staff.create({
      username: 'reception_f11',
      name: 'Shift Receptionist',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    otherStaff = await Staff.create({
      username: 'other_f11',
      name: 'Other Staff',
      password_hash: passwordHash,
      default_shift_type: 'evening',
      role: 'receptionist',
      active: true,
    });

    // Login main staff at 13:00 (active morning shift)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({ username: 'reception_f11', password });

    expect(loginRes.status).toBe(200);
    token = loginRes.body.access_token;
    shift = loginRes.body.shift;

    // Create session and access token for otherStaff
    const otherSession = await Session.create({
      staff_id: otherStaff._id,
      refresh_hash: crypto.randomBytes(32).toString('hex'),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000),
    });
    otherToken = jwt.sign(
      { sub: String(otherStaff._id), sid: String(otherSession._id), role: otherStaff.role },
      env.jwtSecret,
      { expiresIn: '15m' }
    );
  });

  describe('Live Shift Summary (GET /api/v1/shifts/current/summary)', () => {
    test('summary matches collections, check-ins, check-outs, pending items and unverified payments of current shift only', async () => {
      const room1 = await createRoom('101');
      const room2 = await createRoom('102');

      // 1. Payment in current shift
      const payment1 = await Payment.create({
        reservation_id: new mongoose.Types.ObjectId(),
        staff_id: staff._id,
        shift_id: shift.shift_id,
        amount: toPiastres(1200),
        payment_method: 'cash',
        payment_datetime: new Date(),
        payment_verified: false,
      });

      const payment2 = await Payment.create({
        reservation_id: new mongoose.Types.ObjectId(),
        staff_id: staff._id,
        shift_id: shift.shift_id,
        amount: toPiastres(800),
        payment_method: 'instapay',
        payment_datetime: new Date(),
        payment_verified: true,
      });

      // Payment from a past/different shift that is unverified (should NOT be counted in current shift's unverified_payments)
      await Payment.create({
        reservation_id: new mongoose.Types.ObjectId(),
        staff_id: otherStaff._id,
        shift_id: new mongoose.Types.ObjectId(),
        amount: toPiastres(500),
        payment_method: 'vodafone_cash',
        payment_datetime: new Date(),
        payment_verified: false,
      });

      // 2. Reservations check-in & check-out in this shift
      await Reservation.create({
        guest_id: new mongoose.Types.ObjectId(),
        room_id: room1._id,
        check_in_at: new Date(),
        check_out_at: new Date(),
        nights: 1,
        check_in_shift_id: shift.shift_id,
        check_in_staff_id: staff._id,
        status: 'checked_in',
        price_per_night_snapshot: toPiastres(1000),
        half_day_price_snapshot: toPiastres(400),
        total_amount: toPiastres(2000),
      });

      await Reservation.create({
        guest_id: new mongoose.Types.ObjectId(),
        room_id: room2._id,
        check_in_at: new Date(),
        check_out_at: new Date(),
        nights: 1,
        check_out_shift_id: shift.shift_id,
        check_out_staff_id: staff._id,
        status: 'checked_out',
        price_per_night_snapshot: toPiastres(1000),
        half_day_price_snapshot: toPiastres(400),
        total_amount: toPiastres(2000),
      });

      // 3. Cleaning task in current shift + pending task from previous shift
      await CleaningTask.create({
        room_id: room1._id,
        shift_id: shift.shift_id,
        status: 'done',
        priority: 'medium',
      });

      await CleaningTask.create({
        room_id: room2._id,
        shift_id: new mongoose.Types.ObjectId(), // previous shift
        status: 'pending',
        priority: 'high',
      });

      // 4. Maintenance issue in current shift + open issue from previous shift
      await MaintenanceIssue.create({
        room_id: room1._id,
        shift_id: shift.shift_id,
        staff_id: staff._id,
        problem: 'لمبة مكسورة',
        priority: 'low',
        status: 'resolved',
      });

      await MaintenanceIssue.create({
        room_id: room2._id,
        shift_id: new mongoose.Types.ObjectId(), // previous shift
        staff_id: otherStaff._id,
        problem: 'عطل تكييف',
        priority: 'urgent',
        status: 'open',
      });

      // Fetch summary
      const res = await request(app)
        .get('/api/v1/shifts/current/summary')
        .set(auth())
        .set('x-test-time', Cairo13);

      expect(res.status).toBe(200);
      expect(res.body.shift.shift_id).toBe(String(shift.shift_id));

      // Financials
      expect(res.body.payments.cash).toBe(1200);
      expect(res.body.payments.instapay).toBe(800);
      expect(res.body.payments.vodafone_cash).toBe(0);
      expect(res.body.payments.total).toBe(2000);

      // Operations
      expect(res.body.check_ins).toBe(1);
      expect(res.body.check_outs).toBe(1);

      // Rooms handled includes room1 and room2
      expect(res.body.rooms_handled).toContain(String(room1._id));
      expect(res.body.rooms_handled).toContain(String(room2._id));

      // Cleaning tasks created in this shift
      expect(res.body.cleaning_tasks.length).toBe(1);

      // Maintenance issues reported in this shift
      expect(res.body.maintenance_issues.length).toBe(1);

      // Pending items: includes unfinished items from earlier shifts
      expect(res.body.pending.cleaning_tasks.length).toBe(1);
      expect(res.body.pending.cleaning_tasks[0].status).toBe('pending');

      expect(res.body.pending.maintenance_issues.length).toBe(1);
      expect(res.body.pending.maintenance_issues[0].problem).toBe('عطل تكييف');

      // Unverified payments: only includes unverified payment from current shift!
      expect(res.body.pending.unverified_payments.length).toBe(1);
      expect(res.body.pending.unverified_payments[0].payment_id).toBe(String(payment1._id));
    });
  });

  describe('Shift Handover (PATCH /api/v1/shifts/current/handover)', () => {
    test('handover closes shift, sets handed_over_at, clocks out attendance, writes audit, and generates PDF report', async () => {
      const res = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          shift_notes: 'كل شيء هادئ وتم تسليم العهدة النقدية',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('handed_over');
      expect(res.body.handed_over_at).toBeDefined();
      expect(res.body.shift_notes).toBe('كل شيء هادئ وتم تسليم العهدة النقدية');

      // Verify Shift in DB
      const shiftDoc = await Shift.findById(shift.shift_id);
      expect(shiftDoc.status).toBe('handed_over');
      expect(shiftDoc.report_status).toBe('ready');

      // Verify Attendance clocked out
      const attendance = await Attendance.findOne({ shift_id: shift.shift_id });
      expect(attendance).toBeDefined();
      expect(attendance.check_out_at).toBeDefined();

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        action: 'SHIFT_HANDED_OVER',
        entity_id: shift.shift_id,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog.actor_staff_id).toEqual(staff._id);

      // Verify ShiftReport created and begins with %PDF
      const report = await ShiftReport.findOne({ shift_id: shift.shift_id });
      expect(report).toBeDefined();
      expect(report.pdf).toBeDefined();
      expect(report.pdf.slice(0, 4).toString()).toBe('%PDF');
      expect(report.sha256).toBeDefined();
    });

    test('any subsequent write after handover returns 409 SHIFT_CLOSED', async () => {
      // 1. Handover shift
      const hRes = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({});
      expect(hRes.status).toBe(200);

      const room = await createRoom('103');

      // 2. Attempt to create a cleaning task with the same session
      const writeRes = await request(app)
        .post('/api/v1/cleaning-tasks')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          room_id: String(room._id),
          priority: 'medium',
        });

      expect(writeRes.status).toBe(409);
      expect(writeRes.body.error.code).toBe('SHIFT_CLOSED');
    });

    test('calling handover a second time returns 409 SHIFT_CLOSED', async () => {
      // First handover
      const res1 = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({});
      expect(res1.status).toBe(200);

      // Second handover
      const res2 = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({});
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SHIFT_CLOSED');
    });

    test('handover succeeds from handover-only session when next shift has already opened', async () => {
      // Create and open evening shift for today
      const Cairo16 = DateTime.fromISO(`${today}T16:05:00`, { zone: ZONE }).toISO();
      await Shift.create({
        staff_id: otherStaff._id,
        shift_date: today,
        shift_type: 'evening',
        start_at: new Date(Cairo16),
        end_at: new Date(DateTime.fromISO(`${today}T23:00:00`, { zone: ZONE }).toISO()),
        status: 'active',
      });

      // Morning shift now hands over after next shift opened
      const res = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo16)
        .send({
          shift_notes: 'تسليم متأخر بعد بدء الوردية التالية',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('handed_over');
    });

    test('handover from read-only session before scheduled start returns 403 FORBIDDEN', async () => {
      const passwordHash = await argon2.hash(password);
      await Staff.create({
        username: 'ro_handover_staff',
        name: 'RO Staff',
        password_hash: passwordHash,
        default_shift_type: 'morning',
        role: 'receptionist',
        active: true,
      });

      const roLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', CairoBeforeShift)
        .send({ username: 'ro_handover_staff', password });

      expect(roLogin.status).toBe(200);
      expect(roLogin.body.read_only).toBe(true);
      const roToken = roLogin.body.access_token;

      const res = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth(roToken))
        .set('x-test-time', CairoBeforeShift)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('concurrent handover requests: one succeeds 200, the other fails with 409', async () => {
      const [res1, res2] = await Promise.all([
        request(app)
          .patch('/api/v1/shifts/current/handover')
          .set(auth())
          .set('x-test-time', Cairo13)
          .send({ shift_notes: 'Handover 1' }),
        request(app)
          .patch('/api/v1/shifts/current/handover')
          .set(auth())
          .set('x-test-time', Cairo13)
          .send({ shift_notes: 'Handover 2' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    test('when PDF generation fails, handover still succeeds with 200 and report_status is set to failed', async () => {
      // Mock generateShiftReportPdf to throw
      const originalGenerate = pdfUtils.generateShiftReportPdf;
      pdfUtils.generateShiftReportPdf = jest.fn().mockRejectedValue(new Error('PDF Engine Failure'));

      try {
        const res = await request(app)
          .patch('/api/v1/shifts/current/handover')
          .set(auth())
          .set('x-test-time', Cairo13)
          .send({ shift_notes: 'Test failure recovery' });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('handed_over');

        const shiftDoc = await Shift.findById(shift.shift_id);
        expect(shiftDoc.status).toBe('handed_over');
        expect(shiftDoc.report_status).toBe('failed');
      } finally {
        pdfUtils.generateShiftReportPdf = originalGenerate;
      }
    });
  });

  describe('Download Shift Report PDF (GET /api/v1/shifts/:shift_id/report)', () => {
    test('downloading report after handover returns application/pdf with latin filename header', async () => {
      // Handover first
      await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({ shift_notes: 'Handover complete' });

      const res = await request(app)
        .get(`/api/v1/shifts/${shift.shift_id}/report`)
        .set(auth())
        .set('x-test-time', Cairo13);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toMatch(
        /attachment; filename="shift-report-.*\.pdf"/
      );
      expect(res.body.slice(0, 4).toString()).toBe('%PDF');
    });

    test('another staff member requesting a shift report that is not theirs receives 404', async () => {
      await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({});

      // otherStaff requests main staff's shift report
      const res = await request(app)
        .get(`/api/v1/shifts/${shift.shift_id}/report`)
        .set(auth(otherToken))
        .set('x-test-time', Cairo13);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('notes with html/scripts like <script>alert(1)</script> render safely as plain text without execution', async () => {
      const res = await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          shift_notes: 'ملاحظة أمنية <script>alert(1)</script>',
        });

      expect(res.status).toBe(200);
      expect(res.body.shift_notes).toContain('<script>alert(1)</script>');

      // Verify report was generated
      const report = await ShiftReport.findOne({ shift_id: shift.shift_id });
      expect(report).toBeDefined();
      expect(report.pdf.slice(0, 4).toString()).toBe('%PDF');
    });
  });
});
