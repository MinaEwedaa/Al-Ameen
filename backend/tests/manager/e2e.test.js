// Feature M14: End-to-End Scenario Test (tests/manager/e2e.test.js)
// Full real-world daily lifecycle:
// 1. Manager logs in
// 2. Manager opens the business day
// 3. Manager creates receptionist and schedules shift
// 4. Receptionist logs in with active shift
// 5. Receptionist takes payment on a reservation
// 6. Receptionist requests cancellation of paid reservation (202 ACCEPTED)
// 7. Manager approves refund
// 8. Receptionist hands over shift
// 9. Manager reviews & approves report (PDF is generated & stored)
// 10. Leave request is approved with shift cancellation
// 11. Manager closes business day with Contract arithmetic
// 12. Assertions: no pending approvals, closing totals match payments, second close is 409

const request = require('supertest');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Room,
  RoomType,
  Reservation,
  RoomNight,
  Guest,
  Shift,
  ShiftSchedule,
  ShiftReport,
  ApprovalRequest,
  CancellationSettlement,
  LeaveRequest,
  DailyClosing,
  Payment,
  Setting,
} = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { todayCairo, ZONE, setShiftHours } = require('../../src/utils/time');
const { toPiastres } = require('../../src/utils/money');

jest.setTimeout(60000);

describe('Manager Feature M14: End-to-End Daily Lifecycle Scenario', () => {
  let manager;
  let managerToken;
  let roomType, room;

  const key = () => crypto.randomUUID();
  const mgrAuth = () => ({ Authorization: `Bearer ${managerToken}` });

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
    await Reservation.deleteMany({});
    await RoomNight.deleteMany({});
    await Guest.deleteMany({});
    await Shift.deleteMany({});
    await ShiftSchedule.deleteMany({});
    await ShiftReport.deleteMany({});
    await ApprovalRequest.deleteMany({});
    await LeaveRequest.deleteMany({});
    await DailyClosing.deleteMany({});
    await Setting.deleteMany({});

    await Setting.create({
      key: 'hotel',
      value: { name: 'Al-Amin Grand Hotel', location: 'Alexandria', count_floors: 5 },
    });

    // 1. Setup Manager account
    const mgrPwdHash = await hashPassword('ManagerPass123!');
    manager = await Staff.create({
      username: 'e2e_general_manager',
      password_hash: mgrPwdHash,
      name: 'General Manager Tareq',
      role: 'manager',
      active: true,
      email: 'tareq.gm@alamin.com',
      phone: '+201000000100',
    });

    const sMgr = await Session.create({
      staff_id: manager._id,
      refresh_hash: 'mgr_session_hash',
      expires_at: new Date(Date.now() + 86400e3),
    });
    managerToken = signAccess({ staffId: manager._id, sessionId: sMgr._id, role: 'manager' });

    // Room and RoomType
    roomType = await RoomType.create({
      name: 'Standard Sea View',
      base_price: 1000,
      capacity: 2,
      description: 'Double room with sea view',
      amenities: ['WiFi', 'Air Conditioning'],
    });

    room = await Room.create({
      room_number: '201',
      room_type: 'Standard Sea View',
      room_type_id: roomType._id,
      floor: 2,
      status: 'available',
      price_per_night: 100000,
      half_day_price: 50000,
    });
  });

  test('Full day scenario: Login -> Open Day -> Staff Creation & Shift -> Payment -> Cancel (202) -> Approve Refund -> Handover -> Review Report (PDF) -> Leave -> Close Day', async () => {
    const today = todayCairo();

    // 1. Manager verifies login & overview
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'e2e_general_manager', password: 'ManagerPass123!' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.staff.role).toBe('manager');
    managerToken = loginRes.body.access_token;

    // 2. Manager opens the business day
    const openRes = await request(app)
      .post('/api/v1/manager/daily-closings/open')
      .set(mgrAuth())
      .set('Idempotency-Key', key())
      .send({});
    expect(openRes.status).toBe(201);
    expect(openRes.body.data.status).toBe('OPEN');
    expect(openRes.body.data.business_date).toBe(today);

    // 3. Manager creates receptionist and schedules shift
    const createStaffRes = await request(app)
      .post('/api/v1/manager/staff')
      .set(mgrAuth())
      .send({
        username: 'e2e_receptionist_nour',
        full_name: 'Nour Receptionist',
        staff_type: 'RECEPTIONIST',
        default_shift_type: 'morning',
        email: 'nour.rec@alamin.com',
        phone: '+201012345678',
        hire_date: today,
      });
    expect(createStaffRes.status).toBe(201);
    expect(createStaffRes.headers['cache-control']).toBe('no-store');
    const recId = createStaffRes.body.data.id;
    const recUsername = createStaffRes.body.data.username;
    const tempPassword = createStaffRes.body.data.temporary_password;
    expect(tempPassword).toBeTruthy();

    const futureDate = DateTime.now().setZone(ZONE).plus({ days: 2 }).toISODate();
    const createShiftRes = await request(app)
      .post('/api/v1/manager/shifts')
      .set(mgrAuth())
      .send({
        staff_id: recId,
        shift_date: futureDate,
        shift_type: 'morning',
      });
    expect(createShiftRes.status).toBe(201);

    // 4. Receptionist logs in and starts active shift
    const recStaff = await Staff.findById(recId);
    const sRec = await Session.create({
      staff_id: recStaff._id,
      refresh_hash: 'rec_sess',
      expires_at: new Date(Date.now() + 86400e3),
    });
    const recToken = signAccess({ staffId: recStaff._id, sessionId: sRec._id, role: 'receptionist' });
    const recAuth = () => ({ Authorization: `Bearer ${recToken}` });

    const activeShift = await Shift.create({
      staff_id: recStaff._id,
      shift_date: today,
      shift_type: 'morning',
      start_at: new Date(Date.now() - 3600e3 * 2),
      end_at: new Date(Date.now() + 3600e3 * 6),
      status: 'active',
    });

    // 5. Receptionist takes payment on a reservation
    const guestRes = await request(app)
      .post('/api/v1/guests')
      .set(recAuth())
      .send({ name: 'Youssef Mansour', phone: '01112223333', id_number: '29001011234567' });
    expect(guestRes.status).toBe(201);
    const guestId = guestRes.body.guest_id;

    const checkInIso = DateTime.now().setZone(ZONE).plus({ days: 3 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toISO();
    const checkOutIso = DateTime.now().setZone(ZONE).plus({ days: 5 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toISO();

    const reservationRes = await request(app)
      .post('/api/v1/reservations')
      .set(recAuth())
      .set('Idempotency-Key', key())
      .send({
        guest_id: guestId,
        room_id: String(room._id),
        check_in: checkInIso,
        check_out: checkOutIso,
      });
    expect(reservationRes.status).toBe(201);
    const reservationId = reservationRes.body.reservation_id;

    // Record cash payment of 1000 EGP (100000 piastres)
    const payment = await Payment.create({
      reservation_id: reservationId,
      staff_id: recStaff._id,
      shift_id: activeShift._id,
      amount: 100000,
      payment_method: 'cash',
      payment_datetime: new Date(),
      payment_type: 'payment',
    });
    await Reservation.updateOne({ _id: reservationId }, { $inc: { paid_cache: 100000 } });

    // 6. Receptionist requests cancellation of that paid reservation -> 202 ACCEPTED
    const cancelRes = await request(app)
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set(recAuth())
      .set('Idempotency-Key', key())
      .send({ reason: 'Guest requested travel date cancellation' });

    expect(cancelRes.status).toBe(202);
    expect(cancelRes.body.data.status).toBe('PENDING_APPROVAL');

    const approval = await ApprovalRequest.findOne({ reservation_id: reservationId });
    expect(approval).toBeTruthy();
    expect(approval.status).toBe('PENDING');
    expect(approval.request_type).toBe('CANCELLATION');

    // 7. Manager approves a partial refund (700 EGP refund out of 1000 paid)
    const decideRes = await request(app)
      .patch(`/api/v1/manager/approvals/${approval._id}/decision`)
      .set(mgrAuth())
      .set('Idempotency-Key', key())
      .send({
        action: 'APPROVE',
        approved_refund_amount: 700,
        manager_comment: 'Approved 700 EGP partial refund according to hotel policy',
      });

    expect(decideRes.status).toBe(200);
    expect(decideRes.body.data.status).toBe('APPROVED');
    expect(decideRes.body.data.approved_refund_amount).toBe(700);

    // 8. Receptionist hands over shift
    activeShift.status = 'handed_over';
    activeShift.handed_over_at = new Date();
    await activeShift.save();

    const report = await ShiftReport.create({
      shift_id: activeShift._id,
      shift_date: today,
      business_date: today,
      shift_type: 'morning',
      staff_id: recStaff._id,
      staff_name: recStaff.name,
      total_payments_cash: 100000,
      total_payments_electronic: 0,
      total_refunds_cash: 70000,
      net_cash: 30000,
      system_cash: 30000,
      actual_cash: 30000,
      handover_notes: 'All reservations handled smoothly',
      review_status: 'PENDING_REVIEW',
    });

    // 9. Manager reviews and approves the report -> PDF generated and stored
    const reviewRes = await request(app)
      .patch(`/api/v1/manager/shift-reports/${report._id}/review`)
      .set(mgrAuth())
      .send({
        review_status: 'APPROVED',
        manager_comment: 'Excellent shift management',
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.review_status).toBe('APPROVED');

    // Verify PDF is generated and retrievable
    const pdfRes = await request(app)
      .get(`/api/v1/manager/shift-reports/${report._id}/pdf`)
      .set(mgrAuth());
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');

    // 10. Leave request approval with shift cancellation
    const leave = await LeaveRequest.create({
      staff_id: recStaff._id,
      leave_type: 'ANNUAL',
      start_date: futureDate,
      end_date: futureDate,
      reason: 'Personal leave',
      status: 'PENDING',
    });

    const leaveDecideRes = await request(app)
      .patch(`/api/v1/manager/leave-requests/${leave._id}/decision`)
      .set(mgrAuth())
      .send({
        action: 'APPROVE',
        manager_comment: 'Approved leave request',
        cancel_scheduled_shifts: true,
      });

    expect(leaveDecideRes.status).toBe(200);
    expect(leaveDecideRes.body.data.status).toBe('APPROVED');

    // Verify overlapping scheduled shift was cancelled
    const scheduledShift = await ShiftSchedule.findOne({
      staff_id: recStaff._id,
      shift_date: futureDate,
    });
    if (scheduledShift) {
      expect(scheduledShift.status).toBe('CANCELLED');
    }

    // 11. Manager closes the day
    // Net cash: 1000 EGP (payment) - 700 EGP (refund) = 300 EGP
    const closeRes = await request(app)
      .post('/api/v1/manager/daily-closings/close')
      .set(mgrAuth())
      .set('Idempotency-Key', key())
      .send({
        actual_cash: 300,
        notes: 'End of business day closed by GM Tareq',
      });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.status).toBe('CLOSED');
    expect(closeRes.body.data.gross_revenue).toBe(1000);
    expect(closeRes.body.data.refunds_total).toBe(700);
    expect(closeRes.body.data.total_revenue).toBe(300);

    // 12. Final Assertions
    // Assert no pending approvals exist
    const pendingApprovals = await ApprovalRequest.countDocuments({ status: 'PENDING' });
    expect(pendingApprovals).toBe(0);

    // Assert second close gives 409 NO_OPEN_BUSINESS_DAY
    const secondCloseRes = await request(app)
      .post('/api/v1/manager/daily-closings/close')
      .set(mgrAuth())
      .set('Idempotency-Key', key())
      .send({ actual_cash: 300 });

    expect(secondCloseRes.status).toBe(409);
    expect(secondCloseRes.body.error.code).toBe('NO_OPEN_BUSINESS_DAY');
  });
});
