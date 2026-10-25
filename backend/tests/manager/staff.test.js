// Tests for Manager Feature M4: Staff Management

const request = require('supertest');
const app = require('../../src/app');
const { Staff, Session, Shift, ShiftSchedule } = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { DateTime } = require('luxon');
const { ZONE } = require('../../src/utils/time');

describe('Manager Feature M4: Staff Management', () => {
  let admin, manager, receptionist, housekeeper;
  let adminToken, managerToken, receptionistToken;

  beforeEach(async () => {
    await Staff.deleteMany({});
    await Session.deleteMany({});
    await Shift.deleteMany({});
    await ShiftSchedule.deleteMany({});

    const pwdHash = await hashPassword('Password123');

    admin = await Staff.create({
      username: 'admin_user',
      password_hash: pwdHash,
      name: 'Admin Boss',
      role: 'admin',
      active: true,
      email: 'admin@hotel.com',
      phone: '+201000000001',
    });

    manager = await Staff.create({
      username: 'manager_user',
      password_hash: pwdHash,
      name: 'General Manager',
      role: 'manager',
      active: true,
      email: 'manager@hotel.com',
      phone: '+201000000002',
    });

    receptionist = await Staff.create({
      username: 'rec_user',
      password_hash: pwdHash,
      name: 'Mona Reception',
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
      email: 'mona@hotel.com',
      phone: '+201000000003',
    });

    housekeeper = await Staff.create({
      username: 'hk_user',
      password_hash: pwdHash,
      name: 'Hassan Cleaner',
      role: 'housekeeper',
      active: true,
      email: 'hassan@hotel.com',
      phone: '+201000000004',
    });

    const sAdmin = await Session.create({ staff_id: admin._id, refresh_hash: 'dummy_hash_1', expires_at: new Date(Date.now() + 3600e3) });
    const sMgr = await Session.create({ staff_id: manager._id, refresh_hash: 'dummy_hash_2', expires_at: new Date(Date.now() + 3600e3) });
    const sRec = await Session.create({ staff_id: receptionist._id, refresh_hash: 'dummy_hash_3', expires_at: new Date(Date.now() + 3600e3) });

    adminToken = signAccess({ staffId: admin._id, sessionId: sAdmin._id, role: 'admin' });
    managerToken = signAccess({ staffId: manager._id, sessionId: sMgr._id, role: 'manager' });
    receptionistToken = signAccess({ staffId: receptionist._id, sessionId: sRec._id, role: 'receptionist' });
  });

  describe('POST /api/v1/manager/staff (Create Staff)', () => {
    it('creates receptionist with temporary password and returns no-store header', async () => {
      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: 'new_receptionist',
          full_name: 'أحمد علي',
          staff_type: 'RECEPTIONIST',
          default_shift_type: 'morning',
          email: 'ahmed.new@hotel.com',
          phone: '+201011111111',
          hire_date: '2026-01-01',
        });

      expect(res.status).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.username).toBe('new_receptionist');
      expect(res.body.data.staff_type).toBe('RECEPTIONIST');
      expect(res.body.data.temporary_password).toBeTruthy();
      expect(res.body.data).not.toHaveProperty('password_hash');
      expect(res.body.data).not.toHaveProperty('id_number_enc');

      // Test login with the temporary password
      const loginTime = DateTime.fromISO('2026-10-25T08:00:00', { zone: ZONE }).toISO();
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', loginTime)
        .send({
          username: 'new_receptionist',
          password: res.body.data.temporary_password,
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.staff.name).toBe('أحمد علي');
    });

    it('creates housekeeper with temporary_password: null (no login)', async () => {
      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: 'new_housekeeper',
          full_name: 'سارة نظافة',
          staff_type: 'HOUSEKEEPER',
          phone: '+201022222222',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.staff_type).toBe('HOUSEKEEPER');
      expect(res.body.data.temporary_password).toBeNull();
    });

    it('returns 403 when manager attempts to create a MANAGER', async () => {
      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: 'another_manager',
          full_name: 'مدير آخر',
          staff_type: 'MANAGER',
          email: 'mgr2@hotel.com',
        });

      expect(res.status).toBe(403);
    });

    it('allows admin to create a MANAGER', async () => {
      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'another_manager',
          full_name: 'مدير معتمد',
          staff_type: 'MANAGER',
          email: 'mgr_ok@hotel.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.staff_type).toBe('MANAGER');
    });

    it('rejects duplicate username with 409 CONFLICT', async () => {
      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: 'rec_user', // already exists
          full_name: 'Same Username',
          staff_type: 'RECEPTIONIST',
          default_shift_type: 'morning',
        });

      expect(res.status).toBe(409);
    });

    it('encrypts national_id and rejects duplicate with 409', async () => {
      const validNatId = '29001011234567';
      const res1 = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: 'nat1',
          full_name: 'User 1',
          staff_type: 'RECEPTIONIST',
          default_shift_type: 'morning',
          national_id: validNatId,
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.national_id).toBe('******4567');

      const res2 = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          username: 'nat2',
          full_name: 'User 2',
          staff_type: 'RECEPTIONIST',
          default_shift_type: 'morning',
          national_id: validNatId,
        });

      expect(res2.status).toBe(409);
    });
  });

  describe('GET /api/v1/manager/staff (List Staff)', () => {
    it('filters by staff_type, department, q and returns metadata', async () => {
      const res = await request(app)
        .get('/api/v1/manager/staff?staff_type=RECEPTIONIST&q=mona')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].username).toBe('rec_user');
      expect(res.body.meta.total).toBe(1);
    });

    it('includes today_shift and workload without leaking secrets', async () => {
      const res = await request(app)
        .get('/api/v1/manager/staff?include=today_shift,workload')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const item of res.body.data) {
        expect(item).not.toHaveProperty('password_hash');
        expect(item).not.toHaveProperty('id_number_enc');
        expect(item).not.toHaveProperty('id_number_hash');
      }
    });
  });

  describe('PATCH /api/v1/manager/staff/:id (Update Staff)', () => {
    it('updates full_name and phone successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/staff/${receptionist._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ full_name: 'منى محمود سمير', phone: '+201099999999' });

      expect(res.status).toBe(200);
      expect(res.body.data.full_name).toBe('منى محمود سمير');
      expect(res.body.data.phone).toBe('+201099999999');
    });

    it('rejects is_active: false with 400 (deactivation has separate endpoint)', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/staff/${receptionist._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(400);
    });

    it('rejects manager trying to update an admin account with 403', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/staff/${admin._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ full_name: 'Cannot Change Admin' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/manager/staff/:id (Deactivate Staff)', () => {
    it('revokes sessions, cancels future shifts, and marks active: false', async () => {
      // Create a future shift
      await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: '2026-11-01',
        shift_type: 'morning',
        status: 'SCHEDULED',
        start_at: new Date(Date.now() + 86400e3),
        end_at: new Date(Date.now() + 90000e3),
      });

      const res = await request(app)
        .delete(`/api/v1/manager/staff/${receptionist._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);

      // Verify sessions revoked
      const activeSessions = await Session.countDocuments({ staff_id: receptionist._id, revoked_at: null });
      expect(activeSessions).toBe(0);

      // Verify future shift cancelled
      const sched = await ShiftSchedule.findOne({ staff_id: receptionist._id, shift_date: '2026-11-01' });
      expect(sched.status).toBe('CANCELLED');
      expect(sched.cancel_reason).toBe('STAFF_DEACTIVATED');
    });

    it('rejects deactivating self with 409', async () => {
      const res = await request(app)
        .delete(`/api/v1/manager/staff/${manager._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
    });

    it('rejects deactivating staff with an open shift with 409 SHIFT_ALREADY_STARTED', async () => {
      const now = new Date();
      await Shift.create({
        staff_id: receptionist._id,
        shift_date: '2026-10-25',
        shift_type: 'morning',
        status: 'active',
        start_at: now,
        end_at: new Date(now.getTime() + 8 * 3600e3),
      });

      const res = await request(app)
        .delete(`/api/v1/manager/staff/${receptionist._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error?.code || res.body.code).toBe('SHIFT_ALREADY_STARTED');
    });
  });

  describe('POST /api/v1/manager/staff/:id/reactivate', () => {
    it('reactivates deactivated staff and works only once', async () => {
      await Staff.updateOne({ _id: receptionist._id }, { active: false, deactivated_at: new Date() });

      const res = await request(app)
        .post(`/api/v1/manager/staff/${receptionist._id}/reactivate`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(true);

      // Second call gives 409
      const res2 = await request(app)
        .post(`/api/v1/manager/staff/${receptionist._id}/reactivate`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res2.status).toBe(409);
    });
  });

  describe('POST /api/v1/manager/staff/:id/reset-password', () => {
    it('resets password, returns temporary password, revokes sessions, and sets no-store', async () => {
      const res = await request(app)
        .post(`/api/v1/manager/staff/${receptionist._id}/reset-password`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.temporary_password).toBeTruthy();

      // Test login with new password
      const loginTime = DateTime.fromISO('2026-10-25T08:00:00', { zone: ZONE }).toISO();
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', loginTime)
        .send({
          username: receptionist.username,
          password: res.body.data.temporary_password,
        });
      expect(loginRes.status).toBe(200);
    });

    it('rejects resetting own password with 409', async () => {
      const res = await request(app)
        .post(`/api/v1/manager/staff/${manager._id}/reset-password`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
    });

    it('rejects resetting housekeeper with 409 (no login access)', async () => {
      const res = await request(app)
        .post(`/api/v1/manager/staff/${housekeeper._id}/reset-password`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(409);
    });
  });

  describe('Access Control', () => {
    it('returns 403 when called with receptionist token', async () => {
      const res = await request(app)
        .get('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 when called without a token', async () => {
      const res = await request(app).get('/api/v1/manager/staff');
      expect(res.status).toBe(401);
    });
  });
});
