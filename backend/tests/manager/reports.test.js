const request = require('supertest');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Room,
  RoomType,
  Reservation,
  Payment,
  CleaningTask,
  Shift,
} = require('../../src/db/models');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { todayCairo } = require('../../src/utils/time');

describe('Manager Real Reports Module (/api/v1/manager/reports/aggregated)', () => {
  let managerToken;
  let receptionistToken;
  let managerStaff;
  let recStaff;
  let roomVip;
  let roomStd;
  let reservation;
  let shift;
  let payment1;
  let payment2;

  beforeAll(async () => {
    // 1. Create staff
    managerStaff = await Staff.create({
      username: `rep_mgr_${Date.now()}`,
      name: 'Reports Manager',
      role: 'manager',
      status: 'active',
      password_hash: '$2b$10$abcdefghijklmnopqrstuu',
    });
    const sMgr = await Session.create({
      staff_id: managerStaff._id,
      refresh_hash: 'mgr_hash_rep',
      expires_at: new Date(Date.now() + 86400e3),
    });
    managerToken = signAccess({ staffId: managerStaff._id, sessionId: sMgr._id, role: 'manager' });

    recStaff = await Staff.create({
      username: `rep_rec_${Date.now()}`,
      name: 'Reports Receptionist',
      role: 'receptionist',
      status: 'active',
      default_shift_type: 'morning',
      password_hash: '$2b$10$abcdefghijklmnopqrstuu',
    });
    const sRec = await Session.create({
      staff_id: recStaff._id,
      refresh_hash: 'rec_hash_rep',
      expires_at: new Date(Date.now() + 86400e3),
    });
    receptionistToken = signAccess({ staffId: recStaff._id, sessionId: sRec._id, role: 'receptionist' });

    // 2. Create room type and rooms
    const rt = await RoomType.create({ name: `Deluxe_${Date.now()}`, base_price: 200000 });
    roomVip = await Room.create({
      room_number: `8${Math.floor(10 + Math.random() * 89)}`,
      room_type_id: rt._id,
      room_type: 'VIP',
      price_per_night: 200000,
      half_day_price: 100000,
      floor: 8,
      status: 'occupied',
    });
    roomStd = await Room.create({
      room_number: `7${Math.floor(10 + Math.random() * 89)}`,
      room_type_id: rt._id,
      room_type: 'Normal',
      price_per_night: 100000,
      half_day_price: 50000,
      floor: 7,
      status: 'available',
    });

    // 3. Create or find shift & reservation
    shift = await Shift.findOne({ shift_date: todayCairo(), shift_type: 'morning' });
    let createdShift = false;
    if (!shift) {
      shift = await Shift.create({
        staff_id: recStaff._id,
        shift_date: todayCairo(),
        shift_type: 'morning',
        start_at: new Date(),
        end_at: new Date(Date.now() + 8 * 3600e3),
        status: 'active',
      });
      createdShift = true;
    }

    reservation = await Reservation.create({
      guest_id: recStaff._id,
      room_id: roomVip._id,
      check_in_at: new Date(),
      check_out_at: new Date(Date.now() + 86400e3),
      nights: 1,
      status: 'checked_in',
      price_per_night_snapshot: 200000,
      half_day_price_snapshot: 100000,
      total_amount: 200000,
      paid_cache: 200000,
    });

    // 4. Record real payments (as receptionist checked in the guest)
    payment1 = await Payment.create({
      reservation_id: reservation._id,
      staff_id: recStaff._id,
      shift_id: shift._id,
      amount: 120000, // 1200 EGP
      payment_method: 'cash',
      payment_type: 'payment',
      payment_datetime: new Date(),
      notes: 'Initial check-in payment',
    });

    payment2 = await Payment.create({
      reservation_id: reservation._id,
      staff_id: recStaff._id,
      shift_id: shift._id,
      amount: 80000, // 800 EGP
      payment_method: 'instapay',
      payment_type: 'payment',
      payment_datetime: new Date(),
      notes: 'Balance payment via Instapay',
    });
  });

  afterAll(async () => {
    if (payment1?._id || payment2?._id) {
      await Payment.collection.deleteMany({ _id: { $in: [payment1?._id, payment2?._id].filter(Boolean) } });
    }
    if (reservation?._id) {
      await Reservation.deleteMany({ _id: reservation._id });
    }
    if (roomVip?._id || roomStd?._id) {
      await Room.deleteMany({ _id: { $in: [roomVip?._id, roomStd?._id].filter(Boolean) } });
    }
    if (managerStaff?._id || recStaff?._id) {
      await Staff.deleteMany({ _id: { $in: [managerStaff?._id, recStaff?._id].filter(Boolean) } });
      await Session.deleteMany({ staff_id: { $in: [managerStaff?._id, recStaff?._id].filter(Boolean) } });
    }
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/manager/reports/aggregated');
    expect(res.statusCode).toBe(401);
  });

  it('rejects receptionist token with 403', async () => {
    const res = await request(app)
      .get('/api/v1/manager/reports/aggregated')
      .set('Authorization', `Bearer ${receptionistToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('aggregates real database payments and room occupancy correctly', async () => {
    const res = await request(app)
      .get('/api/v1/manager/reports/aggregated?period=daily')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(200);
    const data = res.body.data;

    // Real payments: 1200 + 800 = 2000 EGP
    expect(data.revenue).toBeGreaterThanOrEqual(2000);
    expect(data.transactions_count).toBeGreaterThanOrEqual(2);

    // Payment methods breakdown
    expect(data.payment_methods.cash).toBeGreaterThanOrEqual(1200);
    expect(data.payment_methods.instapay).toBeGreaterThanOrEqual(800);

    // Room metrics from database
    expect(data.total_rooms).toBeGreaterThanOrEqual(2);
    expect(data.occupied_rooms).toBeGreaterThanOrEqual(1);
    expect(data.rooms_performance.vip.rooms_count).toBeGreaterThanOrEqual(1);

    // Monthly bars have 12 months
    expect(data.monthly_bars).toHaveLength(12);
    expect(data.monthly_bars[0]).toHaveProperty('month');
    expect(data.monthly_bars[0]).toHaveProperty('revenue');
  });

  it('filters real report by payment_method', async () => {
    const res = await request(app)
      .get('/api/v1/manager/reports/aggregated?period=daily&payment_method=CASH')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(200);
    const data = res.body.data;
    expect(data.payment_methods.cash).toBeGreaterThanOrEqual(1200);
    expect(data.payment_methods.instapay).toBe(0);
  });
});
