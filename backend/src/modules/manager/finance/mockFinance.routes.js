// Mock-only router for frontend design parity (expenses, hourly revenue, and aggregated reports)
const router = require('express').Router();
const { todayCairo } = require('../../../utils/time');

let mockExpenses = [
  {
    expense_id: 'EXP-108',
    description: 'شراء أدوات نظافة ومطهرات ومفروشات جديدة للغرف',
    category: 'CLEANING',
    amount: 1250.0,
    currency: 'EGP',
    recorded_by_staff_id: '6afa006fb922598cf366cfa6',
    recorded_by_staff_name: 'Hotel Manager',
    business_date: todayCairo(),
    created_at: `${todayCairo()}T12:10:00+02:00`,
    notes: 'منظفات ومفروشات للوردية',
    invoice_url: '/invoices/exp-108.pdf',
  },
  {
    expense_id: 'EXP-107',
    description: 'قطع غيار ولوازم سباكة لصيانة طابق 3',
    category: 'MAINTENANCE',
    amount: 950.0,
    currency: 'EGP',
    recorded_by_staff_id: '6afa006fb922598cf366cfa6',
    recorded_by_staff_name: 'Hotel Manager',
    business_date: todayCairo(),
    created_at: `${todayCairo()}T10:40:00+02:00`,
    notes: null,
    invoice_url: null,
  },
  {
    expense_id: 'EXP-106',
    description: 'سداد فاتورة مياه وكهرباء جزئية',
    category: 'UTILITIES',
    amount: 1100.0,
    currency: 'EGP',
    recorded_by_staff_id: '6afa006fb922598cf366cfa6',
    recorded_by_staff_name: 'Hotel Manager',
    business_date: todayCairo(),
    created_at: `${todayCairo()}T09:15:00+02:00`,
    notes: null,
    invoice_url: null,
  },
  {
    expense_id: 'EXP-105',
    description: 'شراء بطاريات ومصابيح طوارئ',
    category: 'EMERGENCY',
    amount: 550.0,
    currency: 'EGP',
    recorded_by_staff_id: '6afa006fb922598cf366cfa6',
    recorded_by_staff_name: 'Hotel Manager',
    business_date: todayCairo(),
    created_at: `${todayCairo()}T08:30:00+02:00`,
    notes: null,
    invoice_url: null,
  },
];

router.get('/expenses', (req, res) => {
  let list = [...mockExpenses];
  const { category, date, search, page = 1, limit = 20 } = req.query;

  if (category && category !== 'ALL') {
    list = list.filter((e) => e.category === category.toUpperCase());
  }
  if (date && date !== 'ALL') {
    list = list.filter((e) => e.business_date === date);
  }
  if (search) {
    const s = String(search).toLowerCase();
    list = list.filter(
      (e) =>
        e.expense_id.toLowerCase().includes(s) ||
        e.description.toLowerCase().includes(s) ||
        (e.notes && e.notes.toLowerCase().includes(s))
    );
  }

  const p = parseInt(page, 10) || 1;
  const lim = parseInt(limit, 10) || 20;
  const start = (p - 1) * lim;
  const paginated = list.slice(start, start + lim);

  res.json({
    data: paginated,
    meta: {
      page: p,
      limit: lim,
      total: list.length,
      total_pages: Math.max(1, Math.ceil(list.length / lim)),
    },
  });
});

router.patch('/expenses/:id', (req, res) => {
  const expense = mockExpenses.find((e) => e.expense_id === req.params.id);
  if (!expense) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'بند المصروفات غير موجود' } });
  }

  const { description, amount, category, notes } = req.body;
  if (description) expense.description = description;
  if (amount !== undefined) expense.amount = Number(amount);
  if (category) expense.category = category.toUpperCase();
  if (notes !== undefined) expense.notes = notes;

  res.json({ data: expense });
});

router.get('/finance/hourly-revenue', (req, res) => {
  res.json({
    data: {
      business_date: todayCairo(),
      hours: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
      points: [3200, 5850, 4100, 7200, 6100, 4800, 5200, 3900],
    },
  });
});

router.patch('/payments/:id/status', (req, res) => {
  res.json({
    data: {
      payment_id: req.params.id,
      status: req.body.status || 'COMPLETED',
      updated_at: new Date().toISOString(),
    },
  });
});

// ===================== AGGREGATED REPORTS =====================
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];
const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const BASE_MONTHLY_BARS = [
  { month: '01', month_name_ar: MONTH_NAMES_AR[0], month_name_en: MONTH_NAMES_EN[0], revenue: 18500, expenses: 3200, net_profit: 15300 },
  { month: '02', month_name_ar: MONTH_NAMES_AR[1], month_name_en: MONTH_NAMES_EN[1], revenue: 20400, expenses: 3400, net_profit: 17000 },
  { month: '03', month_name_ar: MONTH_NAMES_AR[2], month_name_en: MONTH_NAMES_EN[2], revenue: 24850, expenses: 3850, net_profit: 21000 },
  { month: '04', month_name_ar: MONTH_NAMES_AR[3], month_name_en: MONTH_NAMES_EN[3], revenue: 27200, expenses: 4100, net_profit: 23100 },
  { month: '05', month_name_ar: MONTH_NAMES_AR[4], month_name_en: MONTH_NAMES_EN[4], revenue: 31500, expenses: 4600, net_profit: 26900 },
  { month: '06', month_name_ar: MONTH_NAMES_AR[5], month_name_en: MONTH_NAMES_EN[5], revenue: 35200, expenses: 5100, net_profit: 30100 },
  { month: '07', month_name_ar: MONTH_NAMES_AR[6], month_name_en: MONTH_NAMES_EN[6], revenue: 38900, expenses: 5400, net_profit: 33500 },
  { month: '08', month_name_ar: MONTH_NAMES_AR[7], month_name_en: MONTH_NAMES_EN[7], revenue: 42600, expenses: 5800, net_profit: 36800 },
  { month: '09', month_name_ar: MONTH_NAMES_AR[8], month_name_en: MONTH_NAMES_EN[8], revenue: 40100, expenses: 5500, net_profit: 34600 },
  { month: '10', month_name_ar: MONTH_NAMES_AR[9], month_name_en: MONTH_NAMES_EN[9], revenue: 36400, expenses: 5000, net_profit: 31400 },
  { month: '11', month_name_ar: MONTH_NAMES_AR[10], month_name_en: MONTH_NAMES_EN[10], revenue: 32800, expenses: 4700, net_profit: 28100 },
  { month: '12', month_name_ar: MONTH_NAMES_AR[11], month_name_en: MONTH_NAMES_EN[11], revenue: 38000, expenses: 5200, net_profit: 32800 },
];

router.get('/reports/aggregated', (req, res) => {
  const {
    period = 'daily',
    date = todayCairo(),
    floor,
    room_type,
    shift,
    payment_method,
    expense_category,
  } = req.query;

  let periodMultiplier = 1;
  let yearlyRevenueSum = 0;
  let yearlyExpensesSum = 0;
  for (const b of BASE_MONTHLY_BARS) {
    yearlyRevenueSum += b.revenue;
    yearlyExpensesSum += b.expenses;
  }

  if (period === 'weekly') {
    periodMultiplier = 7;
  } else if (period === 'monthly') {
    periodMultiplier = 30;
  } else if (period === 'yearly') {
    periodMultiplier = yearlyRevenueSum / 24850;
  }

  let filterFactor = 1.0;
  if (floor && floor !== 'ALL') filterFactor *= 0.35;
  if (room_type && room_type !== 'ALL') filterFactor *= room_type.toLowerCase() === 'vip' ? 0.58 : 0.42;
  if (shift && shift !== 'ALL') filterFactor *= 0.45;
  if (payment_method && payment_method !== 'ALL') filterFactor *= 0.5;
  if (expense_category && expense_category !== 'ALL') filterFactor *= 0.4;

  const effectiveMultiplier = periodMultiplier * filterFactor;
  const baseRevenue = 24850;
  const baseExpenses = 3850;
  const baseTxCount = 18;
  const baseTasksCount = 9;

  let revenue = Math.round(baseRevenue * effectiveMultiplier);
  let expenses = Math.round(baseExpenses * effectiveMultiplier);
  if (period === 'yearly' && filterFactor === 1.0) {
    revenue = yearlyRevenueSum;
    expenses = yearlyExpensesSum;
  }

  const net_profit = revenue - expenses;
  const margin_percentage = revenue > 0 ? Number(((net_profit / revenue) * 100).toFixed(1)) : 84.5;
  const transactions_count = Math.max(1, Math.round(baseTxCount * effectiveMultiplier));
  const completed_tasks_count = Math.max(1, Math.round(baseTasksCount * effectiveMultiplier));

  const total_rooms = 36;
  const occupied_rooms = Math.min(36, Math.max(1, Math.round(23 * Math.min(1.2, Math.max(0.6, filterFactor)))));
  const occupancy_rate = Math.round((occupied_rooms / total_rooms) * 100);

  let cashAmount = Math.round(revenue * 0.42);
  let instapayAmount = Math.round(revenue * 0.34);
  let vodafoneAmount = revenue - cashAmount - instapayAmount;

  if (payment_method && payment_method !== 'ALL') {
    const pm = payment_method.toUpperCase();
    if (pm === 'CASH') {
      cashAmount = revenue;
      instapayAmount = 0;
      vodafoneAmount = 0;
    } else if (pm === 'INSTAPAY') {
      cashAmount = 0;
      instapayAmount = revenue;
      vodafoneAmount = 0;
    } else if (pm.includes('VODAFONE')) {
      cashAmount = 0;
      instapayAmount = 0;
      vodafoneAmount = revenue;
    }
  }

  const baseCatCleaning = Math.round(expenses * (1250 / 3850));
  const baseCatUtilities = Math.round(expenses * (1200 / 3850));
  const baseCatMaintenance = Math.round(expenses * (950 / 3850));
  const baseCatEmergency = expenses - baseCatCleaning - baseCatUtilities - baseCatMaintenance;

  const expense_categories = [
    { category: 'cleaning', category_label_ar: 'مستلزمات تنظيف', category_label_en: 'Cleaning Supplies', amount: baseCatCleaning },
    { category: 'utilities', category_label_ar: 'كهرباء ومياه', category_label_en: 'Utilities', amount: baseCatUtilities },
    { category: 'maintenance', category_label_ar: 'مستلزمات صيانة', category_label_en: 'Maintenance Supplies', amount: baseCatMaintenance },
    { category: 'emergency', category_label_ar: 'أخرى', category_label_en: 'Other', amount: baseCatEmergency },
  ];

  const monthly_bars = BASE_MONTHLY_BARS.map((bar) => {
    const barRev = Math.round(bar.revenue * filterFactor);
    const barExp = Math.round(bar.expenses * filterFactor);
    return {
      month: bar.month,
      month_name_ar: bar.month_name_ar,
      month_name_en: bar.month_name_en,
      revenue: barRev,
      expenses: barExp,
      net_profit: barRev - barExp,
    };
  });

  const vipRevBase = period === 'daily' ? 398000 : Math.round(398000 * (periodMultiplier / 1.0));
  const standardRevBase = period === 'daily' ? 286000 : Math.round(286000 * (periodMultiplier / 1.0));

  const rooms_performance = {
    vip: {
      rooms_count: 15,
      occupancy_rate: 76,
      revenue: Math.round(vipRevBase * filterFactor),
    },
    standard: {
      rooms_count: 21,
      occupancy_rate: 67,
      revenue: Math.round(standardRevBase * filterFactor),
    },
  };

  res.json({
    data: {
      period,
      date,
      revenue,
      revenue_change_percentage: 12.4,
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
      rooms_performance,
    },
  });
});

module.exports = router;
