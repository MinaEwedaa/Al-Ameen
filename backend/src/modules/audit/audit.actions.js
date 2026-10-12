// أسماء الأحداث المسموحة. استخدميها دايمًا: audit({ action: AUDIT.CHECK_IN, ... })
const AUDIT = Object.freeze({
  // الدخول والجلسات
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOCKOUT: 'LOCKOUT',
  REFRESH_REUSE: 'REFRESH_REUSE',
  // الوردية
  SHIFT_OPENED: 'SHIFT_OPENED',
  SHIFT_HANDED_OVER: 'SHIFT_HANDED_OVER',
  // الغرف
  ROOM_STATUS_CHANGED: 'ROOM_STATUS_CHANGED',
  // الضيوف
  GUEST_CREATED: 'GUEST_CREATED',
  // الحجوزات
  RESERVATION_CREATED: 'RESERVATION_CREATED',
  RESERVATION_UPDATED: 'RESERVATION_UPDATED',
  RESERVATION_CANCELLED: 'RESERVATION_CANCELLED',
  CHECK_IN: 'CHECK_IN',
  EXTEND: 'EXTEND',
  CHECK_OUT: 'CHECK_OUT',
  // الدفع
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  // التنظيف والصيانة
  CLEANING_CREATED: 'CLEANING_CREATED',
  CLEANING_UPDATED: 'CLEANING_UPDATED',
  MAINTENANCE_CREATED: 'MAINTENANCE_CREATED',
  MAINTENANCE_UPDATED: 'MAINTENANCE_UPDATED',
});

const ACTIONS = new Set(Object.values(AUDIT));

// أوامر السكريبت الإداري كلها بتبدأ بـ ADMIN_ (مثلًا ADMIN_CREATE_STAFF)
const ADMIN_PATTERN = /^ADMIN_[A-Z][A-Z_]*$/;

const isValidAction = (a) => typeof a === 'string' && (ACTIONS.has(a) || ADMIN_PATTERN.test(a));

module.exports = { AUDIT, ACTIONS, isValidAction };