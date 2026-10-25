// Shift mapper isolating database schema differences for Shift model
// Receptionist codebase uses status: 'active' | 'handed_over', with start_at / end_at.
// The guide assumed status: 'open' | 'closed', opened_at / closed_at.
// We support both to keep all operations completely robust.

const SHIFT_STATUS = {
  ACTIVE: 'active',
  OPEN: 'open',
  HANDED_OVER: 'handed_over',
  CLOSED: 'closed',
};

const OPEN_STATUSES = [SHIFT_STATUS.ACTIVE, SHIFT_STATUS.OPEN];
const CLOSED_STATUSES = [SHIFT_STATUS.HANDED_OVER, SHIFT_STATUS.CLOSED];

function isOpenShift(shift) {
  if (!shift) return false;
  return OPEN_STATUSES.includes(shift.status);
}

function openShiftQuery(staffId) {
  const query = { status: { $in: OPEN_STATUSES } };
  if (staffId) query.staff_id = staffId;
  return query;
}

function getShiftOpenedAt(shift) {
  return shift.opened_at || shift.start_at || shift.createdAt;
}

function getShiftClosedAt(shift) {
  return shift.closed_at || shift.handed_over_at || shift.end_at || shift.updatedAt;
}

module.exports = {
  SHIFT_STATUS,
  OPEN_STATUSES,
  CLOSED_STATUSES,
  isOpenShift,
  openShiftQuery,
  getShiftOpenedAt,
  getShiftClosedAt,
};
