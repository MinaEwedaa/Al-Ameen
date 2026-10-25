const mongoose = require('mongoose');
const {
  CancellationSettlement,
  DailyClosing,
  Staff,
  ShiftReport,
  Shift,
  Room,
  RoomType,
  Payment,
  Setting,
  AuditLog,
} = require('../../src/db/models');
const { runManagerMigration } = require('../../scripts/manager-migrate');

describe('Manager Module M1: Database Changes & Models', () => {
  describe('CancellationSettlement append-only enforcement', () => {
    test('creation succeeds, while updateOne and deleteOne throw an error', async () => {
      const settlement = await CancellationSettlement.create({
        approval_id: new mongoose.Types.ObjectId(),
        reservation_id: new mongoose.Types.ObjectId(),
        shift_id: new mongoose.Types.ObjectId(),
        net_paid_amount: 50000,
        refunded_amount: 40000,
        retained_amount: 10000,
        decided_by_staff_id: new mongoose.Types.ObjectId(),
      });

      expect(settlement._id).toBeDefined();

      // updateOne should throw
      await expect(
        CancellationSettlement.updateOne({ _id: settlement._id }, { retained_amount: 20000 })
      ).rejects.toThrow('CancellationSettlement is append-only');

      // findOneAndUpdate should throw
      await expect(
        CancellationSettlement.findOneAndUpdate(
          { _id: settlement._id },
          { retained_amount: 20000 }
        )
      ).rejects.toThrow('CancellationSettlement is append-only');

      // deleteOne should throw
      await expect(
        CancellationSettlement.deleteOne({ _id: settlement._id })
      ).rejects.toThrow('CancellationSettlement is append-only');

      // save on existing should throw
      settlement.retained_amount = 20000;
      await expect(settlement.save()).rejects.toThrow('CancellationSettlement is append-only');
    });
  });

  describe('DailyClosing partial index enforcement', () => {
    test('creating a second OPEN day throws duplicate key error, while multiple CLOSED days are fine', async () => {
      // Clean up any DailyClosing docs first
      await DailyClosing.deleteMany({});
      await DailyClosing.syncIndexes();

      // 1. First OPEN day succeeds
      await DailyClosing.create({
        business_date: '2026-11-01',
        status: 'OPEN',
      });

      // 2. Second OPEN day must fail with duplicate key on partial index
      await expect(
        DailyClosing.create({
          business_date: '2026-11-02',
          status: 'OPEN',
        })
      ).rejects.toThrow(/duplicate key|E11000/);

      // 3. Creating CLOSED days next to an OPEN one succeeds
      const closed1 = await DailyClosing.create({
        business_date: '2026-10-30',
        status: 'CLOSED',
      });
      const closed2 = await DailyClosing.create({
        business_date: '2026-10-31',
        status: 'CLOSED',
      });

      expect(closed1.status).toBe('CLOSED');
      expect(closed2.status).toBe('CLOSED');
    });
  });

  describe('Staff schema validation & sparse unique indexes', () => {
    test('rejects a role outside the allowed list', async () => {
      const invalidStaff = new Staff({
        username: 'invalid_role_user',
        name: 'Invalid Role User',
        password_hash: 'hash',
        role: 'superhero', // invalid role
      });

      await expect(invalidStaff.validate()).rejects.toThrow();
    });

    test('allows multiple staff members without id_number_hash (sparse index)', async () => {
      const staff1 = await Staff.create({
        username: 'sparse_staff_1_' + Date.now(),
        name: 'Staff 1',
        password_hash: 'hash',
        role: 'manager',
        // no id_number_hash
      });

      const staff2 = await Staff.create({
        username: 'sparse_staff_2_' + Date.now(),
        name: 'Staff 2',
        password_hash: 'hash',
        role: 'manager',
        // no id_number_hash
      });

      expect(staff1._id).toBeDefined();
      expect(staff2._id).toBeDefined();
    });
  });

  describe('ShiftReport review_status defaults', () => {
    test('review_status defaults to PENDING_REVIEW', async () => {
      const shift = await Shift.create({
        staff_id: new mongoose.Types.ObjectId(),
        shift_date: '2026-11-01',
        shift_type: 'morning',
        start_at: new Date(),
        end_at: new Date(Date.now() + 8 * 3600e3),
      });

      const report = await ShiftReport.create({
        shift_id: shift._id,
        pdf: Buffer.from('dummy-pdf'),
        sha256: 'dummy-sha256',
      });

      expect(report.review_status).toBe('PENDING_REVIEW');
    });
  });

  describe('manager-migrate script', () => {
    beforeAll(async () => {
      // Clean up migration test collections
      await Promise.all([
        Room.deleteMany({}),
        RoomType.deleteMany({}),
        Staff.deleteMany({}),
        Payment.collection.deleteMany({}),
        Shift.deleteMany({}),
        ShiftReport.deleteMany({}),
        Setting.deleteMany({}),
        AuditLog.collection.deleteMany({ action: 'MANAGER_MIGRATION' }),
      ]);

      // Seed test data with missing M1 fields:
      // 1. Rooms without room_type_id
      await Room.create([
        {
          room_number: '901',
          room_type: 'Deluxe',
          price_per_night: 300000,
          half_day_price: 150000,
          floor: 4,
          status: 'available',
        },
        {
          room_number: '902',
          room_type: 'Deluxe',
          price_per_night: 350000,
          half_day_price: 175000,
          floor: 4,
          status: 'available',
        },
      ]);

      // 2. Staff without name_search or notification_prefs
      await Staff.collection.insertOne({
        username: 'old_staff_member',
        name: 'أحمد إبراهيم',
        password_hash: 'hash',
        role: 'receptionist',
        default_shift_type: 'morning',
        active: true,
      });

      // 3. Payments without payment_type
      await Payment.collection.insertMany([
        {
          reservation_id: new mongoose.Types.ObjectId(),
          staff_id: new mongoose.Types.ObjectId(),
          shift_id: new mongoose.Types.ObjectId(),
          amount: 50000,
          payment_method: 'cash',
          payment_datetime: new Date(),
        },
        {
          reservation_id: new mongoose.Types.ObjectId(),
          staff_id: new mongoose.Types.ObjectId(),
          shift_id: new mongoose.Types.ObjectId(),
          amount: -20000,
          payment_method: 'cash',
          payment_datetime: new Date(),
        },
      ]);
    });

    test('--dry-run prints actions but writes nothing to the database', async () => {
      const countsBefore = await Promise.all([
        RoomType.countDocuments({}),
        Payment.collection.countDocuments({ payment_type: { $exists: true } }),
        Setting.countDocuments({}),
        AuditLog.countDocuments({ action: 'MANAGER_MIGRATION' }),
      ]);

      await runManagerMigration({ dry: true, by: 'test', reason: 'unit test dry run' });

      const countsAfter = await Promise.all([
        RoomType.countDocuments({}),
        Payment.collection.countDocuments({ payment_type: { $exists: true } }),
        Setting.countDocuments({}),
        AuditLog.countDocuments({ action: 'MANAGER_MIGRATION' }),
      ]);

      expect(countsAfter).toEqual(countsBefore);
    });

    test('actual migration creates RoomType, updates rooms, payments, staff and writes audit log', async () => {
      const result = await runManagerMigration({
        dry: false,
        by: 'test-admin',
        reason: 'unit test run',
      });

      // Verify RoomType was created
      const deluxeType = await RoomType.findOne({ name: 'Deluxe' });
      expect(deluxeType).not.toBeNull();
      expect(deluxeType.base_price).toBe(300000); // minimum price_per_night

      // Verify rooms updated with room_type_id
      const rooms = await Room.find({ room_type: 'Deluxe' });
      expect(rooms.every((r) => String(r.room_type_id) === String(deluxeType._id))).toBe(true);

      // Verify staff name_search was populated
      const staff = await Staff.findOne({ username: 'old_staff_member' });
      expect(staff.name_search).toBe('احمد ابراهيم');
      expect(staff.notification_prefs.system).toBe(true);

      // Verify payments payment_type populated
      const positivePayment = await Payment.collection.findOne({ amount: 50000 });
      expect(positivePayment.payment_type).toBe('payment');

      const negativePayment = await Payment.collection.findOne({ amount: -20000 });
      expect(negativePayment.payment_type).toBe('correction');

      // Verify settings were created
      const hotelSetting = await Setting.findOne({ key: 'hotel' });
      expect(hotelSetting).not.toBeNull();
      expect(hotelSetting.value.name).toBe('Al-Amin Hotel');

      const shiftsSetting = await Setting.findOne({ key: 'shifts' });
      expect(shiftsSetting).not.toBeNull();

      // Verify AuditLog entry was recorded
      const audit = await AuditLog.findOne({ action: 'MANAGER_MIGRATION' });
      expect(audit).not.toBeNull();
      expect(audit.details.by).toBe('test-admin');
    });

    test('idempotence: running migration a second time modifies 0 documents', async () => {
      const roomTypesBefore = await RoomType.countDocuments({});
      const settingsBefore = await Setting.countDocuments({});

      const result = await runManagerMigration({
        dry: false,
        by: 'test-admin-2',
        reason: 'second run verification',
      });

      expect(result.roomTypesCreated).toBe(0);
      expect(result.roomsUpdated).toBe(0);
      expect(result.staffUpdated).toBe(0);
      expect(result.paymentsUpdated).toBe(0);
      expect(result.hotelSettingCreated).toBe(false);
      expect(result.shiftsSettingCreated).toBe(false);

      const roomTypesAfter = await RoomType.countDocuments({});
      const settingsAfter = await Setting.countDocuments({});

      expect(roomTypesAfter).toBe(roomTypesBefore);
      expect(settingsAfter).toBe(settingsBefore);
    });
  });
});
