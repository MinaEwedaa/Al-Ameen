const { Staff, Notification } = require('../../db/models');

const PREF_BY_TYPE = {
  APPROVAL_REQUEST: 'approval_request',
  LEAVE_REQUEST: 'leave_request',
  CRITICAL_MAINTENANCE: 'critical_maintenance',
  CRITICAL_COMPLAINT: 'critical_complaint',
  SHIFT_REPORT_SUBMITTED: 'shift_report_submitted',
  SYSTEM: 'system',
};

async function notifyManagers({ type, title, message, refType, refId }, { session } = {}) {
  const managers = await Staff.find({ role: { $in: ['manager', 'admin'] }, active: true })
    .select('notification_prefs')
    .session(session || null)
    .lean();

  const key = PREF_BY_TYPE[type];
  const docs = managers
    .filter((m) => !key || m.notification_prefs?.[key] !== false)
    .map((m) => ({
      recipient_staff_id: m._id,
      type,
      title,
      message,
      ref_type: refType,
      ref_id: refId,
    }));

  if (docs.length) {
    await Notification.insertMany(docs, { session });
  }
}

async function notifyStaff(staffId, { type, title, message, refType, refId }, { session } = {}) {
  await Notification.create(
    [
      {
        recipient_staff_id: staffId,
        type,
        title,
        message,
        ref_type: refType,
        ref_id: refId,
      },
    ],
    { session }
  );
}

module.exports = {
  notifyManagers,
  notifyStaff,
  PREF_BY_TYPE,
};
