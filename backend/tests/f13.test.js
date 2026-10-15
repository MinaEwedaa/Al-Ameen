const request = require('supertest');
const argon2 = require('argon2');
const crypto = require('crypto');
const { DateTime } = require('luxon');
const app = require('../src/app');
const admin = require('../scripts/admin');
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
  ShiftException,
  RoomStatusHistory,
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres, toEGP } = require('../src/utils/money');

describe('Feature 13: Administrative CLI Script (tests/f13.test.js)', () => {
  const password = 'Password123';
  const today = '2026-10-18';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();

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
      ShiftException.deleteMany({}),
      RoomStatusHistory.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);
  });

  describe('1. Guard Enforcement & Audit Logging', () => {
    test('any command without --by throws an error and rejects execution', async () => {
      await expect(
        admin.createStaff({
          username: 'test_rec',
          name: 'Test Staff',
          shiftType: 'morning',
          reason: 'Initial setup',
        })
      ).rejects.toThrow(/--by is mandatory/i);

      // Verify no staff was created
      const staff = await Staff.findOne({ username: 'test_rec' });
      expect(staff).toBeNull();
    });

    test('any command without --reason throws an error and rejects execution', async () => {
      await expect(
        admin.createStaff({
          username: 'test_rec',
          name: 'Test Staff',
          shiftType: 'morning',
          by: 'Hotel Manager',
        })
      ).rejects.toThrow(/--reason is mandatory/i);

      const staff = await Staff.findOne({ username: 'test_rec' });
      expect(staff).toBeNull();
    });

    test('guard records ADMIN_* action in AuditLog without leaking sensitive data', async () => {
      const result = await admin.createStaff({
        username: 'staff_audit_test',
        name: 'Audit Test Staff',
        shiftType: 'morning',
        password: 'SuperSecretPassword123!',
        by: 'Security Officer',
        reason: 'Staff onboarding for new shift',
        yes: true,
      });

      expect(result.username).toBe('staff_audit_test');

      const audit = await AuditLog.findOne({ action: 'ADMIN_CREATE_STAFF' });
      expect(audit).toBeDefined();
      expect(audit.details.by).toBe('Security Officer');
      expect(audit.details.reason).toBe('Staff onboarding for new shift');
      expect(audit.details.username).toBe('staff_audit_test');
      // Password must NEVER be logged in the audit log
      expect(audit.details).not.toHaveProperty('password');
      expect(audit.details).not.toHaveProperty('password_hash');
    });
  });

  describe('2. Staff Management Commands', () => {
    test('create-staff generates credentials, creates user, and user can authenticate', async () => {
      const res = await admin.createStaff({
        username: 'new_receptionist',
        name: 'فاطمة محمود',
        shiftType: 'morning',
        by: 'Admin Director',
        reason: 'Recruiting receptionist',
        yes: true,
      });

      expect(res.staff_id).toBeDefined();
      expect(res.username).toBe('new_receptionist');
      expect(res.password).toBeDefined();
      expect(typeof res.password).toBe('string');
      expect(res.password.length).toBeGreaterThanOrEqual(12);

      // Verify that the generated credentials can log in via API
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', Cairo13)
        .send({
          username: 'new_receptionist',
          password: res.password,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.access_token).toBeDefined();
      expect(loginRes.body.staff.name).toBe('فاطمة محمود');
    });

    test('disable-staff deactivates staff and revokes active sessions', async () => {
      const staffRes = await admin.createStaff({
        username: 'to_disable',
        name: 'Disable Me',
        shiftType: 'morning',
        password,
        by: 'Admin',
        reason: 'Testing disable',
        yes: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', Cairo13)
        .send({ username: 'to_disable', password });
      expect(loginRes.status).toBe(200);
      const token = loginRes.body.access_token;

      // Disable staff
      await admin.disableStaff({
        username: 'to_disable',
        by: 'HR Manager',
        reason: 'Contract terminated',
        yes: true,
      });

      const updated = await Staff.findById(staffRes.staff_id);
      expect(updated.active).toBe(false);

      // Verify authenticated route returns 401 because sessions were revoked
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(401);
    });

    test('reset-password updates password, clears lockouts, and revokes previous sessions', async () => {
      const staffRes = await admin.createStaff({
        username: 'pwd_reset_user',
        name: 'Reset Test',
        shiftType: 'morning',
        password,
        by: 'Admin',
        reason: 'Testing reset',
        yes: true,
      });

      // Login to obtain active session
      const login1 = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', Cairo13)
        .send({ username: 'pwd_reset_user', password });
      expect(login1.status).toBe(200);
      const oldToken = login1.body.access_token;

      // Lock user account by simulating failed attempts
      await Staff.updateOne(
        { _id: staffRes.staff_id },
        { failed_attempts: 5, lock_level: 2, locked_until: new Date(Date.now() + 3600000) }
      );

      // Admin resets password
      const resetRes = await admin.resetPassword({
        username: 'pwd_reset_user',
        by: 'Admin Ops',
        reason: 'User forgot password and account locked',
        yes: true,
      });

      expect(resetRes.password).toBeDefined();
      expect(resetRes.password).not.toBe(password);

      // Old token must now be rejected with 401
      const oldTokenRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(oldTokenRes.status).toBe(401);

      // Account must be unlocked
      const staffDoc = await Staff.findById(staffRes.staff_id);
      expect(staffDoc.failed_attempts).toBe(0);
      expect(staffDoc.lock_level).toBe(0);
      expect(staffDoc.locked_until).toBeNull();

      // Login with new password must succeed
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', Cairo13)
        .send({ username: 'pwd_reset_user', password: resetRes.password });
      expect(login2.status).toBe(200);
    });

    test('unlock-account clears failed attempts and lockout expiration', async () => {
      const staffRes = await admin.createStaff({
        username: 'locked_user',
        name: 'Locked User',
        shiftType: 'morning',
        password,
        by: 'Admin',
        reason: 'Setup',
        yes: true,
      });

      await Staff.updateOne(
        { _id: staffRes.staff_id },
        { failed_attempts: 5, lock_level: 1, locked_until: new Date(Date.now() + 900000) }
      );

      await admin.unlockAccount({
        username: 'locked_user',
        by: 'Helpdesk',
        reason: 'Identity verified over phone',
        yes: true,
      });

      const staffDoc = await Staff.findById(staffRes.staff_id);
      expect(staffDoc.failed_attempts).toBe(0);
      expect(staffDoc.lock_level).toBe(0);
      expect(staffDoc.locked_until).toBeNull();
    });
  });

  describe('3. Room Management Commands', () => {
    test('create-room adds a new room with proper piastres conversion', async () => {
      const res = await admin.createRoom({
        roomNumber: '401',
        roomType: 'deluxe',
        floor: 4,
        price: 1800,
        halfDayPrice: 750,
        by: 'Hotel General Manager',
        reason: 'Fourth floor expansion',
        yes: true,
      });

      expect(res.room_number).toBe('401');
      expect(res.price_per_night).toBe(1800);
      expect(res.half_day_price).toBe(750);
      expect(res.status).toBe('available');

      const room = await Room.findOne({ room_number: '401' });
      expect(room).toBeDefined();
      expect(room.price_per_night).toBe(180000); // 1800 EGP = 180000 piastres
      expect(room.half_day_price).toBe(75000);
    });

    test('set-room updates room price and status', async () => {
      await admin.createRoom({
        roomNumber: '402',
        roomType: 'single',
        floor: 4,
        price: 1000,
        by: 'Manager',
        reason: 'Creation',
        yes: true,
      });

      const updated = await admin.setRoom({
        roomNumber: '402',
        price: 1250,
        status: 'maintenance',
        by: 'Maintenance Manager',
        reason: 'Room plumbing upgrade and price revision',
        yes: true,
      });

      expect(updated.price_per_night).toBe(1250);
      expect(updated.status).toBe('maintenance');

      const room = await Room.findOne({ room_number: '402' });
      expect(room.price_per_night).toBe(125000);
      expect(room.status).toBe('maintenance');
    });
  });

  describe('4. Shift Management Commands', () => {
    test('add-exception creates valid shift schedule exception', async () => {
      await admin.createStaff({
        username: 'schedule_staff',
        name: 'Schedule Staff',
        shiftType: 'morning',
        password,
        by: 'Manager',
        reason: 'Setup',
        yes: true,
      });

      const res = await admin.addException({
        username: 'schedule_staff',
        date: '2026-10-25',
        shiftType: 'evening',
        kind: 'swap',
        by: 'Operations Supervisor',
        reason: 'Personal leave request approved',
        yes: true,
      });

      expect(res.kind).toBe('swap');
      expect(res.shift_date).toBe('2026-10-25');
      expect(res.shift_type).toBe('evening');

      const exc = await ShiftException.findById(res.exception_id);
      expect(exc).toBeDefined();
      expect(exc.kind).toBe('swap');
    });

    test('reopen-shift resets handed-over shift to active and deletes previous report', async () => {
      const staffRes = await admin.createStaff({
        username: 'reopen_rec',
        name: 'Reopen Receptionist',
        shiftType: 'morning',
        password,
        by: 'Manager',
        reason: 'Setup',
        yes: true,
      });

      const shift = await Shift.create({
        staff_id: staffRes.staff_id,
        shift_date: today,
        shift_type: 'morning',
        start_at: new Date(),
        end_at: new Date(),
        status: 'handed_over',
        handed_over_at: new Date(),
        report_status: 'ready',
      });

      // Create dummy old report
      await ShiftReport.create({
        shift_id: shift._id,
        pdf: Buffer.from('%PDF-1.4 test report'),
        sha256: crypto.createHash('sha256').update('%PDF-1.4 test report').digest('hex'),
      });

      // Reopen shift
      const res = await admin.reopenShift({
        shiftId: String(shift._id),
        by: 'Branch Manager',
        reason: 'Receptionist forgot to record final cash receipt before closing',
        yes: true,
      });

      expect(res.status).toBe('active');

      const updatedShift = await Shift.findById(shift._id);
      expect(updatedShift.status).toBe('active');
      expect(updatedShift.handed_over_at).toBeNull();

      // Verify old report document was deleted
      const reportCount = await ShiftReport.countDocuments({ shift_id: shift._id });
      expect(reportCount).toBe(0);
    });

    test('regenerate-report successfully regenerates shift PDF report', async () => {
      const staffRes = await admin.createStaff({
        username: 'report_rec',
        name: 'Report Receptionist',
        shiftType: 'morning',
        password,
        by: 'Manager',
        reason: 'Setup',
        yes: true,
      });

      const shift = await Shift.create({
        staff_id: staffRes.staff_id,
        shift_date: today,
        shift_type: 'morning',
        start_at: new Date(),
        end_at: new Date(),
        status: 'handed_over',
        handed_over_at: new Date(),
        report_status: 'failed',
      });

      const res = await admin.regenerateReport({
        shiftId: String(shift._id),
        by: 'IT Support',
        reason: 'Previous PDF generation crashed during handover',
        yes: true,
      });

      expect(res.report_status).toBe('ready');
      expect(res.pdf_bytes).toBeGreaterThan(0);
      expect(res.sha256).toBeDefined();

      const dbShift = await Shift.findById(shift._id);
      expect(dbShift.report_status).toBe('ready');

      const dbReport = await ShiftReport.findOne({ shift_id: shift._id });
      expect(dbReport).toBeDefined();
      expect(dbReport.pdf.length).toBeGreaterThan(0);
      expect(dbReport.sha256).toBeDefined();
    });
  });

  describe('5. Payment Correction & Cache Audit Commands', () => {
    test('reverse-payment creates negative payment, updates paid_cache, and prevents double reversal', async () => {
      const staffRes = await admin.createStaff({
        username: 'rev_staff',
        name: 'Reversal Staff',
        shiftType: 'morning',
        password,
        by: 'Manager',
        reason: 'Setup',
        yes: true,
      });

      const shift = await Shift.create({
        staff_id: staffRes.staff_id,
        shift_date: today,
        shift_type: 'morning',
        start_at: new Date(),
        end_at: new Date(),
        status: 'active',
      });

      const reservation = await Reservation.create({
        reservation_number: 'RES-REV-1',
        guest_id: new Staff()._id,
        room_id: new Staff()._id,
        check_in_at: new Date('2026-10-18T12:00:00.000Z'),
        check_out_at: new Date('2026-10-20T12:00:00.000Z'),
        nights: 2,
        price_per_night_snapshot: toPiastres(2500),
        half_day_price_snapshot: toPiastres(1000),
        total_amount: toPiastres(5000),
        paid_cache: toPiastres(5000), // Mistakenly entered 5000 instead of 500
        status: 'confirmed',
      });

      const originalPayment = await Payment.create({
        reservation_id: reservation._id,
        staff_id: staffRes.staff_id,
        shift_id: shift._id,
        amount: toPiastres(5000),
        payment_method: 'cash',
        payment_datetime: new Date(),
        payment_verified: false,
      });

      // 1. Reverse the mistaken payment
      const revRes = await admin.reversePayment({
        paymentId: String(originalPayment._id),
        by: 'Chief Accountant',
        reason: 'Receptionist entered 5000 instead of 500',
        yes: true,
      });

      expect(revRes.reversed_amount).toBe(5000);
      expect(revRes.original_payment_id).toBe(String(originalPayment._id));

      // Verify paid_cache decremented back to 0
      const updatedRes = await Reservation.findById(reservation._id);
      expect(updatedRes.paid_cache).toBe(0);

      // Verify negative payment record exists
      const reversalDoc = await Payment.findById(revRes.reversal_payment_id);
      expect(reversalDoc.amount).toBe(-toPiastres(5000));
      expect(String(reversalDoc.reversal_of_payment_id)).toBe(String(originalPayment._id));

      // 2. Attempting to reverse the same payment again must be rejected!
      await expect(
        admin.reversePayment({
          paymentId: String(originalPayment._id),
          by: 'Chief Accountant',
          reason: 'Duplicate reversal attempt',
          yes: true,
        })
      ).rejects.toThrow(/already been reversed/i);
    });

    test('add-payment adds corrective payment and updates paid_cache within remaining balance', async () => {
      const staffRes = await admin.createStaff({
        username: 'add_pay_staff',
        name: 'Add Pay Staff',
        shiftType: 'morning',
        password,
        by: 'Manager',
        reason: 'Setup',
        yes: true,
      });

      const shift = await Shift.create({
        staff_id: staffRes.staff_id,
        shift_date: today,
        shift_type: 'morning',
        start_at: new Date(),
        end_at: new Date(),
        status: 'active',
      });

      const reservation = await Reservation.create({
        reservation_number: 'RES-ADD-1',
        guest_id: new Staff()._id,
        room_id: new Staff()._id,
        check_in_at: new Date('2026-10-18T12:00:00.000Z'),
        check_out_at: new Date('2026-10-20T12:00:00.000Z'),
        nights: 2,
        price_per_night_snapshot: toPiastres(1500),
        half_day_price_snapshot: toPiastres(600),
        total_amount: toPiastres(3000),
        paid_cache: 0,
        status: 'confirmed',
      });

      const payRes = await admin.addPayment({
        reservationId: String(reservation._id),
        amount: 500,
        method: 'cash',
        shiftId: String(shift._id),
        by: 'Senior Auditor',
        reason: 'Recording verified deposit after reversal',
        yes: true,
      });

      expect(payRes.amount).toBe(500);
      expect(payRes.remaining_balance).toBe(2500);

      const updatedRes = await Reservation.findById(reservation._id);
      expect(updatedRes.paid_cache).toBe(toPiastres(500));

      // Attempting to add payment exceeding remaining balance must fail
      await expect(
        admin.addPayment({
          reservationId: String(reservation._id),
          amount: 3000, // remaining is only 2500
          method: 'cash',
          shiftId: String(shift._id),
          by: 'Senior Auditor',
          reason: 'Excess payment',
          yes: true,
        })
      ).rejects.toThrow(/cannot exceed remaining amount/i);
    });

    test('check-paid-cache detects discrepancies and fixes them with --fix', async () => {
      const reservation = await Reservation.create({
        reservation_number: 'RES-CHECK-1',
        guest_id: new Staff()._id,
        room_id: new Staff()._id,
        check_in_at: new Date('2026-10-18T12:00:00.000Z'),
        check_out_at: new Date('2026-10-20T12:00:00.000Z'),
        nights: 2,
        price_per_night_snapshot: toPiastres(1000),
        half_day_price_snapshot: toPiastres(400),
        total_amount: toPiastres(2000),
        paid_cache: toPiastres(500), // Corrupted paid_cache (should be 800)
        status: 'confirmed',
      });

      await Payment.create({
        reservation_id: reservation._id,
        staff_id: new Staff()._id,
        shift_id: new Shift()._id,
        amount: toPiastres(800),
        payment_method: 'instapay',
        payment_datetime: new Date(),
        payment_verified: true,
      });

      // 1. Audit without fix
      const auditRes = await admin.checkPaidCache({ fix: false });
      expect(auditRes.discrepancies_count).toBe(1);
      expect(auditRes.discrepancies[0].expected_egp).toBe(800);
      expect(auditRes.discrepancies[0].actual_egp).toBe(500);
      expect(auditRes.discrepancies[0].fixed).toBe(false);

      // Verify paid_cache was untouched
      const untouched = await Reservation.findById(reservation._id);
      expect(untouched.paid_cache).toBe(toPiastres(500));

      // 2. Audit with fix
      const fixRes = await admin.checkPaidCache({
        fix: true,
        by: 'Lead Auditor',
        reason: 'Sync paid_cache discrepancy with actual payments',
        yes: true,
      });

      expect(fixRes.discrepancies_count).toBe(1);
      expect(fixRes.discrepancies[0].fixed).toBe(true);

      const fixed = await Reservation.findById(reservation._id);
      expect(fixed.paid_cache).toBe(toPiastres(800));

      // 3. Re-check: zero discrepancies remaining
      const cleanAudit = await admin.checkPaidCache({ fix: false });
      expect(cleanAudit.discrepancies_count).toBe(0);
    });
  });
});
