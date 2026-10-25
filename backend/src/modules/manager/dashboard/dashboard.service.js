// Manager Dashboard Service
// Computes real-time KPIs, revenue series, and operational issues

const { DateTime } = require('luxon');
const {
  Room,
  Reservation,
  Payment,
  CleaningTask,
  MaintenanceIssue,
} = require('../../../db/models');
const { ZONE, cairoDate } = require('../../../utils/time');
const { toEgp } = require('../../../utils/money');

/**
 * 1. GET /manager/dashboard/overview
 */
async function getOverview() {
  const todayStr = cairoDate();

  const [rooms, cleaningTasksCount, maintenanceIssuesCount, payments] = await Promise.all([
    Room.find().populate('room_type_id', 'name').lean(),
    CleaningTask.countDocuments({ status: 'pending' }),
    MaintenanceIssue.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    Payment.find({
      payment_datetime: {
        $gte: DateTime.now().setZone(ZONE).minus({ days: 2 }).startOf('day').toJSDate(),
      },
    }).lean(),
  ]);

  const totalRooms = rooms.length;
  let occupiedRooms = 0;
  let availableRooms = 0;
  let cleaningRooms = 0;
  let maintenanceRooms = 0;
  let standardRooms = 0;
  let vipRooms = 0;

  const floorMap = new Map(); // floor -> { total, occupied, standard, vip }

  for (const r of rooms) {
    const isVip = (r.room_type || '').toLowerCase().includes('vip') ||
                  (r.room_type_id?.name || '').toLowerCase().includes('vip');
    if (isVip) vipRooms++;
    else standardRooms++;

    const floor = r.floor || 1;
    if (!floorMap.has(floor)) {
      floorMap.set(floor, { floor, total: 0, occupied: 0, standard_count: 0, vip_count: 0 });
    }
    const fData = floorMap.get(floor);
    fData.total++;
    if (isVip) fData.vip_count++;
    else fData.standard_count++;

    if (r.status === 'occupied') {
      occupiedRooms++;
      fData.occupied++;
    } else if (r.status === 'available') {
      availableRooms++;
    } else if (r.status === 'cleaning') {
      cleaningRooms++;
    } else if (r.status === 'maintenance' || r.status === 'out_of_service') {
      maintenanceRooms++;
    }
  }

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Floors occupancy array
  const floorsOccupancy = Array.from(floorMap.values())
    .sort((a, b) => a.floor - b.floor)
    .map((f) => ({
      floor: f.floor,
      total: f.total,
      occupied: f.occupied,
      standard_count: f.standard_count,
      vip_count: f.vip_count,
      occupancy_pct: f.total > 0 ? Math.round((f.occupied / f.total) * 100) : 0,
    }));

  // Revenue today & yesterday calculation
  const yesterdayStr = DateTime.now().setZone(ZONE).minus({ days: 1 }).toFormat('yyyy-MM-dd');
  let todayPiastres = 0;
  let yesterdayPiastres = 0;

  for (const p of payments) {
    const pDate = cairoDate(p.payment_datetime);
    const amt = p.amount || 0;
    if (pDate === todayStr) {
      todayPiastres += amt;
    } else if (pDate === yesterdayStr) {
      yesterdayPiastres += amt;
    }
  }

  const todayRevenue = toEgp(Math.max(0, todayPiastres));
  const yesterdayRevenue = toEgp(Math.max(0, yesterdayPiastres));

  let todayRevenueChangePct = 0;
  if (yesterdayRevenue > 0) {
    todayRevenueChangePct = Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1));
  } else if (todayRevenue > 0) {
    todayRevenueChangePct = 100;
  }

  const pendingTasks = cleaningTasksCount + maintenanceIssuesCount;

  return {
    kpis: {
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      available_rooms: availableRooms,
      cleaning_rooms: cleaningRooms,
      maintenance_rooms: maintenanceRooms,
      occupancy_rate: occupancyRate,
      today_revenue: todayRevenue,
      today_revenue_change_pct: todayRevenueChangePct,
      pending_tasks: pendingTasks,
    },
    room_counts: {
      total: totalRooms,
      standard: standardRooms,
      vip: vipRooms,
      occupied: occupiedRooms,
      available: availableRooms,
      reserved: 0,
      cleaning: cleaningRooms,
      maintenance: maintenanceRooms,
    },
    floors_occupancy: floorsOccupancy,
  };
}

/**
 * 2. GET /manager/dashboard/revenue?days=7
 */
async function getRevenue(days = 7) {
  const numDays = Math.min(30, Math.max(1, Number(days) || 7));
  const nowCairo = DateTime.now().setZone(ZONE);
  const startDate = nowCairo.minus({ days: numDays - 1 }).startOf('day');
  const startOfYear = nowCairo.startOf('year');
  const startOfMonth = nowCairo.startOf('month');
  const startOfWeek = nowCairo.minus({ days: 6 }).startOf('day');

  // Query all payments from start of year to compute totals
  const payments = await Payment.find({
    payment_datetime: { $gte: startOfYear.toJSDate() },
  }).lean();

  const todayStr = cairoDate();
  const yesterdayStr = nowCairo.minus({ days: 1 }).toFormat('yyyy-MM-dd');

  let todayPiastres = 0;
  let yesterdayPiastres = 0;
  let weekPiastres = 0;
  let monthPiastres = 0;
  let yearPiastres = 0;

  // Series map for requested days
  const seriesMap = new Map();
  for (let i = numDays - 1; i >= 0; i--) {
    const dStr = nowCairo.minus({ days: i }).toFormat('yyyy-MM-dd');
    seriesMap.set(dStr, 0);
  }

  // Method totals (for the period)
  const methodMap = {
    CASH: 0,
    INSTAPAY: 0,
    VODAFONE_CASH: 0,
    CARD: 0,
  };

  const startPeriodJs = startDate.toJSDate();

  for (const p of payments) {
    const amt = p.amount || 0;
    const pDateStr = cairoDate(p.payment_datetime);
    const pTime = p.payment_datetime.getTime();

    yearPiastres += amt;
    if (pTime >= startOfMonth.toMillis()) monthPiastres += amt;
    if (pTime >= startOfWeek.toMillis()) weekPiastres += amt;

    if (pDateStr === todayStr) todayPiastres += amt;
    if (pDateStr === yesterdayStr) yesterdayPiastres += amt;

    if (seriesMap.has(pDateStr)) {
      seriesMap.set(pDateStr, seriesMap.get(pDateStr) + amt);
    }

    if (pTime >= startPeriodJs.getTime()) {
      const m = (p.payment_method || 'cash').toUpperCase();
      if (m.includes('INSTA')) methodMap.INSTAPAY += amt;
      else if (m.includes('VODA')) methodMap.VODAFONE_CASH += amt;
      else if (m.includes('CARD')) methodMap.CARD += amt;
      else methodMap.CASH += amt;
    }
  }

  const todayRevenue = toEgp(Math.max(0, todayPiastres));
  const yesterdayRevenue = toEgp(Math.max(0, yesterdayPiastres));
  const weekRevenue = toEgp(Math.max(0, weekPiastres));
  const monthRevenue = toEgp(Math.max(0, monthPiastres));
  const yearRevenue = toEgp(Math.max(0, yearPiastres));

  let changePct = 0;
  if (yesterdayRevenue > 0) {
    changePct = Number((((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1));
  } else if (todayRevenue > 0) {
    changePct = 100;
  }

  const series = Array.from(seriesMap.entries()).map(([business_date, piastres]) => ({
    business_date,
    date: business_date,
    net_revenue: toEgp(Math.max(0, piastres)),
    revenue: toEgp(Math.max(0, piastres)),
  }));

  const periodTotalPiastres = Object.values(methodMap).reduce((a, b) => a + b, 0);
  const byMethod = Object.entries(methodMap).map(([method, piastres]) => {
    const amtEgp = toEgp(piastres);
    const share = periodTotalPiastres > 0 ? Math.round((piastres / periodTotalPiastres) * 100) : 0;
    return {
      method,
      amount: amtEgp,
      share_pct: share,
      percentage: share,
    };
  });

  return {
    totals: {
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue,
      year: yearRevenue,
    },
    change_pct_vs_previous_day: changePct,
    comparison_percentage: changePct,
    today_revenue: todayRevenue,
    week_total: weekRevenue,
    month_total: monthRevenue,
    year_total: yearRevenue,
    series,
    chart_series: series,
    by_method: byMethod,
    payment_methods: byMethod,
  };
}

/**
 * 3. GET /manager/dashboard/issues?limit=4
 */
async function getIssues(limit = 4) {
  const l = Math.min(20, Math.max(1, Number(limit) || 4));

  const [maintenance, cleaning] = await Promise.all([
    MaintenanceIssue.find({ status: { $in: ['open', 'in_progress'] } })
      .populate('room_id', 'room_number')
      .sort({ createdAt: -1 })
      .limit(l)
      .lean(),
    CleaningTask.find({ status: 'pending' })
      .populate('room_id', 'room_number')
      .sort({ createdAt: -1 })
      .limit(l)
      .lean(),
  ]);

  const issues = [];

  for (const m of maintenance) {
    const priorityMap = {
      urgent: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
    };
    const sev = priorityMap[m.priority] || 'MEDIUM';
    const roomNum = m.room_id?.room_number || 'عام';
    issues.push({
      issue_id: String(m._id),
      id: String(m._id),
      title: `عطل صيانة غرفة ${roomNum}`,
      type: 'MAINTENANCE',
      issue_type: 'maintenance',
      severity: sev,
      priority: sev.toLowerCase(),
      room_number: roomNum,
      description: m.problem || m.notes || 'طلب صيانة مطلوب معالجته',
      created_at: (m.createdAt || m.created_at || new Date()).toISOString(),
      reported_at: (m.createdAt || m.created_at || new Date()).toISOString(),
    });
  }

  for (const c of cleaning) {
    const priorityMap = {
      urgent: 'CRITICAL',
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
    };
    const sev = priorityMap[c.priority] || 'MEDIUM';
    const roomNum = c.room_id?.room_number || 'عام';
    issues.push({
      issue_id: String(c._id),
      id: String(c._id),
      title: `مهمة تنظيف غرفة ${roomNum}`,
      type: 'HOUSEKEEPING',
      issue_type: 'housekeeping',
      severity: sev,
      priority: sev.toLowerCase(),
      room_number: roomNum,
      description: c.notes || `أولوية التنظيف: ${c.priority || 'عادية'}`,
      created_at: (c.createdAt || c.assigned_at || new Date()).toISOString(),
      reported_at: (c.createdAt || c.assigned_at || new Date()).toISOString(),
    });
  }

  // Sort by priority/severity then date
  const severityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  issues.sort((a, b) => {
    const wDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    if (wDiff !== 0) return wDiff;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return issues.slice(0, l);
}

module.exports = {
  getOverview,
  getRevenue,
  getIssues,
};
