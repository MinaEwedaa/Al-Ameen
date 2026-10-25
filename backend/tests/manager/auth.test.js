const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const app = require('../../src/app');
const {
  Staff,
  Session,
  DailyClosing,
  ShiftReport,
  ApprovalRequest,
  LeaveRequest,
  PasswordResetRequest,
  AuditLog,
  IdempotencyKey,
  Shift,
} = require('../../src/db/models');
const { makeToken } = require('../helpers/managerAuth');
const { hashPassword } = require('../../src/utils/password');

describe('Manager Module M2: Manager Login and Passwords', () => {
  let managerStaff;
  let managerSession;
  let managerToken;

  let receptionistStaff;
  let receptionistSession;
  let receptionistToken;

  const testPassword = 'Password123!';

  beforeAll(async () => {
    // 1. Create a manager with known password
    const mPwHash = await hashPassword(testPassword);
    managerStaff = await Staff.create({
      username: 'manager_m2_test',
      name: 'Manager Test User',
      password_hash: mPwHash,
      role: 'manager',
      default_shift_type: null,
      email: 'manager.m2@alamin.com',
      phone: '+201011112222',
      department: 'Management',
      active: true,
    });

    const mHelper = await makeToken('manager', { staff: managerStaff });
    managerSession = mHelper.session;
    managerToken = mHelper.token;

    // 2. Create a receptionist with known password
    const rPwHash = await hashPassword(testPassword);
    receptionistStaff = await Staff.create({
      username: 'receptionist_m2_test',
      name: 'Receptionist Test User',
      password_hash: rPwHash,
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
    });

    const rHelper = await makeToken('receptionist', { staff: receptionistStaff });
    receptionistSession = rHelper.session;
    receptionistToken = rHelper.token;
  });

  describe('Manager Login & Session', () => {
    test('manager login: 200, staff.role=manager, shift=null, read_only=false, no Shift created', async () => {
      await Staff.create({
        username: 'login_manager_test',
        name: 'Login Manager Test',
        password_hash: await hashPassword(testPassword),
        role: 'manager',
        active: true,
      });

      const shiftsBefore = await Shift.countDocuments({});

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'login_manager_test', password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.staff.role).toBe('manager');
      expect(res.body.shift).toBeNull();
      expect(res.body.read_only).toBe(false);

      const shiftsAfter = await Shift.countDocuments({});
      expect(shiftsAfter).toBe(shiftsBefore);
    });

    test('housekeeper login returns 403', async () => {
      const hkPwHash = await hashPassword(testPassword);
      await Staff.create({
        username: 'housekeeper_test',
        name: 'Housekeeper Test',
        password_hash: hkPwHash,
        role: 'housekeeper',
        active: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'housekeeper_test', password: testPassword });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('manager lockout: wrong password 5 times locks account, 6th attempt gets 429', async () => {
      await Staff.create({
        username: 'lock_manager_test',
        name: 'Lock Manager Test',
        password_hash: await hashPassword(testPassword),
        role: 'manager',
        active: true,
      });

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ username: 'lock_manager_test', password: 'wrongPassword!' });
        if (i < 4) {
          expect(res.status).toBe(401);
        } else {
          expect(res.status).toBe(429);
        }
      }

      // 6th attempt -> 429
      const sixth = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'lock_manager_test', password: 'wrongPassword!' });

      expect(sixth.status).toBe(429);
      expect(sixth.headers['retry-after']).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    test('manager response includes open_business_day and staff details', async () => {
      await DailyClosing.deleteMany({});
      await DailyClosing.create({
        business_date: '2026-11-05',
        status: 'OPEN',
        opened_at: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.staff.role).toBe('manager');
      expect(res.body.staff.staff_type).toBe('MANAGER');
      expect(res.body.staff.email).toBe('manager.m2@alamin.com');
      expect(res.body.open_business_day).not.toBeNull();
      expect(res.body.open_business_day.business_date).toBe('2026-11-05');
      expect(res.body.shift).toBeNull();
      expect(res.body.read_only).toBe(false);
    });

    test('receptionist response shape remains unchanged', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('staff');
      expect(res.body).toHaveProperty('shift');
      expect(res.body).toHaveProperty('read_only');
      expect(res.body.open_business_day).toBeUndefined();
    });
  });

  describe('PATCH /api/v1/auth/me', () => {
    test('manager can update profile details', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          full_name: 'أحمد المدير المحدث',
          phone: '01099887766',
          email: 'updated.manager@alamin.com',
        });

      expect(res.status).toBe(200);
      expect(res.body.full_name).toBe('أحمد المدير المحدث');
      expect(res.body.phone).toBe('+201099887766');
      expect(res.body.email).toBe('updated.manager@alamin.com');

      const updated = await Staff.findById(managerStaff._id);
      expect(updated.name).toBe('أحمد المدير المحدث');
      expect(updated.name_search).toBe('احمد المدير المحدث');
      expect(updated.phone).toBe('+201099887766');
    });

    test('duplicate email returns 409 CONFLICT', async () => {
      await Staff.create({
        username: 'other_user_email',
        name: 'Other User',
        email: 'duplicate.email@alamin.com',
        password_hash: 'x',
        role: 'manager',
        active: true,
      });

      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ email: 'duplicate.email@alamin.com' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    test('empty body returns 400', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    test('receptionist token gets 403', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ phone: '01011112222' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let cpStaff;
    let cpToken1;
    let cpToken2;
    const initialPw = 'InitialSecret123!';

    beforeEach(async () => {
      cpStaff = await Staff.create({
        username: 'cp_test_' + Date.now(),
        name: 'CP Test User',
        password_hash: await hashPassword(initialPw),
        role: 'manager',
        active: true,
      });

      // Session 1 (current)
      const s1 = await Session.create({
        staff_id: cpStaff._id,
        refresh_hash: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 3600e3),
      });
      const { signAccess } = require('../../src/modules/auth/auth.service');
      cpToken1 = signAccess({ staffId: cpStaff._id, sessionId: s1._id, role: 'manager' });

      // Session 2 (sibling)
      const s2 = await Session.create({
        staff_id: cpStaff._id,
        refresh_hash: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 3600e3),
      });
      cpToken2 = signAccess({ staffId: cpStaff._id, sessionId: s2._id, role: 'manager' });
    });

    test('wrong current password returns 400 with details', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${cpToken1}`)
        .send({ current_password: 'wrongCurrentPassword!', new_password: 'NewStrongPassword123!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({ field: 'current_password', issue: 'incorrect' });
    });

    test('weak new password returns 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${cpToken1}`)
        .send({ current_password: initialPw, new_password: 'weak' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('same password as current returns 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${cpToken1}`)
        .send({ current_password: initialPw, new_password: initialPw });

      expect(res.status).toBe(400);
    });

    test('success returns 204, revokes sibling sessions, keeps current session', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${cpToken1}`)
        .send({ current_password: initialPw, new_password: 'BrandNewPassword123!' });

      expect(res.status).toBe(204);

      // Current token 1 still works
      const testCurr = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${cpToken1}`);
      expect(testCurr.status).toBe(200);

      // Sibling token 2 is revoked -> 401
      const testSibling = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${cpToken2}`);
      expect(testSibling.status).toBe(401);
    });

    test('receptionist gets 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ current_password: testPassword, new_password: 'NewStrongPassword123!' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/auth/me/stats & activities', () => {
    test('returns accurate stats and activities', async () => {
      const helper = await makeToken('manager');

      // Add a ShiftReport reviewed by this manager
      await ShiftReport.create({
        shift_id: new mongoose.Types.ObjectId(),
        pdf: Buffer.from('dummy'),
        sha256: 'dummy',
        reviewed_by_staff_id: helper.staff._id,
        review_status: 'APPROVED',
      });

      // Add another report with PENDING_REVIEW
      await ShiftReport.create({
        shift_id: new mongoose.Types.ObjectId(),
        pdf: Buffer.from('dummy2'),
        sha256: 'dummy2',
        review_status: 'PENDING_REVIEW',
      });

      // Add an audit log entry
      await AuditLog.create({
        action: 'UPDATED_PROFILE',
        actor_staff_id: helper.staff._id,
        at: new Date(),
      });

      // Query stats
      const statsRes = await request(app)
        .get('/api/v1/auth/me/stats')
        .set('Authorization', `Bearer ${helper.token}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.audits_total).toBe(1);
      expect(statsRes.body.data.reports_pending_review).toBeGreaterThanOrEqual(1);

      // Query activities
      const actRes = await request(app)
        .get('/api/v1/auth/me/activities?limit=5')
        .set('Authorization', `Bearer ${helper.token}`);

      expect(actRes.status).toBe(200);
      expect(Array.isArray(actRes.body)).toBe(true);
      expect(actRes.body.length).toBeGreaterThanOrEqual(1);
      expect(actRes.body[0].action).toBe('UPDATED_PROFILE');
    });
  });

  describe('Public Password Reset Requests', () => {
    test('non-existent username returns 202 and creates no request', async () => {
      const countBefore = await PasswordResetRequest.countDocuments({});
      const res = await request(app)
        .post('/api/v1/auth/password-reset-requests')
        .send({ username: 'non_existent_user_999' });

      expect(res.status).toBe(202);
      expect(res.body.data.message).toContain('If the account exists');
      const countAfter = await PasswordResetRequest.countDocuments({});
      expect(countAfter).toBe(countBefore);
    });

    test('manager username returns 202 and creates no request', async () => {
      const countBefore = await PasswordResetRequest.countDocuments({});
      const res = await request(app)
        .post('/api/v1/auth/password-reset-requests')
        .send({ username: managerStaff.username });

      expect(res.status).toBe(202);
      const countAfter = await PasswordResetRequest.countDocuments({});
      expect(countAfter).toBe(countBefore);
    });

    test('existing receptionist username creates a PENDING request; second call is not duplicated', async () => {
      await PasswordResetRequest.deleteMany({ username: receptionistStaff.username });

      // First call
      const res1 = await request(app)
        .post('/api/v1/auth/password-reset-requests')
        .send({ username: receptionistStaff.username });

      expect(res1.status).toBe(202);

      const reqDoc = await PasswordResetRequest.findOne({ username: receptionistStaff.username });
      expect(reqDoc).not.toBeNull();
      expect(reqDoc.status).toBe('PENDING');

      // Second call does not duplicate
      const res2 = await request(app)
        .post('/api/v1/auth/password-reset-requests')
        .send({ username: receptionistStaff.username });

      expect(res2.status).toBe(202);
      const allReqs = await PasswordResetRequest.find({ username: receptionistStaff.username });
      expect(allReqs.length).toBe(1);
    });
  });

  describe('Manager Decision Workflow', () => {
    let testStaff;
    let resetReq;

    beforeEach(async () => {
      const { DateTime } = require('luxon');
      const hour = DateTime.now().setZone('Africa/Cairo').hour;
      const currentShiftType = hour >= 7 && hour < 16 ? 'morning' : (hour >= 16 && hour < 23 ? 'evening' : 'night');

      testStaff = await Staff.create({
        username: 'employee_to_reset_' + Date.now(),
        name: 'Employee Reset Target',
        password_hash: await hashPassword('OldPassword123!'),
        role: 'receptionist',
        default_shift_type: currentShiftType,
        failed_attempts: 4,
        lock_level: 2,
        active: true,
      });

      // Employee active session
      await Session.create({
        staff_id: testStaff._id,
        refresh_hash: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 3600e3),
      });

      resetReq = await PasswordResetRequest.create({
        staff_id: testStaff._id,
        username: testStaff.username,
        status: 'PENDING',
        requested_ip: '127.0.0.1',
      });
    });

    test('APPROVAL changes password, clears lock, revokes old sessions, temporary_password is redacted in IdempotencyKey', async () => {
      const idempKey = crypto.randomUUID();

      const res = await request(app)
        .patch(`/api/v1/manager/password-reset-requests/${resetReq._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', idempKey)
        .send({ action: 'APPROVE', manager_comment: 'Approved by manager' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.temporary_password).toBeDefined();
      const tempPass = res.body.data.temporary_password;

      // Verify employee can log in with temporary password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: testStaff.username, password: tempPass });
      expect(loginRes.status).toBe(200);

      // Verify lock counters zeroed
      const updatedStaff = await Staff.findById(testStaff._id);
      expect(updatedStaff.failed_attempts).toBe(0);
      expect(updatedStaff.lock_level).toBe(0);

      // Verify old sessions revoked
      const oldSessions = await Session.find({ staff_id: testStaff._id, revoked_at: null });
      // Only the new login session is active
      expect(oldSessions.length).toBe(1);

      // Repeating same request with same Idempotency-Key: temporary_password is null
      const replayRes = await request(app)
        .patch(`/api/v1/manager/password-reset-requests/${resetReq._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', idempKey)
        .send({ action: 'APPROVE', manager_comment: 'Approved by manager' });

      expect(replayRes.status).toBe(200);
      expect(replayRes.body.data.temporary_password).toBeNull();

      // Check that IdempotencyKey.response_body in DB does not contain the temporary password
      const idempDoc = await IdempotencyKey.findOne({ key: idempKey }).lean();
      expect(idempDoc.response_body.data.temporary_password).toBeNull();

      // A decision with a new key on already decided request returns 409
      const secondDecision = await request(app)
        .patch(`/api/v1/manager/password-reset-requests/${resetReq._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ action: 'APPROVE', manager_comment: 'Second attempt' });

      expect(secondDecision.status).toBe(409);
    });

    test('REJECTION changes status only, returns no temporary password', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/password-reset-requests/${resetReq._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ action: 'REJECT', manager_comment: 'Not justified' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.temporary_password).toBeNull();

      const doc = await PasswordResetRequest.findById(resetReq._id);
      expect(doc.status).toBe('REJECTED');
      expect(doc.manager_comment).toBe('Not justified');
    });
  });
});
