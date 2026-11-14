// Tests for Manager Feature M10: Finance and Daily Closing (batch 1)

const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../../src/app');
const { DailyClosing } = require('../../src/db/models');
const { todayCairo } = require('../../src/utils/time');
const { makeToken } = require('../helpers/managerAuth');

jest.setTimeout(60000);

describe('Manager Feature M10: Finance and Daily Closing', () => {
  const CLOSINGS = '/api/v1/manager/daily-closings';
  const PAYMENTS = '/api/v1/manager/payments';

  let mgr;
  let mgrToken;
  let recToken;

  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  const mgrAuth = () => auth(mgrToken);

  const openDay = (key = randomUUID(), body = {}) =>
    request(app).post(`${CLOSINGS}/open`).set(mgrAuth()).set('Idempotency-Key', key).send(body);

  const closeDay = (key = randomUUID(), body = {}) =>
    request(app).post(`${CLOSINGS}/close`).set(mgrAuth()).set('Idempotency-Key', key).send(body);

  beforeAll(async () => {
    await DailyClosing.init();
    const m = await makeToken('manager');
    mgr = m.staff;
    mgrToken = m.token;
    recToken = (await makeToken('receptionist')).token;
  });

  beforeEach(async () => {
    await DailyClosing.deleteMany({});
  });

  describe('access control', () => {
    it('rejects requests without a token (401)', async () => {
      const res = await request(app).get(`${CLOSINGS}/current`);
      expect(res.status).toBe(401);
    });

    it('rejects a receptionist token on every route (403)', async () => {
      const calls = [
        request(app).get(`${CLOSINGS}/current`).set(auth(recToken)),
        request(app).get(CLOSINGS).set(auth(recToken)),
        request(app).get(PAYMENTS).set(auth(recToken)),
        request(app).post(`${CLOSINGS}/open`).set(auth(recToken)).set('Idempotency-Key', randomUUID()).send({}),
        request(app).post(`${CLOSINGS}/close`).set(auth(recToken)).set('Idempotency-Key', randomUUID()).send({}),
      ];
      for (const call of calls) {
        const res = await call;
        expect(res.status).toBe(403);
      }
    });
  });

  describe('current', () => {
    it('returns null data when no business day is open', async () => {
      const res = await request(app).get(`${CLOSINGS}/current`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('returns the open day with totals, blockers and can_close', async () => {
      await openDay();
      const res = await request(app).get(`${CLOSINGS}/current`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        business_date: todayCairo(),
        status: 'OPEN',
        cash_total: 0,
        instapay_total: 0,
        vodafone_cash_total: 0,
        gross_revenue: 0,
        refunds_total: 0,
        total_revenue: 0,
        can_close: true,
      });
      expect(res.body.data.blockers).toEqual({
        pending_approvals: 0,
        unreviewed_reports: 0,
        active_shifts: 0,
      });
    });
  });

  describe('open', () => {
    it('opens today (Cairo) and returns 201', async () => {
      const res = await openDay();
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        business_date: todayCairo(),
        status: 'OPEN',
        opened_by_staff_id: String(mgr._id),
      });
      expect(res.body.data.closing_id).toBeDefined();
    });

    it('rejects a second open while one is open (409 ACTIVE_BUSINESS_DAY_EXISTS)', async () => {
      await openDay();
      const res = await openDay();
      expect(res.status).toBe(409);
      expect(res.text).toContain('ACTIVE_BUSINESS_DAY_EXISTS');
    });

    it('gives exactly one 201 for two simultaneous opens', async () => {
      const [a, b] = await Promise.all([openDay(), openDay()]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await DailyClosing.countDocuments({ status: 'OPEN' })).toBe(1);
    });

    it('rejects opening a date that was already closed (409)', async () => {
      await openDay();
      const closed = await closeDay();
      expect(closed.status).toBe(200);
      const res = await openDay();
      expect(res.status).toBe(409);
    });

    it('replays the same Idempotency-Key without creating a second day', async () => {
      const key = randomUUID();
      const first = await openDay(key);
      const again = await openDay(key);
      expect(first.status).toBe(201);
      expect(again.status).toBe(201);
      expect(again.headers['idempotent-replayed']).toBe('true');
      expect(await DailyClosing.countDocuments({})).toBe(1);
    });

    it('requires an Idempotency-Key (400)', async () => {
      const res = await request(app).post(`${CLOSINGS}/open`).set(mgrAuth()).send({});
      expect(res.status).toBe(400);
    });
  });

  describe('close', () => {
    it('returns 409 NO_OPEN_BUSINESS_DAY when nothing is open', async () => {
      const res = await closeDay();
      expect(res.status).toBe(409);
      expect(res.text).toContain('NO_OPEN_BUSINESS_DAY');
    });

    it('closes an empty day with zero totals and records who closed it', async () => {
      await openDay();
      const res = await closeDay(randomUUID(), { notes: 'Night audit complete' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        business_date: todayCairo(),
        status: 'CLOSED',
        cash_total: 0,
        instapay_total: 0,
        vodafone_cash_total: 0,
        gross_revenue: 0,
        refunds_total: 0,
        total_revenue: 0,
        closed_by_staff_id: String(mgr._id),
      });
      expect(res.body.data.closed_at).toBeDefined();
      expect(await DailyClosing.countDocuments({ status: 'OPEN' })).toBe(0);
    });

    it('replays the same key without closing twice', async () => {
      await openDay();
      const key = randomUUID();
      const first = await closeDay(key);
      const again = await closeDay(key);
      expect(first.status).toBe(200);
      expect(again.status).toBe(200);
      expect(again.headers['idempotent-replayed']).toBe('true');
    });

    it('gives exactly one 200 for two simultaneous closes', async () => {
      await openDay();
      const [a, b] = await Promise.all([closeDay(), closeDay()]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });
  });

  describe('list', () => {
    it('lists closed days with the stored numbers and supports the status filter', async () => {
      await openDay();
      await closeDay();

      const all = await request(app).get(CLOSINGS).set(mgrAuth());
      expect(all.status).toBe(200);
      expect(all.body.data).toHaveLength(1);
      expect(all.body.data[0]).toMatchObject({ status: 'CLOSED', business_date: todayCairo() });
      expect(all.body.meta).toMatchObject({ page: 1, total: 1, total_pages: 1 });

      const open = await request(app).get(`${CLOSINGS}?status=OPEN`).set(mgrAuth());
      expect(open.status).toBe(200);
      expect(open.body.data).toHaveLength(0);
    });

    it('rejects an invalid status (400)', async () => {
      const res = await request(app).get(`${CLOSINGS}?status=WRONG`).set(mgrAuth());
      expect(res.status).toBe(400);
      expect(res.text).toContain('VALIDATION_ERROR');
    });
  });

  describe('payments ledger', () => {
    it('returns a list with a zeroed summary when there are no payments', async () => {
      const res = await request(app).get(`${PAYMENTS}?from=2030-01-01&to=2030-01-02`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.summary).toEqual({
        count: 0,
        cash: 0,
        instapay: 0,
        vodafone_cash: 0,
        refunds: 0,
      });
    });

    it('rejects invalid filters with VALIDATION_ERROR (400)', async () => {
      for (const qs of ['method=CARD', 'type=WRONG', 'shift_id=abc', 'booking_id=abc']) {
        const res = await request(app).get(`${PAYMENTS}?${qs}`).set(mgrAuth());
        expect(res.status).toBe(400);
        expect(res.text).toContain('VALIDATION_ERROR');
      }
    });

    it('has no write route', async () => {
      const res = await request(app)
        .post(PAYMENTS)
        .set(mgrAuth())
        .set('Idempotency-Key', randomUUID())
        .send({});
      expect([404, 405]).toContain(res.status);
    });
  });
});