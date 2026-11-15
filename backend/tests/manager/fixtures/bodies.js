// Valid sample request bodies for write routes in Manager Module
// Used by access.test.js and contract verification to pass schema validation before auth checks

module.exports = {
  'PATCH /password-reset-requests/:id/decision': {
    action: 'APPROVE',
  },
  'POST /notifications/read-all': {},
  'PATCH /notifications/:id/read': {},
  'PATCH /notifications/preferences': {
    approval_request: true,
    leave_request: true,
    critical_maintenance: true,
  },
  'POST /staff': {
    username: 'sample_matrix_staff',
    full_name: 'Sample Matrix Staff',
    staff_type: 'RECEPTIONIST',
    default_shift_type: 'morning',
    email: 'sample.matrix@hotel.com',
    phone: '+201000000088',
    hire_date: '2026-01-01',
  },
  'PATCH /staff/:id': {
    full_name: 'Updated Matrix Staff',
  },
  'DELETE /staff/:id': {},
  'POST /staff/:id/reactivate': {},
  'POST /staff/:id/reset-password': {},
  'POST /room-types': {
    name: 'Sample Matrix Room Type',
    base_price: 1200,
    capacity: 2,
    description: 'Matrix testing room type',
    amenities: ['WiFi', 'TV'],
  },
  'PATCH /room-types/:id': {
    description: 'Updated room type description',
  },
  'PATCH /rooms/:id': {
    physical_status: 'CLEAN',
  },
  'PATCH /housekeeping-tasks/:id/assign': {
    cleaner_name: 'Ali Housekeeper',
  },
  'POST /shifts': {
    staff_id: '6738b556f8f8b83988b00001',
    shift_date: '2026-11-25',
    shift_type: 'morning',
  },
  'PATCH /shifts/:id': {
    shift_type: 'evening',
  },
  'DELETE /shifts/:id': {},
  'POST /shifts/:id/force-close': {
    reason: 'Emergency manager takeover',
  },
  'PATCH /leave-requests/:id/decision': {
    decision: 'APPROVE',
  },
  'PATCH /approvals/:id/decision': {
    decision: 'APPROVE',
  },
  'PATCH /shift-reports/:id/review': {
    status: 'APPROVED',
    manager_notes: 'Reviewed and verified',
  },
  'POST /daily-closings/open': {},
  'POST /daily-closings/close': {
    actual_cash: 10000,
    notes: 'End of day closing',
  },
  'PATCH /hotel-settings': {
    name: 'Al-Amin Grand Hotel',
  },
  'PATCH /shift-settings': {
    morning: { start: 7, end: 15 },
    evening: { start: 15, end: 23 },
    night: { start: 23, end: 7 },
  },
};
