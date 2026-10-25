#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment: prioritize .env.admin if present, fallback to .env
const adminEnvPath = path.resolve(__dirname, '../.env.admin');
const defaultEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(adminEnvPath)) {
  dotenv.config({ path: adminEnvPath });
} else {
  dotenv.config({ path: defaultEnvPath });
}

const connectDB = require('../src/db/connect');
const {
  Room,
  RoomType,
  Staff,
  Payment,
  Shift,
  ShiftReport,
  CleaningTask,
  MaintenanceIssue,
  RoomStatusHistory,
  Setting,
  AuditLog,
} = require('../src/db/models');
const { normalizeArabic } = require('../src/utils/arabic');

async function runManagerMigration({ dry = false, by = 'system', reason = 'manager module' } = {}) {
  console.log(`Starting manager migration (dry-run: ${dry})...`);

  // (a) RoomType from existing values in Room.room_type
  const names = await Room.distinct('room_type');
  let roomTypesCreated = 0;
  let roomsUpdated = 0;

  for (const name of names) {
    const rooms = await Room.find({ room_type: name }).select('price_per_night').lean();
    const base = rooms.length ? Math.min(...rooms.map((r) => r.price_per_night)) : 10000;
    console.log('RoomType', name, 'rooms:', rooms.length, 'base_price(piastres):', base);
    if (!dry) {
      let rt = await RoomType.findOne({ name });
      if (!rt) {
        rt = await RoomType.create({ name, base_price: base, capacity: 2, amenities: [] });
        roomTypesCreated++;
      }
      const res = await Room.updateMany(
        { room_type: name, room_type_id: { $exists: false } },
        { $set: { room_type_id: rt._id } }
      );
      roomsUpdated += res.modifiedCount || 0;
    }
  }

  // (b) Staff: name_search and notification_prefs
  const staffMembers = await Staff.find({
    $or: [{ name_search: { $exists: false } }, { notification_prefs: { $exists: false } }],
  }).lean();
  let staffUpdated = 0;

  for (const s of staffMembers) {
    const updates = {};
    if (!s.name_search) updates.name_search = normalizeArabic(s.name);
    if (!s.notification_prefs || s.notification_prefs.system === undefined) {
      updates.notification_prefs = {
        approval_request: true,
        leave_request: true,
        critical_maintenance: true,
        critical_complaint: true,
        shift_report_submitted: true,
        system: true,
      };
    }
    if (Object.keys(updates).length > 0) {
      if (!dry) {
        await Staff.updateOne({ _id: s._id }, { $set: updates });
      }
      staffUpdated++;
    }
  }

  // (c) Payment.payment_type via raw collection to bypass append-only hooks
  const q1 = { payment_type: { $exists: false }, amount: { $lt: 0 } };
  const q2 = { payment_type: { $exists: false } };
  const corrCount = await Payment.collection.countDocuments(q1);
  const payCount = await Payment.collection.countDocuments(q2);

  console.log('payments -> correction:', corrCount);
  if (!dry && corrCount > 0) {
    await Payment.collection.updateMany(q1, { $set: { payment_type: 'correction' } });
  }

  console.log('payments -> payment:', payCount);
  if (!dry && payCount > 0) {
    await Payment.collection.updateMany(q2, { $set: { payment_type: 'payment' } });
  }

  // (d) Old ShiftReport
  const oldReports = await ShiftReport.find({ shift_date: { $exists: false } });
  let reportsUpdated = 0;

  for (const rep of oldReports) {
    const shift = await Shift.findById(rep.shift_id).populate('staff_id');
    if (!shift) continue;
    const staff = shift.staff_id;
    const payments = await Payment.find({ shift_id: shift._id });
    let cash = 0,
      instapay = 0,
      vodafone = 0,
      refunds = 0;

    for (const p of payments) {
      if (p.amount < 0) {
        refunds += Math.abs(p.amount);
      } else {
        if (p.payment_method === 'cash') cash += p.amount;
        else if (p.payment_method === 'instapay') instapay += p.amount;
        else if (p.payment_method === 'vodafone_cash') vodafone += p.amount;
      }
    }
    const gross = cash + instapay + vodafone;
    const net = gross - refunds;

    const [cleaningTasks, maintenanceTasks, statusHistories] = await Promise.all([
      CleaningTask.countDocuments({ shift_id: shift._id }),
      MaintenanceIssue.countDocuments({ shift_id: shift._id }),
      RoomStatusHistory.find({ shift_id: shift._id }).select('room_id'),
    ]);
    const roomSet = new Set(statusHistories.map((h) => String(h.room_id)));

    const update = {
      shift_date: shift.shift_date,
      shift_type: shift.shift_type,
      staff_id: staff ? staff._id : null,
      staff_name: staff ? staff.name : 'Unknown',
      handled_rooms: roomSet.size,
      tasks_cleaning: cleaningTasks,
      maintenance_requests: maintenanceTasks,
      pending_items: 0,
      cash_total: cash,
      instapay_total: instapay,
      vodafone_cash_total: vodafone,
      gross_revenue: gross,
      refunds_total: refunds,
      cancellation_retained_total: 0,
      net_revenue: net,
      review_status: 'PENDING_REVIEW',
    };

    if (!dry) {
      await ShiftReport.updateOne({ _id: rep._id }, { $set: update });
    }
    reportsUpdated++;
  }

  // (e) Settings
  const existingHotel = await Setting.findOne({ key: 'hotel' });
  let hotelSettingCreated = false;
  if (!existingHotel) {
    const rooms = await Room.find({}).select('floor');
    const maxFloor = rooms.reduce((max, r) => Math.max(max, r.floor || 1), 1);
    if (!dry) {
      await Setting.create({
        key: 'hotel',
        value: {
          name: 'Al-Amin Hotel',
          location: '',
          count_floors: maxFloor,
        },
      });
    }
    hotelSettingCreated = true;
  }

  const existingShifts = await Setting.findOne({ key: 'shifts' });
  let shiftsSettingCreated = false;
  if (!existingShifts) {
    if (!dry) {
      await Setting.create({
        key: 'shifts',
        value: {
          morning: { start: 7, end: 16 },
          evening: { start: 16, end: 23 },
          night: { start: 23, end: 7 },
        },
      });
    }
    shiftsSettingCreated = true;
  }

  // Final AuditLog entry
  if (!dry) {
    await AuditLog.create({
      action: 'MANAGER_MIGRATION',
      actorStaffId: null,
      ip: 'CLI',
      details: {
        by,
        reason,
        roomTypesCreated,
        roomsUpdated,
        staffUpdated,
        paymentsUpdated: corrCount + payCount,
        reportsUpdated,
        hotelSettingCreated,
        shiftsSettingCreated,
      },
      created_at: new Date(),
    });
  }

  console.log('Migration finished successfully.');
  return {
    roomTypesCreated,
    roomsUpdated,
    staffUpdated,
    paymentsUpdated: corrCount + payCount,
    reportsUpdated,
    hotelSettingCreated,
    shiftsSettingCreated,
  };
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const by = getArg('--by');
  const reason = getArg('--reason');

  if (!dry && (!by || !reason)) {
    console.error('Error: --by and --reason flags are required unless running with --dry-run.');
    process.exit(1);
  }

  connectDB()
    .then(() => runManagerMigration({ dry, by: by || 'CLI', reason: reason || 'CLI dry-run' }))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runManagerMigration };
