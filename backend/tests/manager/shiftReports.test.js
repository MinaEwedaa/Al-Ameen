// Tests for Manager Feature M9: Shift Reports

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { ShiftReport, AuditLog } = require('../../src/db/models');
const { makeToken } = require('../helpers/managerAuth');

jest.setTimeout(60000);

describe('Manager Feature M9: Shift Reports', () => {
  const BASE = '/api/v1/manager/shift-reports';
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const newId = () => new mongoose.Types.ObjectId();

  let mgr;
  let mgrToken;

  beforeEach(async () => {
    const m = await makeToken('manager');
    mgr = m.staff;
    mgrToken = m.token;
  });

  // Money is in EGP (this is how the code stores and returns it)
  const makeReport = (overrides = {}) =>
    ShiftReport.create({
      shift_id: newId(),
      shift_date: '2030-01-01',
      shift_type: 'morning',
      staff_id: newId(),
      staff_name: 'Ahmed Hassan',
      handled_rooms: 14,
      tasks_cleaning: 8,
      maintenance_requests: 1,
      pending_items: 2,
      cash_total: 4200,
      instapay_total: 3500,
      vodafone_cash_total: 1550,
      gross_revenue: 9250,
      refunds_total: 700,
      cancellation_retained_total: 300,
      net_revenue: 8550,
      review_status: 'PENDING_REVIEW',
      ...overrides,
    });

  describe('access control', () => {
    it('rejects a request without a token (401)', async () => {
      const res = await request(app).get(BASE);
      expect(res.status).toBe(401);
    });

    it('rejects a receptionist token (403)', async () => {
      const { token } = await makeToken('receptionist');
      const res = await request(app).get(BASE).set(auth(token));
      expect(res.status).toBe(403);
    });
  });

  describe('list', () => {
    it('returns the list item fields', async () => {
      const report = await makeReport({ shift_date: '2030-02-01' });
      const res = await request(app)
        .get(`${BASE}?business_date=2030-02-01`)
        .set(auth(mgrToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        report_id: String(report._id),
        shift_id: String(report.shift_id),
        business_date: '2030-02-01',
        shift_type: 'morning',
        staff_name: 'Ahmed Hassan',
        review_status: 'PENDING_REVIEW',
        gross_revenue: 9250,
        refunds_total: 700,
        net_revenue: 8550,
      });
      expect(res.body.data[0].created_at).toBeDefined();
    });

    it('returns meta with total_pages', async () => {
      await makeReport({ shift_date: '2030-03-01' });
      await makeReport({ shift_date: '2030-03-01' });
      await makeReport({ shift_date: '2030-03-01' });
      const res = await request(app)
        .get(`${BASE}?business_date=2030-03-01&limit=2`)
        .set(auth(mgrToken));
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, total_pages: 2 });
    });

    it('filters by review_status', async () => {
      await makeReport({ shift_date: '2030-04-01', review_status: 'APPROVED' });
      await makeReport({ shift_date: '2030-04-01', review_status: 'PENDING_REVIEW' });
      const res = await request(app)
        .get(`${BASE}?business_date=2030-04-01&review_status=APPROVED`)
        .set(auth(mgrToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].review_status).toBe('APPROVED');
    });

    it('filters by shift_id', async () => {
      const report = await makeReport({ shift_date: '2030-05-01' });
      await makeReport({ shift_date: '2030-05-01' });
      const res = await request(app)
        .get(`${BASE}?shift_id=${report.shift_id}`)
        .set(auth(mgrToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].report_id).toBe(String(report._id));
    });

    it('rejects an invalid review_status with VALIDATION_ERROR (400)', async () => {
      const res = await request(app)
        .get(`${BASE}?review_status=WRONG`)
        .set(auth(mgrToken));
      expect(res.status).toBe(400);
      expect(res.text).toContain('VALIDATION_ERROR');
    });
  });

  describe('details', () => {
    it('returns the report detail in the guide shape', async () => {
      const report = await makeReport({ shift_date: '2030-06-01' });
      const res = await request(app).get(`${BASE}/${report._id}`).set(auth(mgrToken));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        report_id: String(report._id),
        business_date: '2030-06-01',
        rooms_handled: 14,
        cleaning_tasks: 8,
        maintenance_requests: 1,
        pending_items: 2,
        cash_total: 4200,
        instapay_total: 3500,
        vodafone_cash_total: 1550,
        gross_revenue: 9250,
        refunds_total: 700,
        cancellation_retained_total: 300,
        net_revenue: 8550,
        review_status: 'PENDING_REVIEW',
        pdf_url: `/api/v1/manager/shift-reports/${report._id}/pdf`,
      });
      expect(res.body.data.pdf).toBeUndefined();
      expect(res.body.data.pdf_data).toBeUndefined();
    });

    it('returns 404 for an unknown or invalid id', async () => {
      const a = await request(app).get(`${BASE}/${newId()}`).set(auth(mgrToken));
      expect(a.status).toBe(404);
      const b = await request(app).get(`${BASE}/not-an-id`).set(auth(mgrToken));
      expect(b.status).toBe(404);
    });
  });

  describe('review', () => {
    const review = (id, body, token = mgrToken) =>
      request(app).patch(`${BASE}/${id}/review`).set(auth(token)).send(body);

    it('requires a comment with NEEDS_REVIEW (400)', async () => {
      const report = await makeReport();
      const res = await review(report._id, { review_status: 'NEEDS_REVIEW' });
      expect(res.status).toBe(400);
      expect(res.text).toContain('VALIDATION_ERROR');
    });

    it('marks a report NEEDS_REVIEW and records the reviewer', async () => {
      const report = await makeReport();
      const res = await review(report._id, {
        review_status: 'NEEDS_REVIEW',
        manager_comment: 'Cash does not match',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.review_status).toBe('NEEDS_REVIEW');
      expect(String(res.body.data.reviewed_by_staff_id)).toBe(String(mgr._id));
      expect(res.body.data.manager_comment).toBe('Cash does not match');
    });

    it('approves a pending report, and APPROVED is final (422)', async () => {
      const report = await makeReport();
      const ok = await review(report._id, { review_status: 'APPROVED' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.review_status).toBe('APPROVED');

      const again = await review(report._id, {
        review_status: 'NEEDS_REVIEW',
        manager_comment: 'Changed my mind',
      });
      expect(again.status).toBe(422);
      expect(again.text).toContain('INVALID_STATUS_TRANSITION');
    });

    it('allows NEEDS_REVIEW then APPROVED', async () => {
      const report = await makeReport();
      await review(report._id, { review_status: 'NEEDS_REVIEW', manager_comment: 'Check cash' });
      const res = await review(report._id, { review_status: 'APPROVED' });
      expect(res.status).toBe(200);
      expect(res.body.data.review_status).toBe('APPROVED');
    });

    it('writes an audit record REVIEWED_SHIFT_REPORT', async () => {
      const report = await makeReport();
      await review(report._id, { review_status: 'APPROVED' });
      const log = await AuditLog.findOne({
        action: 'REVIEWED_SHIFT_REPORT',
        entity_id: String(report._id),
      }).lean();
      expect(log).not.toBeNull();
    });

    it('returns 404 for an unknown report', async () => {
      const res = await review(newId(), { review_status: 'APPROVED' });
      expect(res.status).toBe(404);
    });

    it('rejects a receptionist token (403)', async () => {
      const report = await makeReport();
      const { token } = await makeToken('receptionist');
      const res = await review(report._id, { review_status: 'APPROVED' }, token);
      expect(res.status).toBe(403);
    });
  });

  describe('pdf', () => {
    it('serves a PDF inline even when none is stored yet', async () => {
      const report = await makeReport({ shift_date: '2030-07-01' });
      const res = await request(app).get(`${BASE}/${report._id}/pdf`).set(auth(mgrToken));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('inline');
    });
  });
    describe('activities', () => {
    it('returns data and meta with only the safe fields (no details, no ip)', async () => {
      const report = await makeReport({ shift_date: '2030-06-01' });
      await AuditLog.collection.insertOne({
        action: 'SHIFT_OPENED',
        entity: 'Shift',
        entity_id: String(report.shift_id),
        details: { secret: 'must-not-leak' },
        ip: '10.0.0.9',
        at: new Date(),
      });

      const res = await request(app)
        .get(`${BASE}/${report._id}/activities`)
        .set(auth(mgrToken));

      expect(res.status).toBe(200);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, total_pages: 1 });
      expect(res.body.data).toHaveLength(1);
      expect(Object.keys(res.body.data[0]).sort()).toEqual(['action', 'at', 'entity', 'entity_id', 'id']);
      expect(res.body.data[0].action).toBe('SHIFT_OPENED');
      expect(JSON.stringify(res.body)).not.toContain('must-not-leak');
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.9');
    });

    it('returns 404 for an unknown report', async () => {
      const res = await request(app)
        .get(`${BASE}/${newId()}/activities`)
        .set(auth(mgrToken));
      expect(res.status).toBe(404);
    });
  });

  describe('handover', () => {
    it('returns the guide shape with the pending count and an empty list', async () => {
      const { Shift } = require('../../src/db/models');
      const shift = await Shift.create({
        staff_id: newId(),
        shift_date: '2030-07-01',
        shift_type: 'morning',
        start_at: new Date('2030-07-01T04:00:00Z'),
        end_at: new Date('2030-07-01T13:00:00Z'),
        status: 'handed_over',
        handed_over_at: new Date('2030-07-01T13:05:00Z'),
      });
      const report = await makeReport({
        shift_id: shift._id,
        shift_date: '2030-07-01',
        pending_items: 2,
        notes: 'Room 12 key missing',
      });

      const res = await request(app)
        .get(`${BASE}/${report._id}/handover`)
        .set(auth(mgrToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        report_id: String(report._id),
        shift_id: String(shift._id),
        staff_name: 'Ahmed Hassan',
        notes: 'Room 12 key missing',
        pending_items_count: 2,
        pending_items: [],
      });
      expect(res.body.data.submitted_at).toBeDefined();
    });

    it('returns 404 when the report is unknown', async () => {
      const res = await request(app)
        .get(`${BASE}/${newId()}/handover`)
        .set(auth(mgrToken));
      expect(res.status).toBe(404);
    });
  });

  describe('pdf storage', () => {
    it('stores the PDF when approved and removes it when sent back to review', async () => {
      const report = await makeReport({ shift_date: '2030-08-01' });

      const approve = await request(app)
        .patch(`${BASE}/${report._id}/review`)
        .set(auth(mgrToken))
        .send({ review_status: 'APPROVED' });
      expect(approve.status).toBe(200);

      const stored = await ShiftReport.findById(report._id).select('+pdf_data').lean();
      expect(stored.pdf_data).toBeTruthy();
      expect(stored.pdf_data.length()).toBeGreaterThan(0);
      expect(stored.pdf_generated_at).toBeTruthy();

      const pdfRes = await request(app).get(`${BASE}/${report._id}/pdf`).set(auth(mgrToken));
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.headers['cache-control']).toContain('no-store');
    });

    it('clears a stored PDF when the report goes back to NEEDS_REVIEW', async () => {
      const report = await makeReport({ shift_date: '2030-08-02' });
      await ShiftReport.updateOne(
        { _id: report._id },
        { $set: { pdf_data: Buffer.from('%PDF-old'), pdf_generated_at: new Date() } }
      );

      const res = await request(app)
        .patch(`${BASE}/${report._id}/review`)
        .set(auth(mgrToken))
        .send({ review_status: 'NEEDS_REVIEW', manager_comment: 'Check the cash total' });
      expect(res.status).toBe(200);

      const after = await ShiftReport.findById(report._id).select('+pdf_data').lean();
      expect(after.pdf_data).toBeNull();
      expect(after.pdf_generated_at).toBeNull();
    });
  });
});