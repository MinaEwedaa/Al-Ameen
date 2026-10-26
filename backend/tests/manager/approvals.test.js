// Tests for Manager Feature M8: Approvals and Cancellation Settlement

const request = require('supertest');
const argon2 = require('argon2');
const { DateTime } = require('luxon');
const app = require('../../src/app');
const { randomUUID } = require('crypto');
const {
  Staff,
  Session,
  Shift,
  Attendance,
  Room,
  RoomNight,
  Reservation,
  Guest,
  AuditLog,
  Payment,
  ApprovalRequest,
  CancellationSettlement,
  Notification,
} = require('../../src/db/models');
const IdempotencyKey = require('../../src/db/models/IdempotencyKey');
const { ZONE } = require('../../src/utils/time');
const { toPiastres } = require('../../src/utils/money');
const { makeToken } = require('../helpers/managerAuth');

jest.setTimeout(60000);

describe('Manager Feature M8: Approvals and Cancellation Settlement', () => {
  const password = 'Password123';
  const NOW = DateTime.fromISO('2026-10-15T13:00:00', { zone: ZONE }).toISO();
  const CHECK_IN = DateTime.fromISO('2026-10-16T12:00:00', { zone: ZONE }).toISO();
  const CHECK_OUT = DateTime.fromISO('2026-10-18T12:00:00', { zone: ZONE }).toISO();

  let passwordHash;
  let recToken;
  let receptionist;
  let manager;
  let mgrToken;
 

  const key = () => randomUUID();
  const recAuth = () => ({ Authorization: `Bearer ${recToken}` });
  const mgrAuth = () => ({ Authorization: `Bearer ${mgrToken}` });
  const expectCode = (res, code) => expect(res.text).toContain(code);

  const createGuest = async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(recAuth())
      .set('x-test-time', NOW)
      .send({ name: 'Ahmed Mohamed', phone: '01012345678', id_number: 'AB12345678' });
    expect(res.status).toBe(201);
    return res.body.guest_id;
  };

  const createRoom = () =>
    Room.create({
      room_number: '101',
      room_type: 'double',
      floor: 1,
      description: 'Sea view',
      price_per_night: toPiastres(1500),
      half_day_price: toPiastres(500),
    });

  // Creates a confirmed reservation through the real API
  const makeReservation = async () => {
    const guest_id = await createGuest();
    const room = await createRoom();
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(recAuth())
      .set('x-test-time', NOW)
      .set('Idempotency-Key', key())
      .send({ guest_id, room_id: String(room._id), check_in: CHECK_IN, check_out: CHECK_OUT });
        
    
    expect(res.status).toBe(201);
    return { id: res.body.reservation_id, room };
  };

  // Records a payment directly (the model is append-only, create is allowed)
  const payDirect = async (reservationId, egp) => {
    const piastres = toPiastres(egp);
    const shift = await Shift.findOne({ staff_id: receptionist._id });
    await Payment.create({
      reservation_id: reservationId,
      staff_id: receptionist._id,
      shift_id: shift._id,
      amount: piastres,
      payment_method: 'cash',
      payment_datetime: new Date(),
    });
    await Reservation.updateOne({ _id: reservationId }, { $inc: { paid_cache: piastres } });
  };

  const cancel = (id, reason = 'Guest changed plans') =>
    request(app)
      .post(`/api/v1/reservations/${id}/cancel`)
      .set(recAuth())
      .set('x-test-time', NOW)
      .set('Idempotency-Key', key())
      .send({ reason });

  const decide = (approvalId, body, idemKey = key()) =>
    request(app)
      .patch(`/api/v1/manager/approvals/${approvalId}/decision`)
      .set(mgrAuth())
      .set('Idempotency-Key', idemKey)
      .send(body);

  // Reservation with 1000 EGP paid and a pending cancellation approval
  const paidCancellation = async () => {
    const { id, room } = await makeReservation();
    await payDirect(id, 1000);
    const res = await cancel(id);
    expect(res.status).toBe(202);
    return { id, room, approvalId: res.body.data.approval_id };
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash(password);
  });

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Session.deleteMany({}),
      Shift.deleteMany({}),
      Attendance.deleteMany({}),
      Room.deleteMany({}),
      RoomNight.deleteMany({}),
      Reservation.deleteMany({}),
      Guest.deleteMany({}),
      ApprovalRequest.deleteMany({}),
      Notification.deleteMany({}),
      IdempotencyKey.deleteMany({}),
      AuditLog.collection.deleteMany({}),
      Payment.collection.deleteMany({}),
      CancellationSettlement.collection.deleteMany({}),
    ]);

    receptionist = await Staff.create({
      username: 'ahmed_morning',
      name: 'Ahmed Morning',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', NOW)
      .send({ username: 'ahmed_morning', password });
    if (loginRes.status !== 200) {
      throw new Error(`Login failed: status=${loginRes.status}, body=${loginRes.text}`);
    }
    recToken = loginRes.body.access_token;

    const m = await makeToken('manager', { notification_prefs: { approval_request: true } });
    manager = m.staff;
    mgrToken = m.token;
  });

  describe('Receptionist cancellation (F7 rule)', () => {
    test('unpaid reservation is cancelled immediately (200)', async () => {
      const { id } = await makeReservation();
      const res = await cancel(id);
      expect(res.status).toBe(200);
      const r = await Reservation.findById(id).lean();
      expect(r.status).toBe('cancelled');
      expect(await RoomNight.countDocuments({ reservation_id: id })).toBe(0);
      expect(await ApprovalRequest.countDocuments({})).toBe(0);
    });

    test('paid reservation opens an approval (202), notifies the manager, second cancel is 409', async () => {
      const { id } = await makeReservation();
      await payDirect(id, 1000);

      const res = await cancel(id);
      expect(res.status).toBe(202);
      expect(res.body.data.status).toBe('PENDING_APPROVAL');

      const r = await Reservation.findById(id).lean();
      expect(r.status).toBe('confirmed');
      expect(r.pending_refund).toBe(true);

      const ap = await ApprovalRequest.findOne({}).lean();
      expect(ap.status).toBe('PENDING');
      expect(ap.request_type).toBe('CANCELLATION');
      expect(ap.net_paid_amount).toBe(100000);

      expect(await Notification.countDocuments({ recipient_staff_id: manager._id, type: 'APPROVAL_REQUEST' })).toBe(1);

      const again = await cancel(id);
      expect(again.status).toBe(409);
    });

    test('cancel without reason is 400', async () => {
      const { id } = await makeReservation();
      const res = await request(app)
        .post(`/api/v1/reservations/${id}/cancel`)
        .set(recAuth())
        .set('x-test-time', NOW)
        .set('Idempotency-Key', key())
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /approval-requests', () => {
    test('REFUND request is created (201) with the net snapshot', async () => {
      const { id } = await makeReservation();
      await payDirect(id, 1000);
      const res = await request(app)
        .post('/api/v1/approval-requests')
        .set(recAuth())
        .set('x-test-time', NOW)
        .send({ request_type: 'REFUND', booking_id: id, reason: 'Service issue', requested_refund_amount: 200 });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.net_paid_amount).toBe(1000);
      expect(res.body.data.requested_refund_amount).toBe(200);
    });

    test('REFUND with nothing paid is 400', async () => {
      const { id } = await makeReservation();
      const res = await request(app)
        .post('/api/v1/approval-requests')
        .set(recAuth())
        .set('x-test-time', NOW)
        .send({ request_type: 'REFUND', booking_id: id, reason: 'Nothing paid' });
      expect(res.status).toBe(400);
    });

    test('manager token is rejected (403)', async () => {
      const res = await request(app)
        .post('/api/v1/approval-requests')
        .set(mgrAuth())
        .send({ request_type: 'REFUND', booking_id: '64b000000000000000000000', reason: 'x y z' });
      expect(res.status).toBe(403);
    });
  });

  describe('Manager list and detail', () => {
    test('lists PENDING by default and shows the reservation summary', async () => {
      await paidCancellation();
      const res = await request(app).get('/api/v1/manager/approvals').set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].request_type).toBe('CANCELLATION');
      expect(res.body.data[0].requested_by_name).toBe('Ahmed Morning');
      expect(res.body.data[0].reservation.room_number).toBe('101');
      expect(res.body.meta.total).toBe(1);
    });

    test('detail returns the live net, unknown id is 404, receptionist token is 403', async () => {
      const { approvalId } = await paidCancellation();
      const ok = await request(app).get(`/api/v1/manager/approvals/${approvalId}`).set(mgrAuth());
      expect(ok.status).toBe(200);
      expect(ok.body.data.net_paid_amount).toBe(1000);

      const nf = await request(app).get('/api/v1/manager/approvals/64b000000000000000000000').set(mgrAuth());
      expect(nf.status).toBe(404);

      const forbidden = await request(app).get('/api/v1/manager/approvals').set(recAuth());
      expect(forbidden.status).toBe(403);
    });
  });

  describe('Decision: CANCELLATION with refund', () => {
    test('1000 paid, 700 refunded: payment, settlement, reservation and notification', async () => {
      const { id, approvalId } = await paidCancellation();

      const res = await decide(approvalId, { action: 'APPROVE', approved_refund_amount: 700, manager_comment: 'ok' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.net_paid_amount).toBe(1000);
      expect(res.body.data.approved_refund_amount).toBe(700);
      expect(res.body.data.retained_amount).toBe(300);
      expect(res.body.data.execution_result.booking_status).toBe('cancelled');

      const refund = await Payment.findOne({ payment_type: 'refund' }).lean();
      expect(refund.amount).toBe(-70000);
      expect(refund.payment_method).toBe('cash');
      expect(String(refund.approval_id)).toBe(String(approvalId));
      expect(String(refund.approved_by_staff_id)).toBe(String(manager._id));
      expect(String(refund.staff_id)).toBe(String(receptionist._id));

      const st = await CancellationSettlement.findOne({}).lean();
      expect(st.net_paid_amount).toBe(100000);
      expect(st.refunded_amount).toBe(70000);
      expect(st.retained_amount).toBe(30000);
      expect(String(st.refund_payment_id)).toBe(String(refund._id));

      const r = await Reservation.findById(id).lean();
      expect(r.status).toBe('cancelled');
      expect(r.refund_settled).toBe(true);
      expect(r.pending_refund).toBe(false);
      expect(r.paid_cache).toBe(30000);
      expect(await RoomNight.countDocuments({ reservation_id: id })).toBe(0);

      const ap = await ApprovalRequest.findById(approvalId).lean();
      expect(ap.approved_refund_amount).toBe(70000);
      expect(ap.amount_retained).toBe(30000);

      expect(await Notification.countDocuments({ recipient_staff_id: receptionist._id, type: 'APPROVAL_DECISION' })).toBe(1);
    });

    test('refund 0: no payment, everything retained, reservation cancelled', async () => {
      const { id, approvalId } = await paidCancellation();
      const res = await decide(approvalId, { action: 'APPROVE', approved_refund_amount: 0 });
      expect(res.status).toBe(200);
      expect(res.body.data.retained_amount).toBe(1000);
      expect(res.body.data.execution_result.refund_payment_id).toBeNull();
      expect(await Payment.countDocuments({ payment_type: 'refund' })).toBe(0);
      const st = await CancellationSettlement.findOne({}).lean();
      expect(st.refunded_amount).toBe(0);
      expect(st.retained_amount).toBe(100000);
      expect(st.refund_payment_id).toBeNull();
      expect((await Reservation.findById(id).lean()).status).toBe('cancelled');
    });

    test('refund equal to net: nothing retained', async () => {
      const { approvalId } = await paidCancellation();
      const res = await decide(approvalId, { action: 'APPROVE', approved_refund_amount: 1000 });
      expect(res.status).toBe(200);
      expect(res.body.data.retained_amount).toBe(0);
      const refund = await Payment.findOne({ payment_type: 'refund' }).lean();
      expect(refund.amount).toBe(-100000);
    });

    test('refund above net is 400 and the request stays PENDING', async () => {
      const { id, approvalId } = await paidCancellation();
      const res = await decide(approvalId, { action: 'APPROVE', approved_refund_amount: 1000.01 });
      expect(res.status).toBe(400);
      expect((await ApprovalRequest.findById(approvalId).lean()).status).toBe('PENDING');
      expect((await Reservation.findById(id).lean()).status).toBe('confirmed');
      expect(await Payment.countDocuments({ payment_type: 'refund' })).toBe(0);
    });

    test('three decimals is 400, negative is 400, missing amount is 400', async () => {
      const { approvalId } = await paidCancellation();
      expect((await decide(approvalId, { action: 'APPROVE', approved_refund_amount: 700.555 })).status).toBe(400);
      expect((await decide(approvalId, { action: 'APPROVE', approved_refund_amount: -5 })).status).toBe(400);
      expect((await decide(approvalId, { action: 'APPROVE' })).status).toBe(400);
      expect((await ApprovalRequest.findById(approvalId).lean()).status).toBe('PENDING');
    });

    test('no active shift: 409, nothing written, request stays PENDING', async () => {
      const { id, approvalId } = await paidCancellation();
      await Shift.updateMany({}, { status: 'handed_over' });
      const res = await decide(approvalId, { action: 'APPROVE', approved_refund_amount: 700 });
      expect(res.status).toBe(409);
      expect((await ApprovalRequest.findById(approvalId).lean()).status).toBe('PENDING');
      expect((await Reservation.findById(id).lean()).status).toBe('confirmed');
      expect(await Payment.countDocuments({ payment_type: 'refund' })).toBe(0);
      expect(await CancellationSettlement.collection.countDocuments({})).toBe(0);
    });
  });

  describe('Decision: other types', () => {
    test('REFUND type: payment only, reservation stays, no settlement', async () => {
      const { id } = await makeReservation();
      await payDirect(id, 1000);
      const created = await request(app)
        .post('/api/v1/approval-requests')
        .set(recAuth())
        .set('x-test-time', NOW)
        .send({ request_type: 'REFUND', booking_id: id, reason: 'Service issue', requested_refund_amount: 200 });
      expect(created.status).toBe(201);

      const res = await decide(created.body.data.approval_id, { action: 'APPROVE', approved_refund_amount: 200 });
      expect(res.status).toBe(200);
      expect(res.body.data.execution_result.booking_status).toBe('confirmed');
      expect(res.body.data.execution_result.settlement_id).toBeNull();

      const refund = await Payment.findOne({ payment_type: 'refund' }).lean();
      expect(refund.amount).toBe(-20000);
      const r = await Reservation.findById(id).lean();
      expect(r.status).toBe('confirmed');
      expect(r.pending_refund).toBe(false);
      expect(r.paid_cache).toBe(80000);
      expect(await CancellationSettlement.collection.countDocuments({})).toBe(0);
    });

    test('DISCOUNT is recorded only; an amount in the body is 400', async () => {
      const { id } = await makeReservation();
      const ap = await ApprovalRequest.create({
        reservation_id: id,
        request_type: 'DISCOUNT',
        requested_by_staff_id: receptionist._id,
        reason: 'Discount 10 percent',
      });
      expect((await decide(ap._id, { action: 'APPROVE', approved_refund_amount: 10 })).status).toBe(400);
      const res = await decide(ap._id, { action: 'APPROVE' });
      expect(res.status).toBe(200);
      expect(res.body.data.execution_result).toBeNull();
      expect(await Payment.countDocuments({})).toBe(0);
      expect(await Notification.countDocuments({ recipient_staff_id: receptionist._id, type: 'APPROVAL_DECISION' })).toBe(1);
    });
  });

  describe('Reject, own request, double decision', () => {
    test('reject needs a comment, then clears pending_refund and leaves the reservation active', async () => {
      const { id, approvalId } = await paidCancellation();
      expect((await decide(approvalId, { action: 'REJECT' })).status).toBe(400);

      const res = await decide(approvalId, { action: 'REJECT', manager_comment: 'Not allowed' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REJECTED');
      expect(res.body.data.execution_result).toBeNull();

      const r = await Reservation.findById(id).lean();
      expect(r.status).toBe('confirmed');
      expect(r.pending_refund).toBe(false);
      expect(await Payment.countDocuments({ payment_type: 'refund' })).toBe(0);
    });

    test('a manager cannot decide their own request (403)', async () => {
      const ap = await ApprovalRequest.create({
        request_type: 'DISCOUNT',
        requested_by_staff_id: manager._id,
        reason: 'Own discount',
      });
      const res = await decide(ap._id, { action: 'APPROVE' });
      expect(res.status).toBe(403);
      expectCode(res, 'CANNOT_APPROVE_OWN_REQUEST');
      expect((await ApprovalRequest.findById(ap._id).lean()).status).toBe('PENDING');
    });

    test('a second decision with a new key is 409 RECORD_ALREADY_DECIDED', async () => {
      const { approvalId } = await paidCancellation();
      expect((await decide(approvalId, { action: 'REJECT', manager_comment: 'No' })).status).toBe(200);
      const res = await decide(approvalId, { action: 'REJECT', manager_comment: 'No again' });
      expect(res.status).toBe(409);
      expectCode(res, 'RECORD_ALREADY_DECIDED');
    });

    test('same Idempotency-Key replays the same response and writes one refund', async () => {
      const { approvalId } = await paidCancellation();
      const k = key();
      const body = { action: 'APPROVE', approved_refund_amount: 700 };
      const first = await decide(approvalId, body, k);
      const second = await decide(approvalId, body, k);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(await Payment.countDocuments({ payment_type: 'refund' })).toBe(1);
    });

    test('two simultaneous decisions: exactly one winner and one refund payment', async () => {
      const { approvalId } = await paidCancellation();
      const body = { action: 'APPROVE', approved_refund_amount: 700 };
      const [a, b] = await Promise.all([decide(approvalId, body), decide(approvalId, body)]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(await Payment.countDocuments({ payment_type: 'refund' })).toBe(1);
      expect(await CancellationSettlement.collection.countDocuments({})).toBe(1);
    });
  });

  describe('Append-only settlement', () => {
    test('updateOne and deleteOne on CancellationSettlement still throw', async () => {
      await expect(CancellationSettlement.updateOne({}, { $set: { retained_amount: 1 } })).rejects.toThrow();
      await expect(CancellationSettlement.deleteOne({})).rejects.toThrow();
    });
  });
});
