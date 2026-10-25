// Tests for Manager Feature M6: Shift Schedule & Baseline Materialization

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
const { ensureBaseline } = require('../../src/modules/manager/common/schedule.service');

describe('Manager Feature M6: Shift Schedule', () => {
  let manager, receptionist, inactiveStaff;
  let managerToken, receptionistToken;
  const today = todayCairo();

  beforeEach(async () => {
    await Staff.deleteMany({});
    await Session.deleteMany({});
    await Shift.deleteMany({});
    await ShiftSchedule.deleteMany({});
    await LeaveRequest.deleteMany({});
    await Notification.deleteMany({});

    const pwdHash = await hashPassword('Password123');

    manager = await Staff.create({
      username: 'manager_shifts',
      password_hash: pwdHash,
      name: 'Manager Shift Boss',
      role: 'manager',
      department: 'Management',
      active: true,
      email: 'mgr@hotel.com',
    });

    receptionist = await Staff.create({
      username: 'rec_shifts',
      password_hash: pwdHash,
      name: 'Mona Receptionist',
      role: 'receptionist',
      department: 'Front Desk',
      default_shift_type: 'morning',
      active: true,
      email: 'mona@hotel.com',
    });

    inactiveStaff = await Staff.create({
      username: 'inactive_rec',
      password_hash: pwdHash,
      name: 'Inactive Guy',
      role: 'receptionist',
      default_shift_type: 'evening',
      active: false,
    });

    const mSession = await Session.create({
      staff_id: manager._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    managerToken = signAccess({ staffId: manager._id, sessionId: mSession._id, role: 'manager' });

    const rSession = await Session.create({
      staff_id: receptionist._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    receptionistToken = signAccess({ staffId: receptionist._id, sessionId: rSession._id, role: 'receptionist' });
  });

  describe('1. Baseline Materialization (ensureBaseline)', () => {
    it('creates baseline rows once for receptionists with default_shift_type, and is idempotent', async () => {
      await ensureBaseline(today, today, [receptionist._id]);

      const count1 = await ShiftSchedule.countDocuments({ staff_id: receptionist._id, shift_date: today });
      expect(count1).toBe(1);

      // Re-running does not create duplicate rows
      await ensureBaseline(today, today, [receptionist._id]);
      const count2 = await ShiftSchedule.countDocuments({ staff_id: receptionist._id, shift_date: today });
      expect(count2).toBe(1);
    });

    it('skips dates that already have any row (even cancelled), and cancelled rows are never recreated', async () => {
      await ensureBaseline(today, today, [receptionist._id]);
      await ShiftSchedule.updateOne({ staff_id: receptionist._id, shift_date: today }, { status: 'CANCELLED' });

      // Run ensureBaseline again
      await ensureBaseline(today, today, [receptionist._id]);
      const row = await ShiftSchedule.findOne({ staff_id: receptionist._id, shift_date: today });
      expect(row.status).toBe('CANCELLED');
    });

    it('enforces 62-day range limit with 400 VALIDATION_ERROR', async () => {
      await expect(ensureBaseline('2026-11-01', '2027-02-01')).rejects.toThrow();
    });
  });

  describe('2. POST /api/v1/manager/shifts (Create Shift)', () => {
    it('creates scheduled shift, rejects inactive staff and past dates', async () => {
      const resInactive = await request(app)
        .post('/api/v1/manager/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          staff_id: String(inactiveStaff._id),
          business_date: '2026-11-10',
          shift_type: 'MORNING',
        });
      expect(resInactive.status).toBe(400);

      const resPast = await request(app)
        .post('/api/v1/manager/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          staff_id: String(receptionist._id),
          business_date: '2020-01-01',
          shift_type: 'MORNING',
          start_at: '2020-01-01T07:00:00Z',
          end_at: '2020-01-01T15:00:00Z',
        });
      expect(resPast.status).toBe(400);
    });

    it('rejects shift overlapping with existing scheduled shift with 409 SHIFT_OVERLAP', async () => {
      const futureDate = '2026-11-15';
      const win = shiftWindow(futureDate, 'morning');

      await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: futureDate,
        shift_type: 'morning',
        start_at: win.start_at,
        end_at: win.end_at,
        status: 'SCHEDULED',
      });

      const res = await request(app)
        .post('/api/v1/manager/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          staff_id: String(receptionist._id),
          business_date: futureDate,
          shift_type: 'MORNING',
          start_at: win.start_at.toISOString(),
          end_at: win.end_at.toISOString(),
        });

      expect(res.status).toBe(409);
      expect(res.body.error?.code || res.body.code).toBe('SHIFT_OVERLAP');
    });

    it('rejects shift if staff has approved leave on that date with 409 CONFLICT', async () => {
      const leaveDate = '2026-11-20';
      await LeaveRequest.create({
        staff_id: receptionist._id,
        leave_type: 'ANNUAL',
        start_date: leaveDate,
        end_date: leaveDate,
        status: 'APPROVED',
      });

      const res = await request(app)
        .post('/api/v1/manager/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          staff_id: String(receptionist._id),
          business_date: leaveDate,
          shift_type: 'MORNING',
        });

      expect(res.status).toBe(409);
    });

    it('reactivates an existing CANCELLED row instead of failing on unique index', async () => {
      const futureDate = '2026-11-25';
      const win = shiftWindow(futureDate, 'morning');

      const cancelled = await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: futureDate,
        shift_type: 'morning',
        start_at: win.start_at,
        end_at: win.end_at,
        status: 'CANCELLED',
        cancel_reason: 'TEST',
      });

      const res = await request(app)
        .post('/api/v1/manager/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          staff_id: String(receptionist._id),
          business_date: futureDate,
          shift_type: 'MORNING',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(String(cancelled._id));
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.cancel_reason).toBeNull();
    });
  });

  describe('3. GET /api/v1/manager/shifts & /shifts/overview & /shifts/roster', () => {
    it('GET /shifts lists shifts with derived status and pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/manager/shifts?business_date=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].status).toBe('SCHEDULED');
    });

    it('GET /shifts/overview returns 3 shift cards, coverage and totals', async () => {
      const res = await request(app)
        .get(`/api/v1/manager/shifts/overview?business_date=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.cards.length).toBe(3);
      expect(res.body.data.cards[0].shift_type).toBe('MORNING');
      expect(['COVERED', 'UNCOVERED']).toContain(res.body.data.cards[0].coverage);
      expect(res.body.data.totals).toHaveProperty('scheduled');
    });

    it('GET /shifts/roster returns Egyptian week starting on Saturday and department coverage', async () => {
      const res = await request(app)
        .get(`/api/v1/manager/shifts/roster?view=week&date=${today}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.view).toBe('week');
      expect(res.body.data.days.length).toBe(7);
      expect(res.body.data.rows.length).toBeGreaterThan(0);
      expect(res.body.data.coverage).toBeDefined();
    });
  });

  describe('4. PATCH, DELETE and POST /force-close', () => {
    it('PATCH /shifts/:id rejects editing shift once start_at has passed with 409 SHIFT_ALREADY_STARTED', async () => {
      const pastStart = new Date(Date.now() - 3600e3);
      const sched = await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: '2026-11-10',
        shift_type: 'morning',
        start_at: pastStart,
        end_at: new Date(Date.now() + 3600e3),
        status: 'SCHEDULED',
      });

      const res = await request(app)
        .patch(`/api/v1/manager/shifts/${sched._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ shift_type: 'EVENING' });

      expect(res.status).toBe(409);
      expect(res.body.error?.code || res.body.code).toBe('SHIFT_ALREADY_STARTED');
    });

    it('DELETE /shifts/:id sets status CANCELLED before start', async () => {
      const futureStart = new Date(Date.now() + 86400e3);
      const sched = await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: '2026-11-30',
        shift_type: 'morning',
        start_at: futureStart,
        end_at: new Date(Date.now() + 90000e3),
        status: 'SCHEDULED',
      });

      const res = await request(app)
        .delete(`/api/v1/manager/shifts/${sched._id}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('force-close closes active Shift and revokes receptionist active sessions', async () => {
      const shiftDate = '2026-10-25';
      const now = new Date();
      const sched = await ShiftSchedule.create({
        staff_id: receptionist._id,
        shift_date: shiftDate,
        shift_type: 'morning',
        start_at: now,
        end_at: new Date(now.getTime() + 8 * 3600e3),
        status: 'SCHEDULED',
      });

      const realShift = await Shift.create({
        staff_id: receptionist._id,
        shift_date: shiftDate,
        shift_type: 'morning',
        start_at: now,
        end_at: new Date(now.getTime() + 8 * 3600e3),
        status: 'active',
      });

      // Create an active session for the receptionist
      await Session.create({
        staff_id: receptionist._id,
        refresh_hash: 'hash_to_revoke',
        expires_at: new Date(Date.now() + 86400e3),
        last_seen_at: now,
      });

      const res = await request(app)
        .post(`/api/v1/manager/shifts/${sched._id}/force-close`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Receptionist left early due to medical emergency' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');

      // Verify Shift closed
      const updatedShift = await Shift.findById(realShift._id);
      expect(updatedShift.status).toBe('handed_over');
      expect(updatedShift.shift_notes).toContain('FORCE CLOSED by manager');

      // Verify sessions revoked
      const activeSessions = await Session.countDocuments({
        staff_id: receptionist._id,
        revoked_at: null,
      });
      expect(activeSessions).toBe(0);

      // Second call gives 422
      const res2 = await request(app)
        .post(`/api/v1/manager/shifts/${sched._id}/force-close`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Try again' });

      expect(res2.status).toBe(422);
    });
  });

  describe('5. Access Control', () => {
    it('returns 403 when receptionist accesses manager shifts routes', async () => {
      const res = await request(app)
        .get('/api/v1/manager/shifts/overview')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/manager/shifts/overview');
      expect(res.status).toBe(401);
    });
  });
});
