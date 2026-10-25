// Manager Activities Service
// Fetches hotel-wide activity stream from AuditLog

const { AuditLog } = require('../../../db/models');

const ACTION_MAP = {
  CHECK_IN: { title: 'تسجيل وصول نزيل', category: 'guest' },
  CHECK_OUT: { title: 'تسجيل مغادرة نزيل', category: 'guest' },
  RESERVATION_CREATED: { title: 'إنشاء حجز جديد', category: 'guest' },
  RESERVATION_UPDATED: { title: 'تعديل حجز', category: 'guest' },
  RESERVATION_CANCELLED: { title: 'إلغاء حجز', category: 'guest' },
  GUEST_CREATED: { title: 'تسجيل بيانات نزيل', category: 'guest' },
  PAYMENT_CREATED: { title: 'استلام دفعة مالية', category: 'payment' },
  SHIFT_OPENED: { title: 'فتح وردية جديدة', category: 'shift' },
  SHIFT_HANDED_OVER: { title: 'تسليم وردية', category: 'shift' },
  ROOM_STATUS_CHANGED: { title: 'تحديث حالة غرفة', category: 'room' },
  CLEANING_CREATED: { title: 'تعيين مهمة تنظيف', category: 'room' },
  CLEANING_UPDATED: { title: 'تحديث حالة تنظيف', category: 'room' },
  MAINTENANCE_CREATED: { title: 'بلاغ صيانة غرفة', category: 'room' },
  MAINTENANCE_UPDATED: { title: 'تحديث طلب صيانة', category: 'room' },
  STAFF_CREATED: { title: 'إضافة موظف جديد', category: 'shift' },
  STAFF_UPDATED: { title: 'تعديل بيانات موظف', category: 'shift' },
  SHIFT_SCHEDULED: { title: 'جدولة وردية لموظف', category: 'shift' },
};

function formatActivityDescription(log) {
  const d = log.details || {};
  switch (log.action) {
    case 'CHECK_IN':
      return `تسجيل وصول للغرفة ${d.room_number || ''} ${d.guest_name ? `(النزيل: ${d.guest_name})` : ''}`.trim();
    case 'CHECK_OUT':
      return `مغادرة النزيل وتسوية الحساب للغرفة ${d.room_number || ''}`.trim();
    case 'RESERVATION_CREATED':
      return `حجز جديد للغرفة ${d.room_number || ''} ${d.nights ? `(${d.nights} ليالي)` : ''}`.trim();
    case 'PAYMENT_CREATED':
      return `تحصيل دفعة مالية بقيمة ${d.amount_egp ? `${d.amount_egp} ج.م` : ''} بطريقة ${d.payment_method || 'الدفع المعتمدة'}`.trim();
    case 'ROOM_STATUS_CHANGED':
      return `تغيير حالة الغرفة ${d.room_number || ''} إلى ${d.status || d.new_status || 'حالة جديدة'}`.trim();
    case 'CLEANING_CREATED':
    case 'CLEANING_UPDATED':
      return `مهمة تنظيف للغرفة ${d.room_number || ''} ${d.priority ? `(أولوية ${d.priority})` : ''}`.trim();
    case 'MAINTENANCE_CREATED':
    case 'MAINTENANCE_UPDATED':
      return `طلب صيانة للغرفة ${d.room_number || ''}: ${d.problem || 'صيانة عاجلة'}`.trim();
    case 'SHIFT_OPENED':
      return `بدء الوردية ${d.shift_type || ''}`.trim();
    case 'SHIFT_HANDED_OVER':
      return `إغلاق وتسليم الوردية ${d.shift_type || ''}`.trim();
    default:
      return d.notes || d.message || 'نشاط فندقي معتمد في النظام';
  }
}

async function getActivities(limit = 4) {
  const l = Math.min(50, Math.max(1, Number(limit) || 4));

  const logs = await AuditLog.find()
    .populate('actor_staff_id', 'name')
    .sort({ at: -1 })
    .limit(l)
    .lean();

  return logs.map((log) => {
    const meta = ACTION_MAP[log.action] || { title: log.action, category: 'shift' };
    return {
      id: String(log._id),
      title: meta.title,
      description: formatActivityDescription(log),
      timestamp: (log.at || new Date()).toISOString(),
      category: meta.category,
      actor_name: log.actor_staff_id?.name || 'موظف الفندق',
    };
  });
}

module.exports = {
  getActivities,
};
