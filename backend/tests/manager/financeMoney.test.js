// Tests for Manager Feature M10 (batch 2): the money, the blockers and the payments ledger

const request = require('supertest');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const {
  DailyClosing,
  Shift,
  ShiftReport,
  ApprovalRequest,
  Payment,
} = require('../../src/db/models');
const { todayCairo } = require('../../src/utils/time');
const { toPiastres } = require('../../src/utils/money');
const { makeToken } = require('../helpers/managerAuth');

jest.setTimeout(60000);

describe('Manager Feature M10: money, blockers and ledger', () => {
  const CLOSINGS = '/api/v1/manager/daily-closings';
  const PAYMENTS = '/api/v1/manager/payments';

  let mgrToken;
  let recStaff;

  const auth = () => ({ Authorization: `Bearer ${mgrToken}` });
  const newId = () => new mongoose.Types.ObjectId();

  const openDay = () =>
    request(app).post(`${CLOSINGS}/open`).set(auth()).set('Idempotency-Key', randomUUID()).send({});
  const closeDay = () =>
    request(app).post(`${CLOSINGS}/close`).set(auth()).set('Idempotency-Key', randomUUID()).send({});
  const current = () => request(app).get(`${CLOSINGS}/current`).set(auth());

  const makeShift = (overrides = {}) =>
    Shift.create({
      staff_id: recStaff._id,
      shift_date: todayCairo(),
      shift_type: 'morning',
      start_at: new Date(Date.now() - 3600e3),
      end_at: new Date(Date.now() + 3600e3),
      status: 'handed_over',
      ...overrides,
    });

  // Money in EGP here; stored as piastres (negative for refunds and corrections)
  const pay = (shift, egp, method = 'cash', type = 'payment', reservationId = newId()) =>
    Payment.create({
      reservation_id: reservationId,
      staff_id: recStaff._id,
      shift_id: shift._id,
      amount: toPiastres(egp),
      payment_method: method,
      payment_datetime: new Date(),
      payment_type: type,
    });

  const makeReport = (shift, review_status) =>
    ShiftReport.create({
      shift_id: shift._id,
      shift_date: shift.shift_date,
      shift_type: shift.shift_type,
      review_status,
    });

  const makeApproval = () =>
    ApprovalRequest.create({ request_type: 'REFUND', requested_by_staff_id: recStaff._id });

  beforeAll(async () => {
    await DailyClosing.init();
    mgrToken = (await makeToken('manager')).token;
    recStaff = (await makeToken('receptionist')).staff;
  });

  beforeEach(async () => {
    await DailyClosing.deleteMany({});
    await Shift.deleteMany({});
    await ShiftReport.deleteMany({});
    await ApprovalRequest.deleteMany({});
  });

  describe('current: live totals and blockers', () => {
    it('shows live totals and the active shift blocker', async () => {
      await openDay();
      const shift = await makeShift({ status: 'active' });
      await pay(shift, 100, 'cash');
      await pay(shift, 50, 'instapay');
      await pay(shift, -30, 'cash', 'refund');

      const res = await current();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        cash_total: 100,
        instapay_total: 50,
        vodafone_cash_total: 0,
        gross_revenue: 150,
        refunds_total: 30,
        total_revenue: 120,
        can_close: false,
      });
      expect(res.body.data.blockers.active_shifts).toBe(1);
    });

    it('updates the blockers as approvals and reports appear and are resolved', async () => {
      await openDay();
      const shift = await makeShift();
      const approval = await makeApproval();
      const report = await makeReport(shift, 'PENDING_REVIEW');

      let res = await current();
      expect(res.body.data.blockers).toEqual({
        pending_approvals: 1,
        unreviewed_reports: 1,
        active_shifts: 0,
      });
      expect(res.body.data.can_close).toBe(false);

      await ApprovalRequest.updateOne({ _id: approval._id }, { status: 'APPROVED' });
      await ShiftReport.updateOne({ _id: report._id }, { review_status: 'APPROVED' });

      res = await current();
      expect(res.body.data.blockers).toEqual({
        pending_approvals: 0,
        unreviewed_reports: 0,
        active_shifts: 0,
      });
      expect(res.body.data.can_close).toBe(true);
    });
  });

  describe('close: the money', () => {
    it('matches the Contract arithmetic (payments, a refund and a correction)', async () => {
      await openDay();
      const shift = await makeShift();
      await pay(shift, 4300, 'cash');
      await pay(shift, -100, 'cash', 'correction'); // cash becomes 4200
      await pay(shift, 3500, 'instapay');
      await pay(shift, 1550, 'vodafone_cash');
      await pay(shift, -700, 'cash', 'refund');
      await makeReport(shift, 'APPROVED');

      const res = await closeDay();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        status: 'CLOSED',
        cash_total: 4200,
        instapay_total: 3500,
        vodafone_cash_total: 1550,
        gross_revenue: 9250,
        refunds_total: 700,
        total_revenue: 8550,
      });

      // The stored closing is what the list returns
      const list = await request(app).get(CLOSINGS).set(auth());
      expect(list.body.data[0]).toMatchObject({
        status: 'CLOSED',
        cash_total: 4200,
        gross_revenue: 9250,
        refunds_total: 700,
        total_revenue: 8550,
      });
    });

    it('only counts the payments of the shifts of that business day', async () => {
      await openDay();
      const today = await makeShift();
      const other = await makeShift({ shift_date: '2030-01-01' });
      await pay(today, 100, 'cash');
      await pay(other, 999, 'cash');
      await makeReport(today, 'APPROVED');

      const res = await closeDay();
      expect(res.status).toBe(200);
      expect(res.body.data.cash_total).toBe(100);
      expect(res.body.data.total_revenue).toBe(100);
    });
  });

  describe('close: blockers, in the guide order', () => {
    it('blocks on each condition in turn and succeeds after fixing each', async () => {
      await openDay();
      const shift = await makeShift({ status: 'active' });
      const approval = await makeApproval();
      const report = await makeReport(shift, 'PENDING_REVIEW');

      // 1. A pending approval comes first, even though the others are also true
      let res = await closeDay();
      expect(res.status).toBe(409);
      expect(res.text).toContain('PENDING_APPROVALS_EXIST');
      expect(res.body.error.details).toMatchObject({ pending_approvals: 1 });

      // 2. Approval decided: the open shift blocks next
      await ApprovalRequest.updateOne({ _id: approval._id }, { status: 'APPROVED' });
      res = await closeDay();
      expect(res.status).toBe(409);
      expect(res.text).toContain('CONFLICT');
      expect(res.text).toContain('still open');

      // 3. Shift handed over: the unreviewed report blocks next, with a count
      await Shift.updateOne({ _id: shift._id }, { status: 'handed_over' });
      res = await closeDay();
      expect(res.status).toBe(409);
      expect(res.text).toContain('UNREVIEWED_REPORTS_EXIST');
      expect(res.body.error.details).toMatchObject({ unreviewed_reports: 1 });

      // 4. Report reviewed: the day closes
      await ShiftReport.updateOne({ _id: report._id }, { review_status: 'APPROVED' });
      res = await closeDay();
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CLOSED');
    });

    it('does not block on a report in NEEDS_REVIEW', async () => {
      await openDay();
      const shift = await makeShift();
      await makeReport(shift, 'NEEDS_REVIEW');
      const res = await closeDay();
      expect(res.status).toBe(200);
    });
  });

  describe('payments ledger', () => {
    let shift;
    let reservationId;

    beforeEach(async () => {
      shift = await makeShift({ shift_type: 'evening' });
      reservationId = newId();
      await pay(shift, 100, 'cash', 'payment', reservationId);
      await pay(shift, 50, 'instapay');
      await pay(shift, -30, 'cash', 'refund');
      await pay(shift, -10, 'cash', 'correction');
    });

    const ledger = (qs) => request(app).get(`${PAYMENTS}?shift_id=${shift._id}${qs}`).set(auth());

    it('returns the item fields with signed amounts and the staff name', async () => {
      const res = await ledger('');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);

      const byType = (t) => res.body.data.filter((p) => p.type === t);
      expect(byType('REFUND')[0].amount).toBe(-30);
      expect(byType('CORRECTION')[0].amount).toBe(-10);
      expect(byType('PAYMENT').map((p) => p.amount).sort((a, b) => a - b)).toEqual([50, 100]);

      const item = res.body.data[0];
      expect(item).toMatchObject({
        shift_id: String(shift._id),
        staff_id: String(recStaff._id),
        staff_name: recStaff.name,
      });
      expect(item.payment_id).toBeDefined();
      expect(item.created_at).toBeDefined();
    });

    it('has a summary that matches the rows', async () => {
      const res = await ledger('');
      expect(res.body.meta.summary).toEqual({
        count: 4,
        cash: 90, // 100 payment, minus the 10 correction; the refund is separate
        instapay: 50,
        vodafone_cash: 0,
        refunds: 30,
      });
    });

    it('filters by method, type and booking_id', async () => {
      const byMethod = await ledger('&method=INSTAPAY');
      expect(byMethod.body.data).toHaveLength(1);
      expect(byMethod.body.data[0].method).toBe('INSTAPAY');
      expect(byMethod.body.meta.total).toBe(1);

      const byType = await ledger('&type=REFUND');
      expect(byType.body.data).toHaveLength(1);
      expect(byType.body.data[0].amount).toBe(-30);

      const byBooking = await ledger(`&booking_id=${reservationId}`);
      expect(byBooking.body.data).toHaveLength(1);
      expect(byBooking.body.data[0].booking_id).toBe(String(reservationId));
    });

    it('filters by Cairo dates (from and to)', async () => {
      const today = todayCairo();
      const inRange = await ledger(`&from=${today}&to=${today}`);
      expect(inRange.body.data).toHaveLength(4);

      const future = await ledger('&from=2099-01-01&to=2099-01-02');
      expect(future.body.data).toHaveLength(0);
    });

    it('lists newest first', async () => {
      const res = await ledger('');
      const times = res.body.data.map((p) => p.created_at);
      const sorted = [...times].sort().reverse();
      expect(times).toEqual(sorted);
    });
  });
});