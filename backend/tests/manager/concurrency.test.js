// Feature M14: Concurrency Verification Tests (tests/manager/concurrency.test.js)
// Asserts race conditions resolve cleanly:
// 1. Two simultaneous decisions on one approval request -> exactly one winner
// 2. Two simultaneous decisions on one leave request -> exactly one winner
// 3. Two simultaneous decisions on one password reset request -> exactly one winner
// 4. Two simultaneous opens -> exactly one winner
// 5. Two simultaneous closes -> exactly one winner

const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const app = require('../../src/app');
const {
  Staff,
  Session,
  ApprovalRequest,
  LeaveRequest,
  PasswordResetRequest,
  DailyClosing,
  Shift,
  Payment,
  Setting,
} = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { todayCairo, ZONE, setShiftHours } = require('../../src/utils/time');

jest.setTimeout(60000);

describe('Manager Feature M14: Concurrency & Race Conditions', () => {
  let manager1, manager2, staffUser;
  let mgr1Token, mgr2Token;

  const key = () => crypto.randomUUID();
  const auth1 = () => ({ Authorization: `Bearer ${mgr1Token}` });
  const auth2 = () => ({ Authorization: `Bearer ${mgr2Token}` });

  beforeAll(async () => {
    setShiftHours({
      morning: { start: 7, end: 15 },
      evening: { start: 15, end: 23 },
      night: { start: 23, end: 7 },
    });

    await Staff.deleteMany({});
    await Session.deleteMany({});
    await ApprovalRequest.deleteMany({});
    await LeaveRequest.deleteMany({});
    await PasswordResetRequest.deleteMany({});
    await DailyClosing.deleteMany({});
    await Shift.deleteMany({});
    await Setting.deleteMany({});

    await Setting.create({
      key: 'hotel',
      value: { name: 'Al-Amin Grand Hotel', location: 'Alexandria', count_floors: 5 },
    });

    const pwdHash = await hashPassword('Password123');

    manager1 = await Staff.create({
      username: 'concurrency_mgr_1',
      password_hash: pwdHash,
      name: 'Manager One',
      role: 'manager',
      active: true,
      email: 'mgr1@hotel.com',
      phone: '+201000000501',
    });

    manager2 = await Staff.create({
      username: 'concurrency_mgr_2',
      password_hash: pwdHash,
      name: 'Manager Two',
      role: 'manager',
      active: true,
      email: 'mgr2@hotel.com',
      phone: '+201000000502',
    });

    staffUser = await Staff.create({
      username: 'concurrency_receptionist',
      password_hash: pwdHash,
      name: 'Receptionist Mona',
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
      email: 'mona.rec@hotel.com',
      phone: '+201000000503',
    });

    const s1 = await Session.create({
      staff_id: manager1._id,
      refresh_hash: 'h1',
      expires_at: new Date(Date.now() + 86400e3),
    });
    const s2 = await Session.create({
      staff_id: manager2._id,
      refresh_hash: 'h2',
      expires_at: new Date(Date.now() + 86400e3),
    });

    mgr1Token = signAccess({ staffId: manager1._id, sessionId: s1._id, role: 'manager' });
    mgr2Token = signAccess({ staffId: manager2._id, sessionId: s2._id, role: 'manager' });
  });

  test('Two simultaneous decisions on one ApprovalRequest: exactly one 200 winner, other 409', async () => {
    const approval = await ApprovalRequest.create({
      request_type: 'DISCOUNT',
      requested_by_staff_id: staffUser._id,
      reason: 'Special corporate discount',
      proposed_value: 100,
      status: 'PENDING',
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/v1/manager/approvals/${approval._id}/decision`)
        .set(auth1())
        .set('Idempotency-Key', key())
        .send({ action: 'APPROVE', manager_comment: 'Approved by Mgr 1' }),
      request(app)
        .patch(`/api/v1/manager/approvals/${approval._id}/decision`)
        .set(auth2())
        .set('Idempotency-Key', key())
        .send({ action: 'REJECT', manager_comment: 'Rejected by Mgr 2' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const fresh = await ApprovalRequest.findById(approval._id);
    expect(['APPROVED', 'REJECTED']).toContain(fresh.status);
  });

  test('Two simultaneous decisions on one LeaveRequest: exactly one 200 winner, other 409', async () => {
    const nextWeek = DateTime.now().setZone(ZONE).plus({ days: 7 }).toISODate();
    const leave = await LeaveRequest.create({
      staff_id: staffUser._id,
      leave_type: 'ANNUAL',
      start_date: nextWeek,
      end_date: nextWeek,
      reason: 'Family visit',
      status: 'PENDING',
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/v1/manager/leave-requests/${leave._id}/decision`)
        .set(auth1())
        .send({ action: 'APPROVE', manager_comment: 'Approved by Mgr 1' }),
      request(app)
        .patch(`/api/v1/manager/leave-requests/${leave._id}/decision`)
        .set(auth2())
        .send({ action: 'REJECT', manager_comment: 'Rejected by Mgr 2' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const fresh = await LeaveRequest.findById(leave._id);
    expect(['APPROVED', 'REJECTED']).toContain(fresh.status);
  });

  test('Two simultaneous decisions on one PasswordResetRequest: exactly one 200 winner, other 409', async () => {
    const prr = await PasswordResetRequest.create({
      staff_id: staffUser._id,
      username: staffUser.username,
      reason: 'Forgot account password',
      status: 'PENDING',
    });

    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/v1/manager/password-reset-requests/${prr._id}/decision`)
        .set(auth1())
        .set('Idempotency-Key', key())
        .send({ action: 'APPROVE' }),
      request(app)
        .patch(`/api/v1/manager/password-reset-requests/${prr._id}/decision`)
        .set(auth2())
        .set('Idempotency-Key', key())
        .send({ action: 'REJECT', manager_comment: 'Rejected request' }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const fresh = await PasswordResetRequest.findById(prr._id);
    expect(['APPROVED', 'REJECTED']).toContain(fresh.status);
  });

  test('Two simultaneous day opens: exactly one 201 winner, other 409', async () => {
    // Ensure no open day exists
    await DailyClosing.deleteMany({});

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/manager/daily-closings/open')
        .set(auth1())
        .set('Idempotency-Key', key())
        .send({}),
      request(app)
        .post('/api/v1/manager/daily-closings/open')
        .set(auth2())
        .set('Idempotency-Key', key())
        .send({}),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const openCount = await DailyClosing.countDocuments({ status: 'OPEN' });
    expect(openCount).toBe(1);
  });

  test('Two simultaneous day closes: exactly one 200 winner, other 409', async () => {
    // Current open day has no blockers
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/manager/daily-closings/close')
        .set(auth1())
        .set('Idempotency-Key', key())
        .send({ actual_cash: 0 }),
      request(app)
        .post('/api/v1/manager/daily-closings/close')
        .set(auth2())
        .set('Idempotency-Key', key())
        .send({ actual_cash: 0 }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const closedCount = await DailyClosing.countDocuments({ status: 'CLOSED' });
    expect(closedCount).toBe(1);
  });
});

