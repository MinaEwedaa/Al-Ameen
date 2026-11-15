// Manager Finance Service (M10): daily closing and the payments ledger
const mongoose = require('mongoose');
const {
  DailyClosing, Shift, ShiftReport, ApprovalRequest, Payment, Staff,
} = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { toEgp, toPiastres } = require('../../../utils/money');
const { sanitizeText } = require('../../../utils/arabic');
const { runInTransaction } = require('../../../utils/transaction');
const { todayCairo, ZONE } = require('../../../utils/time');
const { audit } = require('../../audit/audit.service');
const { AUDIT } = require('../../audit/audit.actions');
const { financialsForShifts } = require('../common/finance');
const { DateTime } = require('luxon');

const T = mongoose.trusted;
const iso = (d) => (d ? new Date(d).toISOString() : null);
const idOrNull = (v) => (v ? String(v) : null);

// finance.js returns EGP, so the day numbers are EGP here
async function dayFinancials(businessDate, session) {
  const shifts = await Shift.find({ shift_date: businessDate })
    .select('_id status')
    .session(session || null)
    .lean();
  const f = await financialsForShifts(shifts.map((s) => s._id), session);
  return {
    ...f,
    revenue_total: f.net_revenue,
    active_shifts: shifts.filter((s) => s.status === 'active').length,
    shift_ids: shifts.map((s) => s._id),
  };
}

async function blockersFor(day, fin, session) {
  const [pending_approvals, unreviewed_reports] = await Promise.all([
    ApprovalRequest.countDocuments({ status: 'PENDING' }).session(session || null),
    ShiftReport.countDocuments({
      shift_id: T({ $in: fin.shift_ids }),
      review_status: 'PENDING_REVIEW',
    }).session(session || null),
  ]);
  return { pending_approvals, unreviewed_reports, active_shifts: fin.active_shifts };
}

const totalsDto = (f) => ({
  cash_total: f.cash_total,
  instapay_total: f.instapay_total,
  vodafone_cash_total: f.vodafone_cash_total,
  gross_revenue: f.gross_revenue,
  refunds_total: f.refunds_total,
  total_revenue: f.revenue_total,
});

// Stored closing numbers are piastres, so they go through toEgp
const closingDto = (c) => ({
  closing_id: String(c._id),
  business_date: c.business_date,
  status: c.status,
  opened_at: iso(c.opened_at),
  opened_by_staff_id: idOrNull(c.opened_by_staff_id),
  closed_at: iso(c.closed_at),
  closed_by_staff_id: idOrNull(c.closed_by_staff_id),
  cash_total: toEgp(c.cash_total || 0),
  instapay_total: toEgp(c.instapay_total || 0),
  vodafone_cash_total: toEgp(c.vodafone_cash_total || 0),
  gross_revenue: toEgp(c.gross_revenue || 0),
  refunds_total: toEgp(c.refunds_total || 0),
  total_revenue: toEgp(c.revenue_total || 0),
  notes: c.notes ?? null,
});

async function getCurrent() {
  const day = await DailyClosing.findOne({ status: 'OPEN' }).lean();
  if (!day) return null;

  const fin = await dayFinancials(day.business_date);
  const blockers = await blockersFor(day, fin);
  const can_close =
    blockers.pending_approvals === 0 &&
    blockers.unreviewed_reports === 0 &&
    blockers.active_shifts === 0;

  return {
    closing_id: String(day._id),
    business_date: day.business_date,
    status: day.status,
    opened_at: iso(day.opened_at),
    opened_by_staff_id: idOrNull(day.opened_by_staff_id),
    closed_at: iso(day.closed_at) || null,
    transactions_count: fin.transactions_count || 0,
    ...totalsDto(fin),
    blockers,
    can_close,
  };
}

async function openDay(body, actor, ip) {
  const notes = body && body.notes ? sanitizeText(String(body.notes)) : null;
  if (notes && notes.length > 1000) {
    throw E.validation('notes must not exceed 1000 characters', { field: 'notes' });
  }
  const businessDate = todayCairo();

  const exists = await DailyClosing.findOne({ status: 'OPEN' }).lean();
  if (exists) throw E.conflict('A business day is already open', 'ACTIVE_BUSINESS_DAY_EXISTS');

  let created;
  try {
    created = await DailyClosing.create({
      business_date: businessDate,
      status: 'OPEN',
      opened_at: new Date(),
      opened_by_staff_id: actor._id,
      notes,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // Either the partial index (another OPEN day) or the unique business_date
      const open = await DailyClosing.findOne({ status: 'OPEN' }).lean();
      if (open) throw E.conflict('A business day is already open', 'ACTIVE_BUSINESS_DAY_EXISTS');
      throw E.conflict('This business date was already closed');
    }
    throw err;
  }

  await audit({
    action: AUDIT.OPENED_BUSINESS_DAY,
    actorStaffId: actor._id,
    entity: 'DailyClosing',
    entityId: String(created._id),
    details: { business_date: businessDate },
    ip,
  });

  return {
    closing_id: String(created._id),
    business_date: created.business_date,
    status: created.status,
    opened_at: iso(created.opened_at),
    opened_by_staff_id: idOrNull(created.opened_by_staff_id),
  };
}

async function closeDay(body, actor, ip) {
  const notes = body && body.notes ? sanitizeText(String(body.notes)) : null;
  if (notes && notes.length > 1000) {
    throw E.validation('notes must not exceed 1000 characters', { field: 'notes' });
  }
  const now = new Date();

  return runInTransaction(async (session) => {
    const day = await DailyClosing.findOne({ status: 'OPEN' }).session(session);
    if (!day) throw E.conflict('No open business day', 'NO_OPEN_BUSINESS_DAY');

    const pending = await ApprovalRequest.countDocuments({ status: 'PENDING' }).session(session);
    if (pending) {
      throw E.conflict('Pending approval requests exist', 'PENDING_APPROVALS_EXIST', {
        pending_approvals: pending,
      });
    }

    const fin = await dayFinancials(day.business_date, session);
    if (fin.active_shifts) {
      throw E.conflict('A shift of this business day is still open');
    }

    const unreviewed = await ShiftReport.countDocuments({
      shift_id: T({ $in: fin.shift_ids }),
      review_status: 'PENDING_REVIEW',
    }).session(session);
    if (unreviewed) {
      throw E.conflict('Unreviewed shift reports exist', 'UNREVIEWED_REPORTS_EXIST', {
        unreviewed_reports: unreviewed,
      });
    }

    const closed = await DailyClosing.findOneAndUpdate(
      { _id: day._id, status: 'OPEN' },
      {
        $set: {
          status: 'CLOSED',
          closed_at: now,
          closed_by_staff_id: actor._id,
          notes,
          cash_total: toPiastres(fin.cash_total),
          instapay_total: toPiastres(fin.instapay_total),
          vodafone_cash_total: toPiastres(fin.vodafone_cash_total),
          gross_revenue: toPiastres(fin.gross_revenue),
          refunds_total: toPiastres(fin.refunds_total),
          revenue_total: toPiastres(fin.revenue_total),
        },
      },
      { returnDocument: 'after', session }
    ).lean();
    if (!closed) throw E.conflict('No open business day', 'NO_OPEN_BUSINESS_DAY');

    await audit(
      {
        action: AUDIT.CLOSED_BUSINESS_DAY,
        actorStaffId: actor._id,
        entity: 'DailyClosing',
        entityId: String(closed._id),
        details: { business_date: closed.business_date, total_revenue: fin.revenue_total },
        ip,
      },
      { session }
    );

    const dto = closingDto(closed);
    return {
      closing_id: dto.closing_id,
      business_date: dto.business_date,
      status: dto.status,
      cash_total: dto.cash_total,
      instapay_total: dto.instapay_total,
      vodafone_cash_total: dto.vodafone_cash_total,
      gross_revenue: dto.gross_revenue,
      refunds_total: dto.refunds_total,
      total_revenue: dto.total_revenue,
      closed_by_staff_id: dto.closed_by_staff_id,
      closed_at: dto.closed_at,
    };
  });
}

async function listClosings({ from, to, status, page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const filter = {};
  if (from || to) {
    filter.business_date = {};
    if (from) filter.business_date.$gte = from;
    if (to) filter.business_date.$lte = to;
  }
  if (status) {
    const st = String(status).toUpperCase();
    if (!['OPEN', 'CLOSED'].includes(st)) throw E.validation('Invalid status', { field: 'status' });
    filter.status = st;
  }

  const [rows, total] = await Promise.all([
    DailyClosing.find(filter).sort({ business_date: -1 }).skip((p - 1) * l).limit(l).lean(),
    DailyClosing.countDocuments(filter),
  ]);

  return {
    data: rows.map(closingDto),
    meta: { page: p, limit: l, total, total_pages: Math.ceil(total / l) || 1 },
  };
}

const METHODS = ['CASH', 'INSTAPAY', 'VODAFONE_CASH'];
const TYPES = ['PAYMENT', 'REFUND', 'CORRECTION'];

function dayBounds(from, to) {
  const out = {};
  if (from) out.$gte = DateTime.fromISO(from, { zone: ZONE }).startOf('day').toUTC().toJSDate();
  if (to) out.$lte = DateTime.fromISO(to, { zone: ZONE }).endOf('day').toUTC().toJSDate();
  return out;
}

async function listPayments({ from, to, shift_id, method, type, booking_id, page = 1, limit = 20 } = {}) {
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));

  const filter = {};
  if (from || to) filter.createdAt = dayBounds(from, to);
  if (shift_id) {
    if (!mongoose.isValidObjectId(shift_id)) throw E.validation('Invalid shift_id', { field: 'shift_id' });
    filter.shift_id = new mongoose.Types.ObjectId(shift_id);
  }
  if (booking_id) {
    if (!mongoose.isValidObjectId(booking_id)) throw E.validation('Invalid booking_id', { field: 'booking_id' });
    filter.reservation_id = new mongoose.Types.ObjectId(booking_id);
  }
  if (method) {
    const m = String(method).toUpperCase();
    if (!METHODS.includes(m)) throw E.validation('Invalid method', { field: 'method' });
    filter.payment_method = m.toLowerCase();
  }
  if (type) {
    const t = String(type).toUpperCase();
    if (!TYPES.includes(t)) throw E.validation('Invalid type', { field: 'type' });
    filter.payment_type = t.toLowerCase();
  }

  const [rows, total, sums] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      { $group: { _id: { m: '$payment_method', t: '$payment_type' }, sum: { $sum: '$amount' } } },
    ]),
  ]);

  const staffIds = [...new Set(rows.map((r) => String(r.staff_id)))];
  const staff = staffIds.length
    ? await Staff.find({ _id: T({ $in: staffIds }) }).select('name').lean()
    : [];
  const names = new Map(staff.map((s) => [String(s._id), s.name]));

  const summary = { count: total, cash: 0, instapay: 0, vodafone_cash: 0, refunds: 0 };
  for (const s of sums) {
    if (s._id.t === 'refund') summary.refunds += -toEgp(s.sum);
    else if (summary[s._id.m] !== undefined) summary[s._id.m] += toEgp(s.sum);
  }

  return {
    data: rows.map((r) => ({
      payment_id: String(r._id),
      booking_id: idOrNull(r.reservation_id),
      shift_id: idOrNull(r.shift_id),
      method: String(r.payment_method).toUpperCase(),
      type: String(r.payment_type || 'payment').toUpperCase(),
      amount: toEgp(r.amount),
      staff_id: idOrNull(r.staff_id),
      staff_name: names.get(String(r.staff_id)) || null,
      approval_id: idOrNull(r.approval_id),
      approved_by_staff_id: idOrNull(r.approved_by_staff_id),
      created_at: iso(r.createdAt),
    })),
    meta: { page: p, limit: l, total, total_pages: Math.ceil(total / l) || 1, summary },
  };
}

module.exports = { getCurrent, openDay, closeDay, listClosings, listPayments, dayFinancials };