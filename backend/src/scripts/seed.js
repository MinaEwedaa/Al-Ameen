require('dotenv').config();
const argon2 = require('argon2');
const connectDB = require('../db/connect');
const env = require('../config/env');
const {
  Room,
  Staff,
  Shift,
  ShiftException,
  Attendance,
  CleaningTask,
  MaintenanceIssue,
  RoomStatusHistory,
  Guest,
  Reservation,
  RoomNight,
  Payment,
  IdempotencyKey,
  Session,
  RoomType,
  ShiftSchedule,
  LeaveRequest,
  ApprovalRequest,
  CancellationSettlement,
  PasswordResetRequest,
  DailyClosing,
  Notification,
  Setting,
} = require('../db/models');
const { toPiastres } = require('../utils/money');

async function seed() {
  if (env.nodeEnv === 'production') {
    console.error('Safety check triggered: Refusing to seed in production environment!');
    process.exit(1);
  }

  console.log('Connecting to database for seeding...');
  await connectDB();
  console.log('Connected.');

  console.log('Clearing old development collections...');
  await Promise.all([
    Room.deleteMany({}),
    Staff.deleteMany({}),
    Shift.deleteMany({}),
    ShiftException.deleteMany({}),
    Attendance.deleteMany({}),
    CleaningTask.deleteMany({}),
    MaintenanceIssue.deleteMany({}),
    RoomStatusHistory.deleteMany({}),
    Guest.deleteMany({}),
    Reservation.deleteMany({}),
    RoomNight.deleteMany({}),
    Payment.collection.deleteMany({}),
    IdempotencyKey.deleteMany({}),
    Session.deleteMany({}),
    RoomType.deleteMany({}),
    ShiftSchedule.deleteMany({}),
    LeaveRequest.deleteMany({}),
    ApprovalRequest.deleteMany({}),
    CancellationSettlement.collection.deleteMany({}),
    PasswordResetRequest.deleteMany({}),
    DailyClosing.deleteMany({}),
    Notification.deleteMany({}),
    Setting.deleteMany({}),
  ]);

  console.log('1. Seeding 12 Rooms with Piastre pricing & Arabic descriptions...');
  const roomsData = [
    {
      room_number: '101',
      room_type: 'VIP',
      floor: 1,
      view: 'garden',
      price_per_night: toPiastres(2500.0), // 250000 piastres
      half_day_price: toPiastres(1250.0), // 125000 piastres
      status: 'available',
      description: 'جناحٌ مَلَكِيٌّ مُطِلٌّ على الحديقةِ ومُجَهَّزٌ بأحدثِ وسائلِ الرّاحَة',
    },
    {
      room_number: '102',
      room_type: 'Normal',
      floor: 1,
      view: 'city',
      price_per_night: toPiastres(1200.0),
      half_day_price: toPiastres(600.0),
      status: 'occupied',
      description: 'غرفةٌ مُزْدَوِجَةٌ هادِئَةٌ مع شرفةٍ واسعة',
    },
    {
      room_number: '103',
      room_type: 'Normal',
      floor: 1,
      view: 'city',
      price_per_night: toPiastres(1000.0),
      half_day_price: toPiastres(500.0),
      status: 'available',
      description: 'غرفةٌ مُفرَدَةٌ مُناسِبَةٌ لِرِجالِ الأعمال',
    },
    {
      room_number: '104',
      room_type: 'Normal',
      floor: 1,
      view: 'garden',
      price_per_night: toPiastres(1100.0),
      half_day_price: toPiastres(550.0),
      status: 'cleaning',
      description: 'غرفةٌ عائليّةٌ صَغيرَةٌ مُطِلّةٌ على المَسْبَح',
    },
    {
      room_number: '201',
      room_type: 'VIP',
      floor: 2,
      view: 'nile',
      price_per_night: toPiastres(3000.0),
      half_day_price: toPiastres(1500.0),
      status: 'available',
      description: 'جناحٌ رئاسيٌّ فاخِرٌ بإطلالةٍ بانوراميّةٍ وسريرٍ كينج',
    },
    {
      room_number: '202',
      room_type: 'VIP',
      floor: 2,
      view: 'city',
      price_per_night: toPiastres(2800.0),
      half_day_price: toPiastres(1400.0),
      status: 'maintenance',
      description: 'جناحٌ تنفيذيٌّ مع جاكوزي خاصّ وتراسٍ فسيح',
    },
    {
      room_number: '203',
      room_type: 'Normal',
      floor: 2,
      view: 'nile',
      price_per_night: toPiastres(1300.0),
      half_day_price: toPiastres(650.0),
      status: 'available',
      description: 'غرفةٌ ديلوكس بسريرينِ مُنفَصِلينِ وإطلالةٍ مُمَيّزة',
    },
    {
      room_number: '204',
      room_type: 'Normal',
      floor: 2,
      view: 'city',
      price_per_night: toPiastres(1200.0),
      half_day_price: toPiastres(600.0),
      status: 'available',
      description: 'غرفةٌ مُزْدَوِجَةٌ كلاسيكيّةٌ مُكيّفة بالكامل',
    },
    {
      room_number: '301',
      room_type: 'VIP',
      floor: 3,
      view: 'nile',
      price_per_night: toPiastres(3500.0),
      half_day_price: toPiastres(1750.0),
      status: 'available',
      description: 'بنتهاوس فاخِرٌ في الطّابَقِ الأخيرِ مع إطلالةٍ ساحِرة',
    },
    {
      room_number: '302',
      room_type: 'Normal',
      floor: 3,
      view: 'garden',
      price_per_night: toPiastres(1400.0),
      half_day_price: toPiastres(700.0),
      status: 'available',
      description: 'غرفةٌ عائليّةٌ رحبةٌ تتّسِعُ لأربعةِ أفراد',
    },
    {
      room_number: '303',
      room_type: 'Normal',
      floor: 3,
      view: 'city',
      price_per_night: toPiastres(1100.0),
      half_day_price: toPiastres(550.0),
      status: 'cleaning',
      description: 'غرفةٌ أنيقةٌ قريبةٌ من المِصْعَدِ الهادئ',
    },
    {
      room_number: '304',
      room_type: 'Normal',
      floor: 3,
      view: 'city',
      price_per_night: toPiastres(1250.0),
      half_day_price: toPiastres(625.0),
      status: 'available',
      description: 'غرفةٌ مُزْدَوِجَةٌ عَصريّةٌ مع رُكنِ عملٍ مُريح',
    },
  ];

  await Room.insertMany(roomsData);
  console.log('Seeded 12 rooms successfully.');

  console.log('2. Seeding Staff accounts with Argon2id passwords...');
  const devPassword = 'Password123';
  const devPasswordHash = await argon2.hash(devPassword);

  console.log('2. Seeding RoomTypes...');
  const vipType = await RoomType.create({
    name: 'VIP',
    description: 'جناح فندقي مميز بإطلالة ومساحة واسعة',
    base_price: toPiastres(2500.0),
    capacity: 3,
    amenities: ['wifi', 'tv', 'balcony', 'minibar'],
    is_active: true,
  });

  const standardType = await RoomType.create({
    name: 'Standard',
    description: 'غرفة مريحة مجهزة بالكامل لراحة النزلاء',
    base_price: toPiastres(1200.0),
    capacity: 2,
    amenities: ['wifi', 'tv', 'ac'],
    is_active: true,
  });

  // Link rooms to room types
  await Room.updateMany({ room_type: 'VIP' }, { $set: { room_type_id: vipType._id } });
  await Room.updateMany({ room_type: 'Standard' }, { $set: { room_type_id: standardType._id } });

  console.log('3. Seeding Staff accounts...');
  const staffData = [
    {
      username: 'ahmed_morning',
      name: 'أحمد محمود',
      name_search: 'احمد محمود',
      password_hash: devPasswordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    },
    {
      username: 'sarah_evening',
      name: 'سارة إبراهيم',
      name_search: 'ساره ابراهيم',
      password_hash: devPasswordHash,
      default_shift_type: 'evening',
      role: 'receptionist',
      active: true,
    },
    {
      username: 'omar_night',
      name: 'عمر مصطفى',
      name_search: 'عمر مصطفي',
      password_hash: devPasswordHash,
      default_shift_type: 'night',
      role: 'receptionist',
      active: true,
    },
    {
      username: 'ali_manager',
      name: 'علي عبد الله',
      name_search: 'علي عبد الله',
      password_hash: devPasswordHash,
      default_shift_type: 'morning',
      role: 'manager',
      active: true,
    },
    {
      username: 'manager1',
      name: 'أحمد المدير',
      name_search: 'احمد المدير',
      email: 'manager1@alamin.com',
      phone: '+201001234567',
      department: 'الإدارة العامة',
      password_hash: devPasswordHash,
      default_shift_type: null,
      role: 'manager',
      active: true,
    },
  ];

  const createdStaff = await Staff.insertMany(staffData);
  const managerStaff = createdStaff.find((s) => s.username === 'manager1');
  const receptionistStaff = createdStaff.find((s) => s.username === 'ahmed_morning');

  console.log('4. Seeding Sample Requests and Notifications...');
  // Create sample Guest and Reservations for approvals
  const guest = await Guest.create({
    name: 'عميل تجريبي',
    name_search: 'عميل تجريبي',
    phone: '+201112223344',
    id_number_enc: 'enc_123',
    id_number_hash: 'hash_123',
    id_number_last4: '1234',
  });

  const room = await Room.findOne({});

  const res1 = await Reservation.create({
    guest_id: guest._id,
    room_id: room._id,
    check_in_at: new Date(),
    check_out_at: new Date(Date.now() + 86400000),
    nights: 1,
    status: 'confirmed',
    price_per_night_snapshot: room.price_per_night,
    half_day_price_snapshot: room.half_day_price,
    total_amount: room.price_per_night,
    paid_cache: room.price_per_night,
  });

  const res2 = await Reservation.create({
    guest_id: guest._id,
    room_id: room._id,
    check_in_at: new Date(Date.now() + 86400000),
    check_out_at: new Date(Date.now() + 172800000),
    nights: 1,
    status: 'confirmed',
    price_per_night_snapshot: room.price_per_night,
    half_day_price_snapshot: room.half_day_price,
    total_amount: room.price_per_night,
    paid_cache: Math.floor(room.price_per_night / 2),
  });

  // Approval requests
  await ApprovalRequest.create([
    {
      reservation_id: res1._id,
      request_type: 'CANCELLATION',
      requested_by_staff_id: receptionistStaff._id,
      net_paid_amount: res1.total_amount,
      requested_refund_amount: res1.total_amount,
      reason: 'طلب النزيل الإلغاء لظروف طارئة',
      status: 'PENDING',
    },
    {
      reservation_id: res2._id,
      request_type: 'REFUND',
      requested_by_staff_id: receptionistStaff._id,
      net_paid_amount: res2.paid_cache,
      requested_refund_amount: res2.paid_cache,
      reason: 'استرداد دفعة جزئية',
      status: 'PENDING',
    },
  ]);

  // Leave request
  await LeaveRequest.create({
    staff_id: receptionistStaff._id,
    leave_type: 'ANNUAL',
    start_date: '2026-11-01',
    end_date: '2026-11-05',
    reason: 'إجازة سنوية اعتيادية',
    status: 'PENDING',
  });

  // Password reset request
  await PasswordResetRequest.create({
    staff_id: receptionistStaff._id,
    username: receptionistStaff.username,
    status: 'PENDING',
    requested_ip: '127.0.0.1',
  });

  // Notifications
  await Notification.create([
    {
      recipient_staff_id: managerStaff._id,
      type: 'APPROVAL_REQUEST',
      title: 'طلب إلغاء حجز معلق',
      message: 'قام موظف الاستقبال بتقديم طلب إلغاء واسترداد لحجز النزيل',
      ref_type: 'ApprovalRequest',
      ref_id: res1._id,
    },
    {
      recipient_staff_id: managerStaff._id,
      type: 'LEAVE_REQUEST',
      title: 'طلب إجازة جديد',
      message: 'طلب إجازة سنوية من أحمد محمود في انتظار موافقتك',
      ref_type: 'LeaveRequest',
      ref_id: receptionistStaff._id,
    },
    {
      recipient_staff_id: managerStaff._id,
      type: 'SYSTEM',
      title: 'طلب إعادة تعيين كلمة المرور',
      message: 'طلب إعادة تعيين كلمة المرور لحساب ahmed_morning',
      ref_type: 'PasswordResetRequest',
      ref_id: receptionistStaff._id,
    },
  ]);

  // Settings
  await Setting.create([
    {
      key: 'hotel',
      value: {
        name: 'Al-Amin Hotel',
        location: 'Cairo, Egypt',
        count_floors: 3,
      },
    },
    {
      key: 'shifts',
      value: {
        morning: { start: 7, end: 16 },
        evening: { start: 16, end: 23 },
        night: { start: 23, end: 7 },
      },
    },
  ]);

  console.log(`Seeded staff, room types, requests, notifications, and settings.`);
  console.log('Database seeding completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
