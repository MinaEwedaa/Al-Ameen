// Feature M13: Security Hardening - No Leak Test
// Asserts that no GET route under /api/v1/manager leaks sensitive keys or 14-digit national IDs

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Room,
  RoomType,
  Shift,
  ShiftSchedule,
  ShiftReport,
  LeaveRequest,
  ApprovalRequest,
  DailyClosing,
  Payment,
  Reservation,
  Guest,
  CleaningTask,
  MaintenanceIssue,
  Setting,
} = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { encrypt, blindIndex } = require('../../src/utils/crypto');
const { todayCairo, setShiftHours } = require('../../src/utils/time');

describe('Manager Feature M13: Security - No-Leak Verification', () => {
  let manager, receptionist;
  let managerToken;
  let sampleStaffId, sampleRoomId, sampleTypeId, sampleShiftReportId;
  let sampleLeaveId, sampleApprovalId, sampleClosingId;

  const raw14DigitId = '29501011234567';

  beforeAll(async () => {
    setShiftHours({
      morning: { start: 7, end: 15 },
      evening: { start: 15, end: 23 },
      night: { start: 23, end: 7 },
    });

    await Staff.deleteMany({});
    await Session.deleteMany({});
    await Room.deleteMany({});
    await RoomType.deleteMany({});
    await Shift.deleteMany({});
    await ShiftSchedule.deleteMany({});
    await ShiftReport.deleteMany({});
    await LeaveRequest.deleteMany({});
    await ApprovalRequest.deleteMany({});
    await DailyClosing.deleteMany({});
    await Reservation.deleteMany({});
    await Guest.deleteMany({});
    await CleaningTask.deleteMany({});
    await MaintenanceIssue.deleteMany({});
    await Setting.deleteMany({});

    const pwdHash = await hashPassword('SecretManagerPass123!');
    const recPwdHash = await hashPassword('SecretReceptionistPass123!');

    manager = await Staff.create({
      username: 'general_manager',
      password_hash: pwdHash,
      name: 'General Manager',
      role: 'manager',
      active: true,
      email: 'gm@hotel.com',
      phone: '+201000000001',
      id_number_enc: encrypt(raw14DigitId),
      id_number_hash: blindIndex(raw14DigitId),
      id_number_last4: '4567',
    });

    receptionist = await Staff.create({
      username: 'receptionist_one',
      password_hash: recPwdHash,
      name: 'Samir Reception',
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
      email: 'samir@hotel.com',
      phone: '+201000000002',
      id_number_enc: encrypt('29802021234568'),
      id_number_hash: blindIndex('29802021234568'),
      id_number_last4: '4568',
    });
    sampleStaffId = String(receptionist._id);

    const mgrSession = await Session.create({
      staff_id: manager._id,
      refresh_hash: 'super_secret_refresh_hash_value_12345',
      expires_at: new Date(Date.now() + 86400e3),
    });
    managerToken = signAccess({ staffId: manager._id, sessionId: mgrSession._id, role: 'manager' });

    const roomType = await RoomType.create({
      name: 'Executive Deluxe',
      base_price: 1500,
      capacity: 2,
      description: 'Luxury suite',
      amenities: ['WiFi', 'Minibar'],
    });
    sampleTypeId = String(roomType._id);

    const room = await Room.create({
      room_number: '101',
      room_type: 'Executive Deluxe',
      room_type_id: roomType._id,
      floor: 1,
      status: 'available',
      price_per_night: 150000,
      half_day_price: 75000,
    });
    sampleRoomId = String(room._id);

    const today = todayCairo();
    const shift = await Shift.create({
      staff_id: receptionist._id,
      shift_date: today,
      shift_type: 'morning',
      start_at: new Date(Date.now() - 3600e3 * 8),
      end_at: new Date(),
      status: 'handed_over',
      handed_over_at: new Date(),
    });

    const shiftReport = await ShiftReport.create({
      shift_id: shift._id,
      business_date: today,
      shift_type: 'morning',
      staff_id: receptionist._id,
      staff_name: receptionist.name,
      pdf_data: Buffer.from('%PDF-1.4 dummy pdf buffer content'),
      pdf_generated_at: new Date(),
      total_payments_cash: 5000,
      total_payments_electronic: 0,
      total_refunds_cash: 0,
      net_cash: 5000,
      system_cash: 5000,
      actual_cash: 5000,
      handover_notes: 'All clean',
    });
    sampleShiftReportId = String(shiftReport._id);

    const leave = await LeaveRequest.create({
      staff_id: receptionist._id,
      leave_type: 'ANNUAL',
      start_date: today,
      end_date: today,
      reason: 'Vacation leave',
      status: 'PENDING',
    });
    sampleLeaveId = String(leave._id);

    const approval = await ApprovalRequest.create({
      request_type: 'DISCOUNT',
      requested_by_staff_id: receptionist._id,
      reason: 'VIP guest discount',
      proposed_value: 200,
      status: 'PENDING',
    });
    sampleApprovalId = String(approval._id);

    const closing = await DailyClosing.create({
      business_date: today,
      status: 'OPEN',
      opened_at: new Date(),
      opened_by_staff_id: manager._id,
    });
    sampleClosingId = String(closing._id);

    await Setting.create({
      key: 'hotel',
      value: { name: 'Al-Amin Test Hotel', location: 'Alexandria', count_floors: 5 },
    });
  });

  const SENSITIVE_STRINGS = [
    'password_hash',
    'id_number_enc',
    'id_number_hash',
    'refresh_hash',
    'pdf_data',
  ];

  const FOURTEEN_DIGITS_REGEX = /\b\d{14}\b/;

  function assertNoSensitiveLeak(body) {
    const text = JSON.stringify(body);
    for (const key of SENSITIVE_STRINGS) {
      expect(text).not.toContain(`"${key}"`);
    }
    // Assert no raw unmasked 14-digit Egyptian national ID is present
    const match = text.match(FOURTEEN_DIGITS_REGEX);
    expect(match).toBeNull();
  }

  const getRoutes = [
    ['/api/v1/manager/staff', 'GET /staff'],
    ['/api/v1/manager/staff/:id', 'GET /staff/:id'],
    ['/api/v1/manager/rooms', 'GET /rooms'],
    ['/api/v1/manager/rooms/:id/activities', 'GET /rooms/:id/activities'],
    ['/api/v1/manager/room-types', 'GET /room-types'],
    ['/api/v1/manager/room-types/:id', 'GET /room-types/:id'],
    ['/api/v1/manager/housekeeping-tasks', 'GET /housekeeping-tasks'],
    ['/api/v1/manager/shifts/overview', 'GET /shifts/overview'],
    ['/api/v1/manager/shifts', 'GET /shifts'],
    ['/api/v1/manager/shifts/roster', 'GET /shifts/roster'],
    ['/api/v1/manager/leave-requests', 'GET /leave-requests'],
    ['/api/v1/manager/leave-requests/:id', 'GET /leave-requests/:id'],
    ['/api/v1/manager/approvals', 'GET /approvals'],
    ['/api/v1/manager/approvals/:id', 'GET /approvals/:id'],
    ['/api/v1/manager/shift-reports', 'GET /shift-reports'],
    ['/api/v1/manager/shift-reports/:id', 'GET /shift-reports/:id'],
    ['/api/v1/manager/shift-reports/:id/activities', 'GET /shift-reports/:id/activities'],
    ['/api/v1/manager/shift-reports/:id/handover', 'GET /shift-reports/:id/handover'],
    ['/api/v1/manager/daily-closings', 'GET /daily-closings'],
    ['/api/v1/manager/daily-closings/current', 'GET /daily-closings/current'],
    ['/api/v1/manager/payments', 'GET /payments'],
    ['/api/v1/manager/dashboard/overview', 'GET /dashboard/overview'],
    ['/api/v1/manager/dashboard/revenue', 'GET /dashboard/revenue'],
    ['/api/v1/manager/dashboard/issues', 'GET /dashboard/issues'],
    ['/api/v1/manager/activities', 'GET /activities'],
    ['/api/v1/manager/hotel-settings', 'GET /hotel-settings'],
    ['/api/v1/manager/shift-settings', 'GET /shift-settings'],
    ['/api/v1/manager/search?q=29501011234567', 'GET /search (14-digit search)'],
    ['/api/v1/manager/notifications', 'GET /notifications'],
    ['/api/v1/manager/notifications/preferences', 'GET /notifications/preferences'],
    ['/api/v1/manager/password-reset-requests', 'GET /password-reset-requests'],
  ];

  for (const [routePattern, label] of getRoutes) {
    test(`assert no sensitive data leak on ${label}`, async () => {
      const url = routePattern
        .replace(':id', (p) => {
          if (routePattern.includes('/staff/')) return sampleStaffId;
          if (routePattern.includes('/rooms/')) return sampleRoomId;
          if (routePattern.includes('/room-types/')) return sampleTypeId;
          if (routePattern.includes('/leave-requests/')) return sampleLeaveId;
          if (routePattern.includes('/approvals/')) return sampleApprovalId;
          if (routePattern.includes('/shift-reports/')) return sampleShiftReportId;
          if (routePattern.includes('/daily-closings/')) return sampleClosingId;
          return sampleStaffId;
        });

      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBeLessThan(400);
      assertNoSensitiveLeak(res.body);
    });
  }
});
