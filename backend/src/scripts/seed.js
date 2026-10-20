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

  const staffData = [
    {
      username: 'ahmed_morning',
      name: 'أحمد محمود',
      password_hash: devPasswordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    },
    {
      username: 'sarah_evening',
      name: 'سارة إبراهيم',
      password_hash: devPasswordHash,
      default_shift_type: 'evening',
      role: 'receptionist',
      active: true,
    },
    {
      username: 'omar_night',
      name: 'عمر مصطفى',
      password_hash: devPasswordHash,
      default_shift_type: 'night',
      role: 'receptionist',
      active: true,
    },
    {
      username: 'ali_manager',
      name: 'علي عبد الله',
      password_hash: devPasswordHash,
      default_shift_type: 'morning',
      role: 'manager',
      active: true,
    },
  ];

  await Staff.insertMany(staffData);
  console.log(`Seeded ${staffData.length} staff accounts (default password: "${devPassword}").`);

  console.log('Database seeding completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
