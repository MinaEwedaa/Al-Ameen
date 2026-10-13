const mongoose = require('mongoose');
const { Room, MaintenanceIssue, Payment } = require('../../db/models');
const { toEgp } = require('../../utils/money');
const { deriveStatuses } = require('../rooms/room.service');

async function getDashboard(authSession, now) {
  const rooms = await Room.find({}).select('status').lean();
  const statusMap = await deriveStatuses(rooms, now);

  const roomsByStatus = { available: 0, reserved: 0, occupied: 0, cleaning: 0, maintenance: 0 };
  for (const s of statusMap.values()) roomsByStatus[s] += 1;

  // الأعطال المفتوحة من كل الورديات
  const openIssues = await MaintenanceIssue.countDocuments({ status: { $ne: 'resolved' } });

  // دفعات الوردية الحالية بس (أصفار لو الجلسة قراءة فقط)
  const totals = { cash: 0, instapay: 0, vodafone_cash: 0 };
  const shiftId = authSession && authSession.shift_id;
  if (shiftId) {
    const rows = await Payment.aggregate([
      { $match: { shift_id: new mongoose.Types.ObjectId(String(shiftId)) } },
      { $group: { _id: '$payment_method', total: { $sum: '$amount' } } },
    ]);
    for (const r of rows) {
      if (Object.hasOwn(totals, r._id)) totals[r._id] = r.total;
    }
  }

  return {
    total_rooms: rooms.length,
    rooms_by_status: roomsByStatus,
    rooms_needing_cleaning: roomsByStatus.cleaning,
    open_maintenance_issues: openIssues,
    shift_payments_total: {
      cash: toEgp(totals.cash),
      instapay: toEgp(totals.instapay),
      vodafone_cash: toEgp(totals.vodafone_cash),
      total: toEgp(totals.cash + totals.instapay + totals.vodafone_cash),
    },
  };
}

module.exports = { getDashboard };