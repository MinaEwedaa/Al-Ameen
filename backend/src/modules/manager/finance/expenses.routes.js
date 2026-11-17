const router = require('express').Router();
const { Expense } = require('../../../db/models');
const { todayCairo } = require('../../../utils/time');

router.get('/', async (req, res, next) => {
  try {
    const { category, date, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (category && category !== 'ALL') {
      query.category = category.toUpperCase();
    }
    if (date && date !== 'ALL') {
      query.business_date = date;
    }
    if (search) {
      const s = String(search).trim();
      query.$or = [
        { expense_id: new RegExp(s, 'i') },
        { description: new RegExp(s, 'i') },
        { notes: new RegExp(s, 'i') },
      ];
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .sort({ createdAt: -1 })
      .skip((p - 1) * lim)
      .limit(lim)
      .lean();

    res.json({
      data: expenses,
      meta: {
        page: p,
        limit: lim,
        total,
        total_pages: Math.max(1, Math.ceil(total / lim)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { description, category, amount, notes, invoice_url } = req.body;
    const count = await Expense.countDocuments();
    const expense_id = `EXP-${String(count + 1).padStart(3, '0')}`;

    const created = await Expense.create({
      expense_id,
      description: description || 'Operational expense',
      category: category ? category.toUpperCase() : 'CLEANING',
      amount: Number(amount) || 0,
      recorded_by_staff_id: req.auth?.staff?._id || null,
      recorded_by_staff_name: req.auth?.staff?.name || 'Hotel Staff',
      business_date: todayCairo(),
      notes: notes || null,
      invoice_url: invoice_url || null,
    });

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = {};
    const { description, amount, category, notes, invoice_url } = req.body;

    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = Number(amount);
    if (category !== undefined) updates.category = category.toUpperCase();
    if (notes !== undefined) updates.notes = notes;
    if (invoice_url !== undefined) updates.invoice_url = invoice_url;

    const updated = await Expense.findOneAndUpdate(
      { $or: [{ expense_id: id }, { _id: id }] },
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'بند المصروفات غير موجود' } });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

