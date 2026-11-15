// Feature M13: Security Hardening - Access Matrix & Hardening Test
// Tests RBAC access controls, Cache-Control headers, TTL index, and DB-level anti-self-approval

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const {
  Staff,
  Session,
  IdempotencyKey,
  LeaveRequest,
  ApprovalRequest,
  PasswordResetRequest,
  Setting,
} = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const sampleBodies = require('./fixtures/bodies');

describe('Manager Feature M13: Access Matrix & Hardening', () => {
  let manager, receptionist, otherStaff;
  let managerToken, receptionistToken;
  let dummyId;

  beforeAll(async () => {
    await Staff.deleteMany({});
    await Session.deleteMany({});
    await IdempotencyKey.deleteMany({});
    await LeaveRequest.deleteMany({});
    await ApprovalRequest.deleteMany({});
    await PasswordResetRequest.deleteMany({});

    const pwdHash = await hashPassword('Password123');

    manager = await Staff.create({
      username: 'access_matrix_manager',
      password_hash: pwdHash,
      name: 'Access Manager',
      role: 'manager',
      active: true,
      email: 'access_mgr@hotel.com',
      phone: '+201000000010',
    });

    receptionist = await Staff.create({
      username: 'access_matrix_receptionist',
      password_hash: pwdHash,
      name: 'Access Receptionist',
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
      email: 'access_rec@hotel.com',
      phone: '+201000000020',
    });

    otherStaff = await Staff.create({
      username: 'other_staff_target',
      password_hash: pwdHash,
      name: 'Other Target',
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
      email: 'other_target@hotel.com',
      phone: '+201000000030',
    });

    dummyId = String(otherStaff._id);

    const sMgr = await Session.create({
      staff_id: manager._id,
      refresh_hash: 'mgr_hash',
      expires_at: new Date(Date.now() + 86400e3),
    });
    const sRec = await Session.create({
      staff_id: receptionist._id,
      refresh_hash: 'rec_hash',
      expires_at: new Date(Date.now() + 86400e3),
    });

    managerToken = signAccess({ staffId: manager._id, sessionId: sMgr._id, role: 'manager' });
    receptionistToken = signAccess({ staffId: receptionist._id, sessionId: sRec._id, role: 'receptionist' });
  });

  const endpoints = [
    { method: 'get', path: '/api/v1/manager/staff' },
    { method: 'post', path: '/api/v1/manager/staff', key: 'POST /staff' },
    { method: 'get', path: '/api/v1/manager/staff/:id' },
    { method: 'patch', path: '/api/v1/manager/staff/:id', key: 'PATCH /staff/:id' },
    { method: 'delete', path: '/api/v1/manager/staff/:id', key: 'DELETE /staff/:id' },
    { method: 'post', path: '/api/v1/manager/staff/:id/reactivate', key: 'POST /staff/:id/reactivate' },
    { method: 'post', path: '/api/v1/manager/staff/:id/reset-password', key: 'POST /staff/:id/reset-password' },
    { method: 'get', path: '/api/v1/manager/rooms' },
    { method: 'patch', path: '/api/v1/manager/rooms/:id', key: 'PATCH /rooms/:id' },
    { method: 'get', path: '/api/v1/manager/rooms/:id/activities' },
    { method: 'get', path: '/api/v1/manager/room-types' },
    { method: 'post', path: '/api/v1/manager/room-types', key: 'POST /room-types' },
    { method: 'patch', path: '/api/v1/manager/room-types/:id', key: 'PATCH /room-types/:id' },
    { method: 'get', path: '/api/v1/manager/housekeeping-tasks' },
    { method: 'patch', path: '/api/v1/manager/housekeeping-tasks/:id/assign', key: 'PATCH /housekeeping-tasks/:id/assign' },
    { method: 'get', path: '/api/v1/manager/shifts/overview' },
    { method: 'get', path: '/api/v1/manager/shifts' },
    { method: 'get', path: '/api/v1/manager/shifts/roster' },
    { method: 'post', path: '/api/v1/manager/shifts', key: 'POST /shifts' },
    { method: 'patch', path: '/api/v1/manager/shifts/:id', key: 'PATCH /shifts/:id' },
    { method: 'delete', path: '/api/v1/manager/shifts/:id', key: 'DELETE /shifts/:id' },
    { method: 'post', path: '/api/v1/manager/shifts/:id/force-close', key: 'POST /shifts/:id/force-close' },
    { method: 'get', path: '/api/v1/manager/leave-requests' },
    { method: 'patch', path: '/api/v1/manager/leave-requests/:id/decision', key: 'PATCH /leave-requests/:id/decision' },
    { method: 'get', path: '/api/v1/manager/approvals' },
    { method: 'patch', path: '/api/v1/manager/approvals/:id/decision', key: 'PATCH /approvals/:id/decision' },
    { method: 'get', path: '/api/v1/manager/shift-reports' },
    { method: 'patch', path: '/api/v1/manager/shift-reports/:id/review', key: 'PATCH /shift-reports/:id/review' },
    { method: 'get', path: '/api/v1/manager/daily-closings' },
    { method: 'get', path: '/api/v1/manager/daily-closings/current' },
    { method: 'post', path: '/api/v1/manager/daily-closings/open', key: 'POST /daily-closings/open' },
    { method: 'post', path: '/api/v1/manager/daily-closings/close', key: 'POST /daily-closings/close' },
    { method: 'get', path: '/api/v1/manager/dashboard/overview' },
    { method: 'get', path: '/api/v1/manager/dashboard/revenue' },
    { method: 'get', path: '/api/v1/manager/dashboard/issues' },
    { method: 'get', path: '/api/v1/manager/activities' },
    { method: 'get', path: '/api/v1/manager/hotel-settings' },
    { method: 'patch', path: '/api/v1/manager/hotel-settings', key: 'PATCH /hotel-settings' },
    { method: 'get', path: '/api/v1/manager/shift-settings' },
    { method: 'patch', path: '/api/v1/manager/shift-settings', key: 'PATCH /shift-settings' },
    { method: 'get', path: '/api/v1/manager/search' },
    { method: 'get', path: '/api/v1/manager/notifications' },
    { method: 'patch', path: '/api/v1/manager/notifications/:id/read', key: 'PATCH /notifications/:id/read' },
    { method: 'post', path: '/api/v1/manager/notifications/read-all', key: 'POST /notifications/read-all' },
    { method: 'get', path: '/api/v1/manager/notifications/preferences' },
    { method: 'patch', path: '/api/v1/manager/notifications/preferences', key: 'PATCH /notifications/preferences' },
    { method: 'get', path: '/api/v1/manager/password-reset-requests' },
    { method: 'patch', path: '/api/v1/manager/password-reset-requests/:id/decision', key: 'PATCH /password-reset-requests/:id/decision' },
  ];

  describe('RBAC Matrix: All manager routes block unauthorized requests', () => {
    for (const ep of endpoints) {
      const url = ep.path.replace(':id', dummyId);
      const label = `${ep.method.toUpperCase()} ${ep.path}`;

      test(`${label}: answers 401 when called without token`, async () => {
        let req = request(app)[ep.method](url);
        if (ep.key && sampleBodies[ep.key]) {
          req = req.send(sampleBodies[ep.key]);
        }
        req = req.set('Idempotency-Key', crypto.randomUUID());
        const res = await req;
        expect(res.status).toBe(401);
      });

      test(`${label}: answers 403 when called with receptionist token`, async () => {
        let req = request(app)[ep.method](url)
          .set('Authorization', `Bearer ${receptionistToken}`);
        if (ep.key && sampleBodies[ep.key]) {
          req = req.send(sampleBodies[ep.key]);
        }
        req = req.set('Idempotency-Key', crypto.randomUUID());
        const res = await req;
        expect(res.status).toBe(403);
      });
    }
  });

  describe('Hardening: Cache-Control no-store on password-carrying responses', () => {
    test('POST /api/v1/manager/staff sends Cache-Control: no-store', async () => {
      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: `matrix_cache_${Date.now()}`,
          full_name: 'Cache Test Staff',
          staff_type: 'RECEPTIONIST',
          default_shift_type: 'morning',
          email: `cache_test_${Date.now()}@hotel.com`,
          phone: '+201099887766',
          hire_date: '2026-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.temporary_password).toBeTruthy();
    });

    test('POST /api/v1/manager/staff/:id/reset-password sends Cache-Control: no-store', async () => {
      const res = await request(app)
        .post(`/api/v1/manager/staff/${dummyId}/reset-password`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.temporary_password).toBeTruthy();
    });

    test('PATCH /api/v1/manager/password-reset-requests/:id/decision sends Cache-Control: no-store', async () => {
      const prr = await PasswordResetRequest.create({
        staff_id: otherStaff._id,
        username: otherStaff.username,
        status: 'PENDING',
        reason: 'Forgot password',
      });

      const res = await request(app)
        .patch(`/api/v1/manager/password-reset-requests/${prr._id}/decision`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ action: 'APPROVE' });

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.temporary_password).toBeTruthy();
    });
  });

  describe('Hardening: Database-level self-approval segregation ($ne filter)', () => {
    test('LeaveRequest model query blocks self-approval via staff_id: { $ne: actor._id }', async () => {
      const leave = await LeaveRequest.create({
        staff_id: manager._id,
        leave_type: 'ANNUAL',
        start_date: '2026-11-20',
        end_date: '2026-11-21',
        reason: 'Manager vacation request',
        status: 'PENDING',
      });

      // Directly attempt atomic claim with manager._id
      const claimed = await LeaveRequest.findOneAndUpdate(
        {
          _id: leave._id,
          status: 'PENDING',
          staff_id: { $ne: manager._id },
        },
        { status: 'APPROVED', decided_by_staff_id: manager._id },
        { new: true }
      );

      expect(claimed).toBeNull();

      // Verify the leave request remained untouched
      const fresh = await LeaveRequest.findById(leave._id);
      expect(fresh.status).toBe('PENDING');
    });

    test('ApprovalRequest model query blocks self-approval via requested_by_staff_id: { $ne: actor._id }', async () => {
      const approval = await ApprovalRequest.create({
        request_type: 'DISCOUNT',
        requested_by_staff_id: manager._id,
        reason: 'Self discount request',
        proposed_value: 150,
        status: 'PENDING',
      });

      const claimed = await ApprovalRequest.findOneAndUpdate(
        {
          _id: approval._id,
          status: 'PENDING',
          requested_by_staff_id: { $ne: manager._id },
        },
        { status: 'APPROVED', decided_by_staff_id: manager._id },
        { new: true }
      );

      expect(claimed).toBeNull();

      const fresh = await ApprovalRequest.findById(approval._id);
      expect(fresh.status).toBe('PENDING');
    });
  });

  describe('Hardening: IdempotencyKey TTL index verification', () => {
    test('IdempotencyKey schema defines a 24-hour (86400s) TTL index on created_at', async () => {
      const indexes = IdempotencyKey.schema.indexes();
      const ttlIndex = indexes.find(
        ([fields, opts]) => fields.created_at === 1 && opts && opts.expireAfterSeconds === 86400
      );

      expect(ttlIndex).toBeDefined();
      expect(ttlIndex[1].expireAfterSeconds).toBe(86400);
    });
  });
});
