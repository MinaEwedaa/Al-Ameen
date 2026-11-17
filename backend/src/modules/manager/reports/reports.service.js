const { DateTime } = require('luxon');
const {
  Payment,
  Reservation,
  Room,
  CleaningTask,
  Expense,
  Shift,
} = require('../../../db/models');
const { ZONE, todayCairo } = require('../../../utils/time');
const { toEgp } = require('../../../utils/money');

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function resolveRange({ period = 'daily', date, start_date, end_date }) {
  const baseDate = date || todayCairo();
  const dt = DateTime.fromISO(baseDate, { zone: ZONE });

  if (start_date && end_date) {
    const s = DateTime.fromISO(start_date, { zone: ZONE }).startOf('day');
    const e = DateTime.fromISO(end_date, { zone: ZONE }).endOf('day');
    return {
      rangeStart: s.toJSDate(),
      rangeEnd: e.toJSDate(),
      durationMs: e.diff(s).milliseconds,
    };
  }

  let s, e;
  if (period === 'weekly') {
    e = dt.endOf('day');
    s = dt.minus({ days: 6 }).startOf('day');
  } else if (period === 'monthly') {
    s = dt.startOf('month');
    e = dt.endOf('month');
  } else if (period === 'yearly') {
    s = dt.startOf('year');
    e = dt.endOf('year');
  } else {
    // daily
    s = dt.startOf('day');
    e = dt.endOf('day');
  }

  return {
    rangeStart: s.toJSDate(),
    rangeEnd: e.toJSDate(),
    durationMs: e.diff(s).milliseconds,
  };
}

async function getAggregatedReport({
  period = 'daily',
  date,
  floor,
  room_type,
  shift,
  room_status,
  payment_method,
  expense_category,
  start_date,
  end_date,
}) {
  const currentDate = date || todayCairo();
  const { rangeStart, rangeEnd, durationMs } = resolveRange({
    period,
    date: currentDate,
    start_date,
    end_date,
  });

  // 1. Build payment match query
  const paymentMatch = {
    payment_datetime: { $gte: rangeStart, $lte: rangeEnd },
  };

  if (payment_method && payment_method !== 'ALL') {
    paymentMatch.payment_method = payment_method.toLowerCase();
  }

  // Filter payments by shift if requested
  if (shift && shift !== 'ALL') {
    const shifts = await Shift.find({ shift_type: shift.toLowerCase() }).select('_id').lean();
    paymentMatch.shift_id = { $in: shifts.map((s) => s._id) };
  }

  // Filter payments by room criteria (floor, room_type)
  const roomFilter = {};
  if (floor && floor !== 'ALL') roomFilter.floor = Number(floor);
  if (room_type && room_type !== 'ALL') roomFilter.room_type = new RegExp(room_type, 'i');
  if (room_status && room_status !== 'ALL') roomFilter.status = room_status.toLowerCase();

  let targetReservationIds = null;
  if (Object.keys(roomFilter).length > 0) {
    const matchingRooms = await Room.find(roomFilter).select('_id').lean();
    const matchingReservations = await Reservation.find({
      room_id: { $in: matchingRooms.map((r) => r._id) },
    }).select('_id').lean();
    targetReservationIds = matchingReservations.map((r) => r._id);
    paymentMatch.reservation_id = { $in: targetReservationIds };
  }

  // 2. Fetch real payments from database
  const payments = await Payment.find(paymentMatch).lean();

  let revenue = 0;
  let cashAmount = 0;
  let instapayAmount = 0;
  let vodafoneAmount = 0;

  for (const p of payments) {
    const egp = toEgp(p.amount);
    revenue += egp;

    const pm = (p.payment_method || '').toLowerCase();
    if (pm === 'cash') cashAmount += egp;
    else if (pm === 'instapay') instapayAmount += egp;
    else if (pm.includes('vodafone')) vodafoneAmount += egp;
  }

  // Floor amounts to whole EGP
  revenue = Math.max(0, Math.round(revenue));
  cashAmount = Math.max(0, Math.round(cashAmount));
  instapayAmount = Math.max(0, Math.round(instapayAmount));
  vodafoneAmount = Math.max(0, Math.round(vodafoneAmount));
  const transactions_count = payments.length;

  // 3. Compute previous period revenue for change percentage
  const prevEnd = new Date(rangeStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  const prevPayments = await Payment.find({
    payment_datetime: { $gte: prevStart, $lte: prevEnd },
    ...(paymentMatch.payment_method ? { payment_method: paymentMatch.payment_method } : {}),
    ...(targetReservationIds ? { reservation_id: { $in: targetReservationIds } } : {}),
  }).lean();

  const prevRevenue = prevPayments.reduce((acc, p) => acc + toEgp(p.amount), 0);
  let revenue_change_percentage = 0;
  if (prevRevenue > 0) {
    revenue_change_percentage = Number((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1));
  } else if (revenue > 0) {
    revenue_change_percentage = 100;
  }

  // 4. Query real rooms for occupancy
  const roomCountFilter = {};
  if (floor && floor !== 'ALL') roomCountFilter.floor = Number(floor);
  if (room_type && room_type !== 'ALL') roomCountFilter.room_type = new RegExp(room_type, 'i');

  const total_rooms = await Room.countDocuments(roomCountFilter);
  const occupied_rooms = await Room.countDocuments({
    ...roomCountFilter,
    status: 'occupied',
  });
  const occupancy_rate = total_rooms > 0 ? Math.round((occupied_rooms / total_rooms) * 100) : 0;

  // 5. Rooms Performance (VIP vs Standard)
  const vipRooms = await Room.find({ room_type: /vip/i }).select('_id status').lean();
  const vipTotal = vipRooms.length;
  const vipOccupied = vipRooms.filter((r) => r.status === 'occupied').length;
  const vipOccupancyRate = vipTotal > 0 ? Math.round((vipOccupied / vipTotal) * 100) : 0;

  const stdRooms = await Room.find({ room_type: { $not: /vip/i } }).select('_id status').lean();
  const stdTotal = stdRooms.length;
  const stdOccupied = stdRooms.filter((r) => r.status === 'occupied').length;
  const stdOccupancyRate = stdTotal > 0 ? Math.round((stdOccupied / stdTotal) * 100) : 0;

  // Calculate real revenue split between VIP and Standard rooms in this period
  const vipReservations = await Reservation.find({ room_id: { $in: vipRooms.map((r) => r._id) } }).select('_id').lean();
  const vipResIds = new Set(vipReservations.map((r) => String(r._id)));
  let vipRevenue = 0;
  let standardRevenue = 0;
  for (const p of payments) {
    const egp = toEgp(p.amount);
    if (p.reservation_id && vipResIds.has(String(p.reservation_id))) {
      vipRevenue += egp;
    } else {
      standardRevenue += egp;
    }
  }

  // 6. Real Completed Tasks
  const completed_tasks_count = await CleaningTask.countDocuments({
    status: { $in: ['completed', 'inspected'] },
    updatedAt: { $gte: rangeStart, $lte: rangeEnd },
  });

  // 7. Real Operational Expenses from Expense model
  const expenseFilter = {
    business_date: {
      $gte: DateTime.fromJSDate(rangeStart, { zone: ZONE }).toISODate(),
      $lte: DateTime.fromJSDate(rangeEnd, { zone: ZONE }).toISODate(),
    },
  };
  if (expense_category && expense_category !== 'ALL') {
    expenseFilter.category = expense_category.toUpperCase();
  }

  const expensesDocs = await Expense.find(expenseFilter).lean();
  const expenses = expensesDocs.reduce((sum, e) => sum + (e.amount || 0), 0);
  const net_profit = revenue - expenses;
  const margin_percentage = revenue > 0 ? Number(((net_profit / revenue) * 100).toFixed(1)) : 0;

  // Expense categories shares
  const catCleaning = expensesDocs.filter((e) => e.category === 'CLEANING').reduce((s, e) => s + e.amount, 0);
  const catUtilities = expensesDocs.filter((e) => e.category === 'UTILITIES').reduce((s, e) => s + e.amount, 0);
  const catMaintenance = expensesDocs.filter((e) => e.category === 'MAINTENANCE').reduce((s, e) => s + e.amount, 0);
  const catEmergency = expensesDocs.filter((e) => e.category === 'EMERGENCY').reduce((s, e) => s + e.amount, 0);

  const expense_categories = [
    { category: 'cleaning', category_label_ar: 'مستلزمات تنظيف', category_label_en: 'Cleaning Supplies', amount: catCleaning },
    { category: 'utilities', category_label_ar: 'كهرباء ومياه', category_label_en: 'Utilities', amount: catUtilities },
    { category: 'maintenance', category_label_ar: 'مستلزمات صيانة', category_label_en: 'Maintenance Supplies', amount: catMaintenance },
    { category: 'emergency', category_label_ar: 'أخرى', category_label_en: 'Other', amount: catEmergency },
  ];

  // 8. 12 Monthly Bars for Current Year (real database aggregation)
  const cairoEnd = DateTime.fromJSDate(rangeEnd, { zone: ZONE });
  const yearStart = cairoEnd.startOf('year').toJSDate();
  const yearEnd = cairoEnd.endOf('year').toJSDate();

  const monthlyPaymentsAgg = await Payment.aggregate([
    { $match: { payment_datetime: { $gte: yearStart, $lte: yearEnd } } },
    {
      $group: {
        _id: { $month: { date: '$payment_datetime', timezone: '+02:00' } },
        total_amount: { $sum: '$amount' },
      },
    },
  ]);

  const monthlyExpensesAgg = await Expense.aggregate([
    {
      $match: {
        business_date: {
          $gte: cairoEnd.startOf('year').toISODate(),
          $lte: cairoEnd.endOf('year').toISODate(),
        },
      },
    },
    {
      $group: {
        _id: { $substr: ['$business_date', 5, 2] },
        total_amount: { $sum: '$amount' },
      },
    },
  ]);

  const monthly_bars = [];
  for (let m = 1; m <= 12; m++) {
    const payMatch = monthlyPaymentsAgg.find((item) => item._id === m);
    const expKey = String(m).padStart(2, '0');
    const expMatch = monthlyExpensesAgg.find((item) => item._id === expKey);

    const mRevenue = payMatch ? Math.round(payMatch.total_amount / 100) : 0;
    const mExpenses = expMatch ? Math.round(expMatch.total_amount) : 0;

    monthly_bars.push({
      month: expKey,
      month_name_ar: MONTH_NAMES_AR[m - 1],
      month_name_en: MONTH_NAMES_EN[m - 1],
      revenue: mRevenue,
      expenses: mExpenses,
      net_profit: mRevenue - mExpenses,
    });
  }

  return {
    period,
    date: currentDate,
    revenue,
    revenue_change_percentage,
    expenses,
    net_profit,
    margin_percentage,
    occupancy_rate,
    occupied_rooms,
    total_rooms,
    transactions_count,
    completed_tasks_count,
    payment_methods: {
      cash: cashAmount,
      instapay: instapayAmount,
      vodafone_cash: vodafoneAmount,
    },
    monthly_bars,
    expense_categories,
    rooms_performance: {
      vip: {
        rooms_count: vipTotal,
        occupancy_rate: vipOccupancyRate,
        revenue: Math.round(vipRevenue),
      },
      standard: {
        rooms_count: stdTotal,
        occupancy_rate: stdOccupancyRate,
        revenue: Math.round(standardRevenue),
      },
    },
  };
}

module.exports = {
  getAggregatedReport,
};

