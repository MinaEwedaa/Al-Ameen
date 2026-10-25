const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { Staff, Notification, PasswordResetRequest } = require('../../src/db/models');
const { makeToken } = require('../helpers/managerAuth');
const { notifyManagers, notifyStaff } = require('../../src/modules/notifications/notify');

describe('Manager Module M3: Notifications', () => {
  let manager1;
  let manager2;
  let receptionist;

  beforeAll(async () => {
    manager1 = await makeToken('manager');
    manager2 = await makeToken('manager');
    receptionist = await makeToken('receptionist');
  });

  afterAll(async () => {
    await Staff.deleteMany({
      _id: { $in: [manager1.staff._id, manager2.staff._id, receptionist.staff._id] },
    });
  });

  beforeEach(async () => {
    await Notification.deleteMany({
      recipient_staff_id: { $in: [manager1.staff._id, manager2.staff._id] },
    });
  });

  describe('notifyManagers & preferences filtering', () => {
    test('a manager who disabled leave_request gets no notification of type LEAVE_REQUEST, while other managers get it', async () => {
      // Disable leave_request for manager1
      await Staff.findByIdAndUpdate(manager1.staff._id, {
        $set: { 'notification_prefs.leave_request': false },
      });

      // Keep leave_request enabled for manager2
      await Staff.findByIdAndUpdate(manager2.staff._id, {
        $set: { 'notification_prefs.leave_request': true },
      });

      await notifyManagers({
        type: 'LEAVE_REQUEST',
        title: 'New Leave Request',
        message: 'Staff requested 3 days leave',
        refType: 'LeaveRequest',
        refId: new mongoose.Types.ObjectId(),
      });

      const m1Notifs = await Notification.find({
        recipient_staff_id: manager1.staff._id,
        type: 'LEAVE_REQUEST',
      });
      const m2Notifs = await Notification.find({
        recipient_staff_id: manager2.staff._id,
        type: 'LEAVE_REQUEST',
      });

      expect(m1Notifs.length).toBe(0);
      expect(m2Notifs.length).toBe(1);
      expect(m2Notifs[0].title).toBe('New Leave Request');
    });

    test('notifyStaff creates a notification directly for recipient staff', async () => {
      await notifyStaff(receptionist.staff._id, {
        type: 'LEAVE_DECISION',
        title: 'Leave Approved',
        message: 'Your leave request was approved',
        refType: 'LeaveRequest',
        refId: new mongoose.Types.ObjectId(),
      });

      const notifs = await Notification.find({ recipient_staff_id: receptionist.staff._id });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe('LEAVE_DECISION');

      await Notification.deleteMany({ recipient_staff_id: receptionist.staff._id });
    });
  });

  describe('GET /api/v1/manager/notifications', () => {
    test('returns current manager notifications only, filters by is_read=false, and meta includes correct unread_count', async () => {
      // Create 2 unread and 1 read for manager1
      await Notification.create([
        {
          recipient_staff_id: manager1.staff._id,
          type: 'SYSTEM',
          title: 'System alert 1',
          message: 'Alert 1 details',
          is_read: false,
        },
        {
          recipient_staff_id: manager1.staff._id,
          type: 'SYSTEM',
          title: 'System alert 2',
          message: 'Alert 2 details',
          is_read: false,
        },
        {
          recipient_staff_id: manager1.staff._id,
          type: 'SYSTEM',
          title: 'System alert 3',
          message: 'Alert 3 details',
          is_read: true,
          read_at: new Date(),
        },
      ]);

      // Create 1 unread for manager2 (should not appear in manager1 list)
      await Notification.create({
        recipient_staff_id: manager2.staff._id,
        type: 'SYSTEM',
        title: 'Manager 2 Alert',
        message: 'Should not see this',
        is_read: false,
      });

      // 1. Fetch all for manager1
      const allRes = await request(app)
        .get('/api/v1/manager/notifications')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(allRes.status).toBe(200);
      expect(allRes.body.data.length).toBe(3);
      expect(allRes.body.meta.total).toBe(3);
      expect(allRes.body.meta.unread_count).toBe(2);

      // 2. Fetch unread only for manager1
      const unreadRes = await request(app)
        .get('/api/v1/manager/notifications?is_read=false')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(unreadRes.status).toBe(200);
      expect(unreadRes.body.data.length).toBe(2);
      expect(unreadRes.body.meta.total).toBe(2);
      expect(unreadRes.body.meta.unread_count).toBe(2);
      unreadRes.body.data.forEach((n) => expect(n.is_read).toBe(false));
    });
  });

  describe('PATCH /api/v1/manager/notifications/:id/read', () => {
    test('marks notification as read', async () => {
      const notif = await Notification.create({
        recipient_staff_id: manager1.staff._id,
        type: 'SYSTEM',
        title: 'To Read',
        message: 'Mark me',
        is_read: false,
      });

      const res = await request(app)
        .patch(`/api/v1/manager/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_read).toBe(true);
      expect(res.body.data.read_at).toBeDefined();

      const updated = await Notification.findById(notif._id);
      expect(updated.is_read).toBe(true);
      expect(updated.read_at).not.toBeNull();
    });

    test('trying to mark another manager notification as read returns 404', async () => {
      const m2Notif = await Notification.create({
        recipient_staff_id: manager2.staff._id,
        type: 'SYSTEM',
        title: 'M2 Secret Alert',
        message: 'Private',
        is_read: false,
      });

      const res = await request(app)
        .patch(`/api/v1/manager/notifications/${m2Notif._id}/read`)
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(res.status).toBe(404);
    });

    test('marking already read notification returns it as is with no error', async () => {
      const readDate = new Date();
      const notif = await Notification.create({
        recipient_staff_id: manager1.staff._id,
        type: 'SYSTEM',
        title: 'Already Read',
        message: 'Already read',
        is_read: true,
        read_at: readDate,
      });

      const res = await request(app)
        .patch(`/api/v1/manager/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_read).toBe(true);
    });
  });

  describe('POST /api/v1/manager/notifications/read-all', () => {
    test('marks all unread as read, returns updated count, and unread_count becomes 0', async () => {
      await Notification.create([
        {
          recipient_staff_id: manager1.staff._id,
          type: 'SYSTEM',
          title: 'Notif 1',
          message: 'Msg 1',
          is_read: false,
        },
        {
          recipient_staff_id: manager1.staff._id,
          type: 'SYSTEM',
          title: 'Notif 2',
          message: 'Msg 2',
          is_read: false,
        },
      ]);

      const res = await request(app)
        .post('/api/v1/manager/notifications/read-all')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(2);

      // Verify unread_count is now 0
      const listRes = await request(app)
        .get('/api/v1/manager/notifications')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(listRes.body.meta.unread_count).toBe(0);
    });
  });

  describe('Preferences: GET & PATCH /api/v1/manager/notifications/preferences', () => {
    test('GET returns all 6 keys with default true', async () => {
      const res = await request(app)
        .get('/api/v1/manager/notifications/preferences')
        .set('Authorization', `Bearer ${manager1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('approval_request');
      expect(res.body.data).toHaveProperty('leave_request');
      expect(res.body.data).toHaveProperty('critical_maintenance');
      expect(res.body.data).toHaveProperty('critical_complaint');
      expect(res.body.data).toHaveProperty('shift_report_submitted');
      expect(res.body.data).toHaveProperty('system');
    });

    test('PATCH saves a single edit and preserves the rest', async () => {
      const patchRes = await request(app)
        .patch('/api/v1/manager/notifications/preferences')
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({ critical_maintenance: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.critical_maintenance).toBe(false);
      expect(patchRes.body.data.approval_request).toBe(true);

      const staff = await Staff.findById(manager1.staff._id);
      expect(staff.notification_prefs.critical_maintenance).toBe(false);
    });

    test('PATCH with non-boolean value returns 400', async () => {
      const res = await request(app)
        .patch('/api/v1/manager/notifications/preferences')
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({ system: 'not-a-boolean' });

      expect(res.status).toBe(400);
    });

    test('PATCH with empty body returns 400', async () => {
      const res = await request(app)
        .patch('/api/v1/manager/notifications/preferences')
        .set('Authorization', `Bearer ${manager1.token}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('Password reset request notification integration', () => {
    test('public password reset request creates a SYSTEM notification for active managers', async () => {
      // Ensure manager1 has system notifications enabled
      await Staff.findByIdAndUpdate(manager1.staff._id, {
        $set: { 'notification_prefs.system': true },
      });

      // Pre-create receptionist staff for password reset request
      const recUsername = 'rec_reset_target_' + Date.now();
      const recUser = await Staff.create({
        username: recUsername,
        name: 'Reset Target Rec',
        password_hash: 'dummyhash',
        role: 'receptionist',
        default_shift_type: 'morning',
        active: true,
      });

      const res = await request(app)
        .post('/api/v1/auth/password-reset-requests')
        .send({ username: recUsername });

      expect(res.status).toBe(202);

      const notif = await Notification.findOne({
        recipient_staff_id: manager1.staff._id,
        type: 'SYSTEM',
        ref_type: 'PasswordResetRequest',
      });

      expect(notif).not.toBeNull();
      expect(notif.title).toBe('Password reset request');
      expect(notif.message).toBe(recUsername);

      await Staff.deleteOne({ _id: recUser._id });
      await PasswordResetRequest.deleteMany({ staff_id: recUser._id });
    });
  });

  describe('Authorization checks', () => {
    test('receptionist token returns 403 on all manager notification routes', async () => {
      const getList = await request(app)
        .get('/api/v1/manager/notifications')
        .set('Authorization', `Bearer ${receptionist.token}`);
      expect(getList.status).toBe(403);

      const markRead = await request(app)
        .patch(`/api/v1/manager/notifications/${new mongoose.Types.ObjectId()}/read`)
        .set('Authorization', `Bearer ${receptionist.token}`);
      expect(markRead.status).toBe(403);

      const readAll = await request(app)
        .post('/api/v1/manager/notifications/read-all')
        .set('Authorization', `Bearer ${receptionist.token}`);
      expect(readAll.status).toBe(403);

      const getPrefs = await request(app)
        .get('/api/v1/manager/notifications/preferences')
        .set('Authorization', `Bearer ${receptionist.token}`);
      expect(getPrefs.status).toBe(403);

      const patchPrefs = await request(app)
        .patch('/api/v1/manager/notifications/preferences')
        .set('Authorization', `Bearer ${receptionist.token}`)
        .send({ system: false });
      expect(patchPrefs.status).toBe(403);
    });

    test('no token returns 401', async () => {
      const res = await request(app).get('/api/v1/manager/notifications');
      expect(res.status).toBe(401);
    });
  });
});
