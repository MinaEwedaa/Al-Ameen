const request = require('supertest');
const argon2 = require('argon2');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const app = require('../src/app');
const {
  Staff,
  Shift,
  Attendance,
  Room,
  RoomNight,
  Reservation,
  Payment,
  Guest,
  CleaningTask,
  MaintenanceIssue,
  RoomStatusHistory,
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 10: Cleaning Tasks and Maintenance Issues', () => {
  const password = 'Password123';
  const today = '2026-10-15';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();
  const CairoBeforeShift = DateTime.fromISO(`${today}T06:40:00`, { zone: ZONE }).toISO(); // 20 mins before 07:00 morning shift -> read-only

  const uid = () => crypto.randomUUID();

  let token;
  let staff;
  let shift;

  let eveningToken;
  let eveningStaff;
  let eveningShift;

  const auth = (t = token) => ({
    Authorization: `Bearer ${t}`,
  });

  const createRoom = (overrides = {}) =>
    Room.create({
      room_number: '201',
      room_type: 'deluxe',
      floor: 2,
      price_per_night: toPiastres(1500),
      half_day_price: toPiastres(500),
      status: 'available',
      ...overrides,
    });

  const createGuest = async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(auth())
      .set('x-test-time', Cairo13)
      .send({
        name: 'أحمد محمود',
        phone: '01011112222',
        id_number: '29901011234567',
      });
    expect(res.status).toBe(201);
    return res.body.guest_id;
  };

  const createBooking = async (guest_id, room_id) => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        guest_id,
        room_id,
        check_in: '2026-10-15T14:00:00.000Z',
        check_out: '2026-10-17T11:00:00.000Z',
      });
    expect(res.status).toBe(201);
    return res.body;
  };

  const recordPayment = async (reservation_id, amount) => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set(auth())
      .set('Idempotency-Key', uid())
      .set('x-test-time', Cairo13)
      .send({
        reservation_id,
        amount,
        payment_method: 'cash',
      });
    expect(res.status).toBe(201);
    return res.body;
  };

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Shift.deleteMany({}),
      Attendance.deleteMany({}),
      Room.deleteMany({}),
      RoomNight.deleteMany({}),
      Reservation.deleteMany({}),
      Payment.collection.deleteMany({}),
      Guest.deleteMany({}),
      CleaningTask.deleteMany({}),
      MaintenanceIssue.deleteMany({}),
      RoomStatusHistory.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);

    const passwordHash = await argon2.hash(password);
    staff = await Staff.create({
      username: 'reception_f10',
      name: 'Morning Receptionist',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    eveningStaff = await Staff.create({
      username: 'evening_f10',
      name: 'Evening Receptionist',
      password_hash: passwordHash,
      default_shift_type: 'evening',
      role: 'receptionist',
      active: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({ username: 'reception_f10', password });

    expect(loginRes.status).toBe(200);
    token = loginRes.body.access_token;
    shift = loginRes.body.shift;
  });

  describe('Cleaning Tasks (modules/cleaning)', () => {
    test('create cleaning task in Arabic, sets pending status, sets assigned_by_staff_id if cleaner_name provided, writes audit', async () => {
      const room = await createRoom({ room_number: '101' });

      const res = await request(app)
        .post('/api/v1/cleaning-tasks')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          room_id: String(room._id),
          priority: 'high',
          cleaner_name: 'منيرة أحمد',
          notes: 'تنظيف شامل وتعقيم الحمام',
        });

      expect(res.status).toBe(201);
      expect(res.body.task_id).toBeDefined();
      expect(res.body.room_id).toBe(String(room._id));
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('pending');
      expect(res.body.cleaner_name).toBe('منيرة أحمد');
      expect(res.body.notes).toBe('تنظيف شامل وتعقيم الحمام');
      expect(res.body.assigned_by_staff_id).toBe(String(staff._id));
      expect(res.body.shift_id).toBe(String(shift.shift_id));
      expect(res.body.finished_date).toBeNull();
      expect(res.body.assigned_date).toBeDefined();

      // Verify audit log
      const log = await AuditLog.findOne({ action: 'CLEANING_CREATED', entity_id: res.body.task_id });
      expect(log).toBeDefined();
      expect(log.actor_staff_id).toEqual(staff._id);
    });

    test('check-out generated cleaning task appears in list without cleaner_name and assigned_by_staff_id is null', async () => {
      const guestId = await createGuest();
      const room = await createRoom({ room_number: '102' });
      const booking = await createBooking(guestId, String(room._id));
      await recordPayment(booking.reservation_id, 3000);

      // Check-in
      await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-in`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13)
        .send({});

      // Check-out
      await request(app)
        .post(`/api/v1/reservations/${booking.reservation_id}/check-out`)
        .set(auth())
        .set('Idempotency-Key', uid())
        .set('x-test-time', Cairo13);

      // List cleaning tasks
      const res = await request(app)
        .get('/api/v1/cleaning-tasks')
        .set(auth())
        .set('x-test-time', Cairo13)
        .query({ room_id: String(room._id) });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      const checkoutTask = res.body.data[0];
      expect(checkoutTask.status).toBe('pending');
      expect(checkoutTask.cleaner_name).toBeNull();
      expect(checkoutTask.assigned_by_staff_id).toBeNull();
    });

    test('assigning cleaner_name updates assigned_by_staff_id and strips hidden directional characters', async () => {
      const room = await createRoom({ room_number: '103' });
      const task = await CleaningTask.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        priority: 'medium',
        status: 'pending',
        cleaner_name: null,
        assigned_by_staff_id: null,
      });

      // Name with hidden RLO (\u202E) character
      const dirtyName = '\u202Eسارة علي\u202C';
      const patchRes = await request(app)
        .patch(`/api/v1/cleaning-tasks/${task._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          cleaner_name: dirtyName,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.cleaner_name).toBe('سارة علي');
      expect(patchRes.body.assigned_by_staff_id).toBe(String(staff._id));

      // Verify audit log
      const log = await AuditLog.findOne({ action: 'CLEANING_UPDATED', entity_id: task._id });
      expect(log).toBeDefined();
      expect(log.details.cleaner_name).toBe('سارة علي');
    });

    test('setting status: done fills finished_date, and subsequent update attempts return 409 CONFLICT', async () => {
      const room = await createRoom({ room_number: '104' });
      const task = await CleaningTask.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        priority: 'medium',
        status: 'pending',
        cleaner_name: 'علي',
      });

      const doneRes = await request(app)
        .patch(`/api/v1/cleaning-tasks/${task._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          status: 'done',
        });

      expect(doneRes.status).toBe(200);
      expect(doneRes.body.status).toBe('done');
      expect(doneRes.body.finished_date).toBeDefined();
      expect(doneRes.body.finished_date).not.toBeNull();

      // Subsequent update should fail with 409
      const retryRes = await request(app)
        .patch(`/api/v1/cleaning-tasks/${task._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          notes: 'محاولة تعديل مهمة منتهية',
        });

      expect(retryRes.status).toBe(409);
      expect(retryRes.body.error.code).toBe('CONFLICT');
      expect(retryRes.body.error.message).toContain('already done');
    });

    test('completing cleaning task does NOT change room status', async () => {
      const room = await createRoom({ room_number: '105', status: 'cleaning' });
      const task = await CleaningTask.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        priority: 'medium',
        status: 'pending',
        cleaner_name: 'محمود',
      });

      const res = await request(app)
        .patch(`/api/v1/cleaning-tasks/${task._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({ status: 'done' });

      expect(res.status).toBe(200);

      // Verify room remains in cleaning status
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('cleaning');
    });

    test('empty PATCH body returns 400 VALIDATION_ERROR', async () => {
      const room = await createRoom({ room_number: '106' });
      const task = await CleaningTask.create({
        room_id: room._id,
        priority: 'medium',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/cleaning-tasks/${task._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('non-existent room returns 404, invalid priority returns 400', async () => {
      const fakeRoomId = new mongoose.Types.ObjectId().toString();

      const res404 = await request(app)
        .post('/api/v1/cleaning-tasks')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          room_id: fakeRoomId,
          priority: 'medium',
        });
      expect(res404.status).toBe(404);

      const room = await createRoom({ room_number: '107' });
      const res400 = await request(app)
        .post('/api/v1/cleaning-tasks')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          room_id: String(room._id),
          priority: 'ultra_urgent', // Not in enum
        });
      expect(res400.status).toBe(400);
    });

    test('tasks from previous shifts appear in list and can be updated by a different shift staff member', async () => {
      const room = await createRoom({ room_number: '108' });

      // Created in morning shift
      const task = await CleaningTask.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        assigned_by_staff_id: staff._id,
        priority: 'low',
        status: 'pending',
        notes: 'وردية الصباح',
      });

      // Login as evening shift at 18:00
      const Cairo18 = DateTime.fromISO(`${today}T18:00:00`, { zone: ZONE }).toISO();
      const eveLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', Cairo18)
        .send({ username: 'evening_f10', password });

      expect(eveLogin.status).toBe(200);
      eveningToken = eveLogin.body.access_token;
      eveningShift = eveLogin.body.shift;

      // Evening shift lists cleaning tasks
      const listRes = await request(app)
        .get('/api/v1/cleaning-tasks')
        .set(auth(eveningToken))
        .set('x-test-time', Cairo18);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((t) => t.task_id === String(task._id))).toBe(true);

      // Evening shift assigns cleaner
      const patchRes = await request(app)
        .patch(`/api/v1/cleaning-tasks/${task._id}`)
        .set(auth(eveningToken))
        .set('x-test-time', Cairo18)
        .send({
          cleaner_name: 'طارق',
          priority: 'high',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.cleaner_name).toBe('طارق');
      expect(patchRes.body.assigned_by_staff_id).toBe(String(eveningStaff._id));

      // Audit log records current evening shift
      const updateAudit = await AuditLog.findOne({
        action: 'CLEANING_UPDATED',
        actor_staff_id: eveningStaff._id,
      });
      expect(updateAudit).toBeDefined();
      expect(updateAudit.details.shift_id).toBe(String(eveningShift.shift_id));
    });
  });

  describe('Maintenance Issues (modules/maintenance)', () => {
    test('report maintenance issue, sets open status, records audit, does not change room status', async () => {
      const room = await createRoom({ room_number: '202', status: 'available' });

      const res = await request(app)
        .post('/api/v1/maintenance-issues')
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          room_id: String(room._id),
          problem: 'تسريب مياه في الحمام الرئيسي',
          priority: 'urgent',
          notes: 'يحتاج سباك فوراً',
        });

      expect(res.status).toBe(201);
      expect(res.body.issue_id).toBeDefined();
      expect(res.body.room_id).toBe(String(room._id));
      expect(res.body.problem).toBe('تسريب مياه في الحمام الرئيسي');
      expect(res.body.priority).toBe('urgent');
      expect(res.body.status).toBe('open');
      expect(res.body.created_date).toBeDefined();
      expect(res.body.resolved_date).toBeNull();
      expect(res.body.staff_id).toBe(String(staff._id));
      expect(res.body.shift_id).toBe(String(shift.shift_id));

      // Verify room remains available (reporting issue does not automatically change room status)
      const roomDoc = await Room.findById(room._id);
      expect(roomDoc.status).toBe('available');

      // Verify audit log
      const log = await AuditLog.findOne({
        action: 'MAINTENANCE_CREATED',
        entity_id: res.body.issue_id,
      });
      expect(log).toBeDefined();
      expect(log.actor_staff_id).toEqual(staff._id);
    });

    test('state transitions: open -> in_progress -> resolved with resolved_date', async () => {
      const room = await createRoom({ room_number: '203' });
      const issue = await MaintenanceIssue.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        staff_id: staff._id,
        problem: 'عطل في التكييف',
        priority: 'high',
        status: 'open',
      });

      // 1. Transition to in_progress
      const inProgRes = await request(app)
        .patch(`/api/v1/maintenance-issues/${issue._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          status: 'in_progress',
          notes: 'الفني بدأ في الفحص',
        });

      expect(inProgRes.status).toBe(200);
      expect(inProgRes.body.status).toBe('in_progress');
      expect(inProgRes.body.resolved_date).toBeNull();

      // 2. Transition to resolved
      const resolvedRes = await request(app)
        .patch(`/api/v1/maintenance-issues/${issue._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          status: 'resolved',
          notes: 'تم تصليح المكيف وتغيير الفلتر',
        });

      expect(resolvedRes.status).toBe(200);
      expect(resolvedRes.body.status).toBe('resolved');
      expect(resolvedRes.body.resolved_date).toBeDefined();
      expect(resolvedRes.body.resolved_date).not.toBeNull();

      // 3. Modifying a resolved issue or trying to reopen returns 409
      const reopenRes = await request(app)
        .patch(`/api/v1/maintenance-issues/${issue._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          notes: 'محاولة تعديل بعد الحل',
        });

      expect(reopenRes.status).toBe(409);
      expect(reopenRes.body.error.code).toBe('CONFLICT');
      expect(reopenRes.body.error.message).toContain('already resolved');
    });

    test('transition to in_progress from anything other than open is rejected with 409', async () => {
      const room = await createRoom({ room_number: '204' });
      const issue = await MaintenanceIssue.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        staff_id: staff._id,
        problem: 'عطل كهرباء',
        status: 'in_progress',
      });

      const res = await request(app)
        .patch(`/api/v1/maintenance-issues/${issue._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          status: 'in_progress',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    test('updating priority and notes on an open issue succeeds without changing status', async () => {
      const room = await createRoom({ room_number: '205' });
      const issue = await MaintenanceIssue.create({
        room_id: room._id,
        shift_id: shift.shift_id,
        staff_id: staff._id,
        problem: 'باب الحمام لا يغلق',
        priority: 'low',
        status: 'open',
      });

      const res = await request(app)
        .patch(`/api/v1/maintenance-issues/${issue._id}`)
        .set(auth())
        .set('x-test-time', Cairo13)
        .send({
          priority: 'urgent',
          notes: 'النزيل اشتكى مجدداً',
        });

      expect(res.status).toBe(200);
      expect(res.body.priority).toBe('urgent');
      expect(res.body.notes).toBe('النزيل اشتكى مجدداً');
      expect(res.body.status).toBe('open');
    });

    test('listing maintenance issues with filters and pagination', async () => {
      const room1 = await createRoom({ room_number: '206' });
      const room2 = await createRoom({ room_number: '207' });

      await MaintenanceIssue.create([
        {
          room_id: room1._id,
          shift_id: shift.shift_id,
          staff_id: staff._id,
          problem: 'Issue 1',
          priority: 'low',
          status: 'open',
        },
        {
          room_id: room1._id,
          shift_id: shift.shift_id,
          staff_id: staff._id,
          problem: 'Issue 2',
          priority: 'urgent',
          status: 'resolved',
          resolved_at: new Date(),
        },
        {
          room_id: room2._id,
          shift_id: shift.shift_id,
          staff_id: staff._id,
          problem: 'Issue 3',
          priority: 'urgent',
          status: 'open',
        },
      ]);

      const res = await request(app)
        .get('/api/v1/maintenance-issues')
        .set(auth())
        .set('x-test-time', Cairo13)
        .query({ status: 'open', priority: 'urgent' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].problem).toBe('Issue 3');
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe('Read-Only Session Restrictions (403 FORBIDDEN)', () => {
    test('writes to cleaning tasks and maintenance issues are blocked with 403 when session is read-only', async () => {
      const passwordHash = await argon2.hash(password);
      await Staff.create({
        username: 'ro_staff_f10',
        name: 'ReadOnly Staff',
        password_hash: passwordHash,
        default_shift_type: 'morning',
        role: 'receptionist',
        active: true,
      });

      // Login 20 minutes before shift starts (06:40) -> read_only: true
      const roLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', CairoBeforeShift)
        .send({ username: 'ro_staff_f10', password });

      expect(roLogin.status).toBe(200);
      expect(roLogin.body.read_only).toBe(true);
      const roToken = roLogin.body.access_token;

      const room = await createRoom({ room_number: '301' });

      // POST cleaning-task
      const cleanPost = await request(app)
        .post('/api/v1/cleaning-tasks')
        .set(auth(roToken))
        .set('x-test-time', CairoBeforeShift)
        .send({
          room_id: String(room._id),
          priority: 'medium',
        });
      expect(cleanPost.status).toBe(403);
      expect(cleanPost.body.error.code).toBe('FORBIDDEN');

      // POST maintenance-issue
      const maintPost = await request(app)
        .post('/api/v1/maintenance-issues')
        .set(auth(roToken))
        .set('x-test-time', CairoBeforeShift)
        .send({
          room_id: String(room._id),
          problem: 'Test problem',
          priority: 'medium',
        });
      expect(maintPost.status).toBe(403);
      expect(maintPost.body.error.code).toBe('FORBIDDEN');
    });
  });
});
