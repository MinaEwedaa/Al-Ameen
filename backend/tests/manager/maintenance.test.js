const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Staff = require('../../src/db/models/Staff');
const Session = require('../../src/db/models/Session');
const Room = require('../../src/db/models/Room');
const RoomType = require('../../src/db/models/RoomType');
const MaintenanceIssue = require('../../src/db/models/MaintenanceIssue');
const { signAccess } = require('../../src/modules/auth/auth.service');

describe('Manager Maintenance Module (/api/v1/manager/maintenance-issues)', () => {
  let managerToken;
  let receptionistToken;
  let managerStaff;
  let techStaff;
  let testRoom;

  beforeAll(async () => {
    // 1. Create manager
    managerStaff = await Staff.create({
      username: `maint_manager_${Date.now()}`,
      name: 'Maintenance Manager',
      role: 'manager',
      status: 'active',
      password_hash: '$2b$10$abcdefghijklmnopqrstuu',
    });

    const sMgr = await Session.create({
      staff_id: managerStaff._id,
      refresh_hash: 'mgr_hash_maint',
      expires_at: new Date(Date.now() + 86400e3),
    });
    managerToken = signAccess({ staffId: managerStaff._id, sessionId: sMgr._id, role: 'manager' });

    // 2. Create receptionist
    const recStaff = await Staff.create({
      username: `maint_rec_${Date.now()}`,
      name: 'Maintenance Receptionist',
      role: 'receptionist',
      status: 'active',
      default_shift_type: 'morning',
      password_hash: '$2b$10$abcdefghijklmnopqrstuu',
    });
    const sRec = await Session.create({
      staff_id: recStaff._id,
      refresh_hash: 'rec_hash_maint',
      expires_at: new Date(Date.now() + 86400e3),
    });
    receptionistToken = signAccess({ staffId: recStaff._id, sessionId: sRec._id, role: 'receptionist' });

    // 3. Create technician
    techStaff = await Staff.create({
      username: `tech_ahmed_${Date.now()}`,
      name: 'Ahmed Tech',
      role: 'technician',
      status: 'active',
      password_hash: '$2b$10$abcdefghijklmnopqrstuu',
    });

    // 4. Create room type and room
    const roomType = await RoomType.create({
      name: `Standard Maint ${Date.now()}`,
      base_price: 100000,
    });
    testRoom = await Room.create({
      room_number: `9${Math.floor(10 + Math.random() * 89)}`,
      room_type_id: roomType._id,
      room_type: 'Normal',
      price_per_night: 100000,
      half_day_price: 50000,
      floor: 9,
      status: 'available',
    });
  });

  afterAll(async () => {
    await MaintenanceIssue.deleteMany({});
    await Staff.deleteMany({ _id: { $in: [managerStaff._id, techStaff._id] } });
    await Room.deleteMany({ _id: testRoom._id });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/manager/maintenance-issues');
    expect(res.statusCode).toBe(401);
  });

  it('rejects receptionist token with 403', async () => {
    const res = await request(app)
      .get('/api/v1/manager/maintenance-issues')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('allows manager to list maintenance tickets', async () => {
    const res = await request(app)
      .get('/api/v1/manager/maintenance-issues?limit=100')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('allows manager to create a maintenance ticket (without needing a shift)', async () => {
    const res = await request(app)
      .post('/api/v1/manager/maintenance-issues')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        room_id: String(testRoom._id),
        problem: 'Air conditioning not cooling',
        priority: 'RUSH',
        assigned_to_staff_id: String(techStaff._id),
        notes: 'Guest called reception',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toMatchObject({
      problem: 'Air conditioning not cooling',
      priority: 'RUSH',
      status: 'IN_PROGRESS',
      technician_name: 'Ahmed Tech',
    });
    expect(res.body.data.room_number).toBe(testRoom.room_number);
  });

  it('allows manager to update ticket status and expected resolution time', async () => {
    const created = await MaintenanceIssue.findOne({ room_id: testRoom._id });
    const res = await request(app)
      .patch(`/api/v1/manager/maintenance-issues/${created._id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        status: 'RESOLVED',
        notes: 'Filter cleaned and freon recharged',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('RESOLVED');
    expect(res.body.data.resolved_at).toBeTruthy();
  });
});
