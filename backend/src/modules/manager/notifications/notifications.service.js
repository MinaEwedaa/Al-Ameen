const { Notification, Staff } = require('../../../db/models');
const { paginateM } = require('../../../utils/paginateM');
const { E } = require('../../../utils/errors');

const PREF_KEYS = [
  'approval_request',
  'leave_request',
  'critical_maintenance',
  'critical_complaint',
  'shift_report_submitted',
  'system',
];

function toNotificationDto(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    ref_type: doc.ref_type || null,
    ref_id: doc.ref_id ? String(doc.ref_id) : null,
    is_read: Boolean(doc.is_read),
    created_at: (doc.createdAt || new Date()).toISOString(),
    read_at: doc.read_at ? doc.read_at.toISOString() : null,
  };
}

function formatPreferences(prefs = {}) {
  return {
    approval_request: prefs.approval_request !== false,
    leave_request: prefs.leave_request !== false,
    critical_maintenance: prefs.critical_maintenance !== false,
    critical_complaint: prefs.critical_complaint !== false,
    shift_report_submitted: prefs.shift_report_submitted !== false,
    system: prefs.system !== false,
  };
}

async function listNotifications({ staffId, isRead, page = 1, limit = 20 }) {
  const filter = { recipient_staff_id: staffId };
  if (isRead !== undefined && isRead !== null && isRead !== '') {
    filter.is_read = isRead === true || isRead === 'true';
  }

  const result = await paginateM(
    Notification,
    filter,
    { page, limit, sort: { createdAt: -1 } },
    toNotificationDto
  );

  const unreadCount = await Notification.countDocuments({
    recipient_staff_id: staffId,
    is_read: false,
  });

  result.meta.unread_count = unreadCount;
  return result;
}

async function markAsRead({ staffId, notificationId }) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient_staff_id: staffId },
    { $set: { is_read: true, read_at: new Date() } },
    { returnDocument: 'after' }
  );

  if (!notification) {
    throw E.notFound('Notification not found');
  }

  return toNotificationDto(notification);
}

async function markAllAsRead({ staffId }) {
  const result = await Notification.updateMany(
    { recipient_staff_id: staffId, is_read: false },
    { $set: { is_read: true, read_at: new Date() } }
  );

  return { updated: result.modifiedCount };
}

async function getPreferences({ staffId }) {
  const staff = await Staff.findById(staffId).select('notification_prefs').lean();
  if (!staff) {
    throw E.notFound('Staff not found');
  }

  return formatPreferences(staff.notification_prefs);
}

async function updatePreferences({ staffId, body }) {
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    throw E.badRequest('At least one preference must be provided');
  }

  const updateFields = {};
  for (const key of Object.keys(body)) {
    if (!PREF_KEYS.includes(key)) {
      continue;
    }
    if (typeof body[key] !== 'boolean') {
      throw E.badRequest(`Preference '${key}' must be a boolean`);
    }
    updateFields[`notification_prefs.${key}`] = body[key];
  }

  if (Object.keys(updateFields).length === 0) {
    throw E.badRequest('At least one valid preference key must be provided');
  }

  const staff = await Staff.findByIdAndUpdate(
    staffId,
    { $set: updateFields },
    { returnDocument: 'after' }
  ).lean();

  if (!staff) {
    throw E.notFound('Staff not found');
  }

  return formatPreferences(staff.notification_prefs);
}

module.exports = {
  toNotificationDto,
  formatPreferences,
  listNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
};
