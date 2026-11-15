// Mock-only router for frontend design parity (expenses and hourly revenue)
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

module.exports = router;
