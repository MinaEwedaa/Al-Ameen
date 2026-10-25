// Tests for Manager Feature M7: Leave Requests

const request = require('supertest');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Shift,
  ShiftSchedule,
  LeaveRequest,
  Notification,
} = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { todayCairo, shiftWindow } = require('../../src/utils/time');

describe('Manager Feature M7: Leave Requests', () => {
  let manager1, manager2, receptionist;
  let manager1Token, manager2Token, receptionistToken;
  const today = todayCairo();

  beforeEach(async () => {
    await Staff.deleteMany({});
    await Session.deleteMany({});
    await Shift.deleteMany({});
    await ShiftSchedule.deleteMany({});
    await LeaveRequest.deleteMany({});
    await Notification.deleteMany({});

    const pwdHash = await hashPassword('Password123');

    manager1 = await Staff.create({
      username: 'manager_leave1',
      password_hash: pwdHash,
      name: 'Manager One',
      role: 'manager',
      department: 'Management',
      active: true,
      email: 'm1@hotel.com',
      notification_prefs: { leave_request: true },
    });

    manager2 = await Staff.create({
      username: 'manager_leave2',
      password_hash: pwdHash,
      name: 'Manager Two',
      role: 'manager',
      department: 'Management',
      active: true,
      email: 'm2@hotel.com',
      notification_prefs: { leave_request: true },
    });

    receptionist = await Staff.create({
      username: 'rec_leave',
      password_hash: pwdHash,
      name: 'Sara Receptionist',
      role: 'receptionist',
      department: 'Front Desk',
      default_shift_type: 'morning',
      active: true,
      email: 'sara@hotel.com',
    });

    const m1Session = await Session.create({
      staff_id: manager1._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    manager1Token = signAccess({ staffId: manager1._id, sessionId: m1Session._id, role: 'manager' });

    const m2Session = await Session.create({
      staff_id: manager2._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    manager2Token = signAccess({ staffId: manager2._id, sessionId: m2Session._id, role: 'manager' });

    const rSession = await Session.create({
      staff_id: receptionist._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    receptionistToken = signAccess({ staffId: receptionist._id, sessionId: rSession._id, role: 'receptionist' });
  });

  describe('1. POST /api/v1/leave-requests (Receptionist Request)', () => {
    it('creates request and notifies managers with leave_request enabled', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          leave_type: 'ANNUAL',
          start_date: '2026-11-10',
          end_date: '2026-11-12',
          reason: 'Family trip',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.leave_type).toBe('ANNUAL');
      expect(res.body.data.status).toBe('PENDING');

      // Verify manager notification created
      const notifs = await Notification.find({ type: 'LEAVE_REQUEST' });
      expect(notifs.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects past dates with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          leave_type: 'SICK',
          start_date: '2020-01-01',
          end_date: '2020-01-02',
          reason: 'Fever',
        });

      expect(res.status).toBe(400);
    });

    it('rejects overlapping pending/approved leaves with 409 CONFLICT', async () => {
      await LeaveRequest.create({
        staff_id: receptionist._id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-10',
        end_date: '2026-11-15',
        status: 'PENDING',
      });

      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          leave_type: 'SICK',
          start_date: '2026-11-12',
          end_date: '2026-11-18',
          reason: 'Overlap test',
        });

      expect(res.status).toBe(409);
    });

    it('rejects more than 5 pending requests with 409 CONFLICT', async () => {
      for (let i = 1; i <= 5; i++) {
        await LeaveRequest.create({
          staff_id: receptionist._id,
          leave_type: 'UNPAID',
          start_date: `2026-12-0${i}`,
          end_date: `2026-12-0${i}`,
          status: 'PENDING',
        });
      }

      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({
          leave_type: 'UNPAID',
          start_date: '2026-12-20',
          end_date: '2026-12-21',
          reason: 'Sixth pending request',
        });

      expect(res.status).toBe(409);
    });

    it('rejects manager token on receptionist route with 403', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          leave_type: 'ANNUAL',
          start_date: '2026-11-10',
          end_date: '2026-11-12',
          reason: 'Manager asking leave',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Manager List & Detail (/manager/leave-requests)', () => {
    let leaveDoc;

    beforeEach(async () => {
      leaveDoc = await LeaveRequest.create({
        staff_id: receptionist._id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-10',
        end_date: '2026-11-12',
        reason: 'Rest and relaxation',
        status: 'PENDING',
      });
    });

    it('lists leave requests with scheduled_shifts_in_period counted', async () => {
      const res = await request(app)
        .get('/api/v1/manager/leave-requests')
        .set('Authorization', `Bearer ${manager1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(String(leaveDoc._id));
      expect(res.body.data[0].staff_name).toBe(receptionist.name);
      expect(res.body.data[0]).toHaveProperty('scheduled_shifts_in_period');
    });

    it('gets leave request detail with conflicts and overlapping approved leaves', async () => {
      const res = await request(app)
        .get(`/api/v1/manager/leave-requests/${leaveDoc._id}`)
        .set('Authorization', `Bearer ${manager1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(String(leaveDoc._id));
      expect(res.body.data).toHaveProperty('conflicts');
      expect(res.body.data).toHaveProperty('overlapping_approved_leaves');
    });

    it('returns 404 for non-existent leave request', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/v1/manager/leave-requests/${fakeId}`)
        .set('Authorization', `Bearer ${manager1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('3. Manager Decision (/manager/leave-requests/:id/decision)', () => {
    let leaveDoc;

    beforeEach(async () => {
      leaveDoc = await LeaveRequest.create({
        staff_id: receptionist._id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-10',
        end_date: '2026-11-12',
        reason: 'Rest',
        status: 'PENDING',
      });
    });

    it('rejects deciding own leave request with 403 CANNOT_APPROVE_OWN_REQUEST', async () => {
      const ownLeave = await LeaveRequest.create({
        staff_id: manager1._id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-20',
        end_date: '2026-11-22',
        reason: 'Manager own leave',
        status: 'PENDING',
      });

      const res = await request(app)
        .patch(`/api/v1/manager/leave-requests/${ownLeave._id}/decision`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('CANNOT_APPROVE_OWN_REQUEST');
    });

    it('rejects REJECT without manager_comment with 400 Bad Request', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/leave-requests/${leaveDoc._id}/decision`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({ action: 'REJECT' });

      expect(res.status).toBe(400);
    });

    it('approves request with cancellation: cancels future shifts and notifies employee', async () => {
      // Future shift in range
      const win = shiftWindow('2026-11-10', 'morning');
      await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: '2026-11-10',
        shift_type: 'morning',
        start_at: win.start_at,
        end_at: win.end_at,
        status: 'SCHEDULED',
      });

      const res = await request(app)
        .patch(`/api/v1/manager/leave-requests/${leaveDoc._id}/decision`)
        .set('Authorization', `Bearer ${manager1Token}`)
        .send({
          action: 'APPROVE',
          cancel_scheduled_shifts: true,
          manager_comment: 'Approved, enjoy your break',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.shifts_cancelled_count).toBe(3);

      // Verify shift schedule cancelled
      const sched = await ShiftSchedule.findOne({ staff_id: receptionist._id, shift_date: '2026-11-10' });
      expect(sched.status).toBe('CANCELLED');
      expect(sched.cancel_reason).toBe('LEAVE_APPROVED');

      // Verify notification sent to employee
      const notif = await Notification.findOne({ recipient_staff_id: receptionist._id, type: 'LEAVE_DECISION' });
      expect(notif).toBeTruthy();

      // Second decision call gives 409 RECORD_ALREADY_DECIDED
      const res2 = await request(app)
        .patch(`/api/v1/manager/leave-requests/${leaveDoc._id}/decision`)
        .set('Authorization', `Bearer ${manager2Token}`)
        .send({ action: 'REJECT', manager_comment: 'Duplicate decision' });

      expect(res2.status).toBe(409);
      expect(res2.body.error?.code || res2.body.code).toBe('RECORD_ALREADY_DECIDED');
    });
  });

  describe('4. Access Control', () => {
    it('returns 403 when receptionist calls manager leave routes', async () => {
      const res = await request(app)
        .get('/api/v1/manager/leave-requests')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/manager/leave-requests');
      expect(res.status).toBe(401);
    });
  });
});
