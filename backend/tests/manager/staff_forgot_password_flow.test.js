const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const {
  Staff,
  Session,
  PasswordResetRequest,
} = require('../../src/db/models');
const { makeToken } = require('../helpers/managerAuth');
const { hashPassword } = require('../../src/utils/password');

describe('End-to-End Staff Forgot Password & Manager Handout Flow', () => {
  let managerStaff;
  let managerToken;

  let staffMember;
  const originalPassword = 'InitialSecretPassword123!';
  const customTempPassword = 'Al-Amin#Super2026';

  beforeAll(async () => {
    // 1. Create a Manager
    managerStaff = await Staff.create({
      username: 'mgr_handout_' + Date.now(),
      name: 'Manager Handout Tester',
      password_hash: await hashPassword('ManagerPass123!'),
      role: 'manager',
      default_shift_type: null,
      active: true,
    });

    const mHelper = await makeToken('manager', { staff: managerStaff });
    managerToken = mHelper.token;

    const { DateTime } = require('luxon');
    const hour = DateTime.now().setZone('Africa/Cairo').hour;
    const currentShiftType = hour >= 7 && hour < 16 ? 'morning' : (hour >= 16 && hour < 23 ? 'evening' : 'night');

    // 2. Create a Receptionist staff member
    staffMember = await Staff.create({
      username: 'staff_reset_' + Date.now(),
      name: 'Khaled Receptionist',
      password_hash: await hashPassword(originalPassword),
      role: 'receptionist',
      default_shift_type: currentShiftType,
      active: true,
      failed_attempts: 3,
      lock_level: 1,
    });
  });

  afterAll(async () => {
    if (staffMember) {
      await Staff.deleteOne({ _id: staffMember._id });
      await PasswordResetRequest.deleteMany({ staff_id: staffMember._id });
      await Session.deleteMany({ staff_id: staffMember._id });
    }
    if (managerStaff) {
      await Staff.deleteOne({ _id: managerStaff._id });
      await Session.deleteMany({ staff_id: managerStaff._id });
    }
  });

  test('Step 0: Non-existent staff and manager account rejections', async () => {
    const randomRes = await request(app)
      .post('/api/v1/auth/password-reset-requests')
      .send({ username: 'non_existent_ghost_user' });
    expect(randomRes.status).toBe(404);
    expect(randomRes.body.error.code).toBe('STAFF_NOT_FOUND');

    const mgrRes = await request(app)
      .post('/api/v1/auth/password-reset-requests')
      .send({ username: managerStaff.username });
    expect(mgrRes.status).toBe(403);
    expect(mgrRes.body.error.code).toBe('MANAGER_CANNOT_RESET');
  });

  test('Step 1: Staff presses forget password with username, creating PENDING request and IMMEDIATELY invalidating old password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/password-reset-requests')
      .send({ username: staffMember.username });

    expect(res.status).toBe(202);
    expect(res.body.data.message).toContain('Password reset request sent');

    const reqDoc = await PasswordResetRequest.findOne({ staff_id: staffMember._id, status: 'PENDING' });
    expect(reqDoc).not.toBeNull();
    expect(reqDoc.username).toBe(staffMember.username);

    // Old password must IMMEDIATELY fail before manager even approves it!
    const oldLoginBeforeApproval = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: staffMember.username,
        password: originalPassword,
      });
    expect(oldLoginBeforeApproval.status).toBe(401);
  });

  test('Step 2: Manager lists requests and sees the staff member request with metadata', async () => {
    const res = await request(app)
      .get('/api/v1/manager/password-reset-requests?status=PENDING')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const match = res.body.data.find((item) => item.username === staffMember.username);
    expect(match).toBeDefined();
    expect(match.staff_name).toBe(staffMember.name);
    expect(match.role).toBe('receptionist');
    expect(match.staff_type).toBe('RECEPTIONIST');
    expect(match.status).toBe('PENDING');
  });

  test('Step 3: Manager approves request with new temporary password', async () => {
    const reqDoc = await PasswordResetRequest.findOne({ staff_id: staffMember._id, status: 'PENDING' });
    expect(reqDoc).not.toBeNull();

    const idempKey = crypto.randomUUID();
    const res = await request(app)
      .patch(`/api/v1/manager/password-reset-requests/${reqDoc._id}/decision`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', idempKey)
      .send({
        action: 'APPROVE',
        temporary_password: customTempPassword,
        manager_comment: 'Generated and handed out offline',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.temporary_password).toBe(customTempPassword);

    // Verify DB request status
    const updatedDoc = await PasswordResetRequest.findById(reqDoc._id);
    expect(updatedDoc.status).toBe('APPROVED');
    expect(updatedDoc.decided_by_staff_id.toString()).toBe(managerStaff._id.toString());
  });

  test('Step 4: Staff member logs in with the new temporary password handed out offline', async () => {
    // 1. Old password should fail
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: staffMember.username,
        password: originalPassword,
      });
    expect(oldLoginRes.status).toBe(401);

    // 2. New temporary password handed out offline must succeed
    const newLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: staffMember.username,
        password: customTempPassword,
      });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body).toHaveProperty('access_token');
    expect(newLoginRes.body.staff.name).toBe(staffMember.name);

    // 3. Lock counters must have been reset to 0
    const refreshedStaff = await Staff.findById(staffMember._id);
    expect(refreshedStaff.failed_attempts).toBe(0);
    expect(refreshedStaff.lock_level).toBe(0);
  });
});
