const request = require('supertest');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const argon2 = require('argon2');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  Staff,
  Shift,
  Attendance,
  Session,
  Room,
  RoomNight,
  Reservation,
  Payment,
  Guest,
  CleaningTask,
  MaintenanceIssue,
  ShiftReport,
  RoomStatusHistory,
  AuditLog,
} = require('../src/db/models');
const { ZONE } = require('../src/utils/time');
const { toPiastres } = require('../src/utils/money');

describe('Feature 12: Security Hardening (tests/security.test.js)', () => {
  const password = 'Password123';
  const today = '2026-10-18';
  const Cairo13 = DateTime.fromISO(`${today}T13:00:00`, { zone: ZONE }).toISO();
  const dummyId = new mongoose.Types.ObjectId().toString();

  let token;
  let receptionist;
  let shift;

  let otherToken;
  let otherReceptionist;

  let managerToken;
  let managerStaff;

  const auth = (t = token) => ({
    Authorization: `Bearer ${t}`,
  });

  beforeAll(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Shift.deleteMany({}),
      Attendance.deleteMany({}),
      Session.deleteMany({}),
      Room.deleteMany({}),
      RoomNight.deleteMany({}),
      Reservation.deleteMany({}),
      Payment.collection.deleteMany({}),
      Guest.deleteMany({}),
      CleaningTask.deleteMany({}),
      MaintenanceIssue.deleteMany({}),
      ShiftReport.deleteMany({}),
      RoomStatusHistory.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);

    const passwordHash = await argon2.hash(password);

    receptionist = await Staff.create({
      username: 'sec_receptionist',
      name: 'Security Receptionist',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'receptionist',
      active: true,
    });

    otherReceptionist = await Staff.create({
      username: 'sec_other_rec',
      name: 'Other Receptionist',
      password_hash: passwordHash,
      default_shift_type: 'evening',
      role: 'receptionist',
      active: true,
    });

    managerStaff = await Staff.create({
      username: 'sec_manager',
      name: 'Security Manager',
      password_hash: passwordHash,
      default_shift_type: 'morning',
      role: 'manager',
      active: true,
    });

    // Login receptionist
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-time', Cairo13)
      .send({ username: 'sec_receptionist', password });

    expect(loginRes.status).toBe(200);
    token = loginRes.body.access_token;
    shift = loginRes.body.shift;

    // Create session and token for other receptionist
    const otherSession = await Session.create({
      staff_id: otherReceptionist._id,
      refresh_hash: crypto.randomBytes(32).toString('hex'),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000),
    });
    otherToken = jwt.sign(
      { sub: String(otherReceptionist._id), sid: String(otherSession._id), role: otherReceptionist.role },
      env.jwtSecret,
      { expiresIn: '15m' }
    );

    // Create session and token for manager
    const managerSession = await Session.create({
      staff_id: managerStaff._id,
      refresh_hash: crypto.randomBytes(32).toString('hex'),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000),
    });
    managerToken = jwt.sign(
      { sub: String(managerStaff._id), sid: String(managerSession._id), role: managerStaff.role },
      env.jwtSecret,
      { expiresIn: '15m' }
    );
  });

  describe('1. OpenAPI Route Auth Loop (Every route except /auth/login and /auth/refresh requires token)', () => {
    const specPath = path.resolve(__dirname, '../openapi/staff-management-api.yaml');
    const specDoc = yaml.load(fs.readFileSync(specPath, 'utf8'));
    const routesToTest = [];

    for (const [routePath, methods] of Object.entries(specDoc.paths)) {
      for (const method of Object.keys(methods)) {
        if (['post', 'get', 'patch', 'delete', 'put'].includes(method.toLowerCase())) {
          // Skip public endpoints
          if (routePath === '/auth/login' || routePath === '/auth/refresh') continue;

          // Replace URL params like {guest_id} with dummyId
          const resolvedPath = '/api/v1' + routePath.replace(/\{[^}]+\}/g, dummyId);
          routesToTest.push({ method: method.toLowerCase(), routePath, resolvedPath });
        }
      }
    }

    const getDummyBody = (routePath, method) => {
      const p = routePath.toLowerCase();
      const m = method.toLowerCase();
      if (p.includes('/cleaning-tasks')) {
        if (m === 'post') return { room_id: dummyId, priority: 'medium' };
        if (m === 'patch') return { priority: 'low' };
      }
      if (p.includes('/maintenance-issues')) {
        if (m === 'post') return { room_id: dummyId, problem: 'مشكلة فحص', priority: 'low' };
        if (m === 'patch') return { priority: 'urgent' };
      }
      if (p.includes('/reservations')) {
        if (m === 'post' && !p.includes('/check-in') && !p.includes('/extend') && !p.includes('/check-out') && !p.includes('/cancel')) {
          return { guest_id: dummyId, room_id: dummyId, check_in: '2026-10-25T12:00:00.000Z', check_out: '2026-10-26T12:00:00.000Z' };
        }
        if (m === 'patch') return { check_out: '2026-10-27T12:00:00.000Z' };
      }
      if (p.includes('/payments') && m === 'post') {
        return { reservation_id: dummyId, amount: 100, payment_method: 'cash' };
      }
      if (p.includes('/guests') && m === 'post') {
        return { name: 'علي حسن', phone: '01012345678', id_number: '29801011234567' };
      }
      if (p.includes('/status') && m === 'patch') {
        return { status: 'cleaning' };
      }
      if (p.includes('/handover') && m === 'patch') {
        return { shift_notes: 'notes' };
      }
      return {};
    };

    test.each(routesToTest)(
      '$method $routePath returns 401 when accessed without token',
      async ({ method, routePath, resolvedPath }) => {
        const req = request(app)[method](resolvedPath)
          .set('Idempotency-Key', crypto.randomUUID());
        if (routePath === '/rooms/availability') {
          req.query({ check_in: '2026-10-25T12:00:00.000Z', check_out: '2026-10-26T12:00:00.000Z' });
        }
        if (['post', 'patch', 'put'].includes(method)) {
          req.send(getDummyBody(routePath, method));
        }
        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    );
  });

  describe('2. Role-Based Access Control', () => {
    test('manager token accessing receptionist routes returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/v1/cleaning-tasks')
        .set(auth(managerToken))
        .send({ room_id: dummyId, priority: 'medium' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('manager cannot log into receptionist login endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', Cairo13)
        .send({ username: 'sec_manager', password });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. NoSQL Injection & Query Parameter Tampering', () => {
    test('?status[$ne]=x query injection returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/rooms?status[%24ne]=x')
        .set(auth());

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('?room_type[$regex]=.* regex injection returns 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/rooms?room_type[%24regex]=.*')
        .set(auth());

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('4. Request Body Limit (>100KB payload returns 413)', () => {
    test('body larger than 100KB returns 413 PAYLOAD_TOO_LARGE', async () => {
      const largePayload = {
        username: 'sec_receptionist',
        password,
        blob: 'A'.repeat(110 * 1024),
      };

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(largePayload);

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('5. CORS Hardening', () => {
    test('disallowed origin receives no Access-Control-Allow-Origin header', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://unauthorized-attacker-site.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('allowed origin receives exact Access-Control-Allow-Origin header with credentials', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('6. Security Headers (Helmet, HSTS, CSP, X-Powered-By disabled)', () => {
    test('responses contain security headers and disable X-Powered-By', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    });
  });

  describe('7. Object-Level Authorization (Shift Reports & Payments)', () => {
    test('staff member requesting a shift report that is not theirs receives 404', async () => {
      const passwordHash = await argon2.hash(password);
      const hoStaff = await Staff.create({
        username: 'sec_ho_staff',
        name: 'Handover Staff',
        password_hash: passwordHash,
        default_shift_type: 'morning',
        role: 'receptionist',
        active: true,
      });

      const hoLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', DateTime.fromISO('2026-10-25T13:00:00', { zone: ZONE }).toISO())
        .send({ username: 'sec_ho_staff', password });
      expect(hoLogin.status).toBe(200);

      // Handover shift for hoStaff
      await request(app)
        .patch('/api/v1/shifts/current/handover')
        .set(auth(hoLogin.body.access_token))
        .set('x-test-time', DateTime.fromISO('2026-10-25T13:00:00', { zone: ZONE }).toISO())
        .send({ shift_notes: 'Handover complete' });

      // other receptionist attempts to get hoStaff report
      const res = await request(app)
        .get(`/api/v1/shifts/${hoLogin.body.shift.shift_id}/report`)
        .set(auth(otherToken))
        .set('x-test-time', DateTime.fromISO('2026-10-25T13:00:00', { zone: ZONE }).toISO());

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('8. Mass Assignment Protection', () => {
    test('client-provided staff_id, shift_id, and total_amount are stripped/ignored in POST /reservations', async () => {
      const room = await Room.create({
        room_number: '901',
        room_type: 'suite',
        floor: 9,
        price_per_night: toPiastres(1500),
        half_day_price: toPiastres(600),
        status: 'available',
      });

      const guest = await Guest.create({
        name: 'Mass Assignment Test Guest',
        name_search: 'mass assignment test guest',
        phone: '+201012345678',
        id_number_enc: 'enc',
        id_number_hash: crypto.randomBytes(32).toString('hex'),
        id_number_last4: '5678',
      });

      const maliciousPayload = {
        guest_id: String(guest._id),
        room_id: String(room._id),
        check_in: '2026-10-18T12:00:00.000Z',
        check_out: '2026-10-20T12:00:00.000Z',
        staff_id: dummyId, // Attacker tries to impersonate another staff
        shift_id: dummyId, // Attacker tries to attribute to another shift
        total_amount: 10,   // Attacker tries to set price to 10 piastres instead of 3000 EGP
      };

      const res = await request(app)
        .post('/api/v1/reservations')
        .set(auth(token))
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send(maliciousPayload);

      expect(res.status).toBe(201);
      // Total amount should be calculated: 2 nights * 1500 EGP = 3000 EGP = 300000 piastres
      expect(res.body.total_amount).toBe(3000);
      expect(res.body.total_amount).not.toBe(10);

      const dbRes = await Reservation.findById(res.body.reservation_id);
      expect(dbRes.total_amount).toBe(300000);
    });

    test('client-provided staff_id and shift_id are ignored in POST /payments', async () => {
      const room = await Room.create({
        room_number: '902',
        room_type: 'deluxe',
        floor: 9,
        price_per_night: toPiastres(1000),
        half_day_price: toPiastres(400),
        status: 'available',
      });

      const guest = await Guest.create({
        name: 'Payment Mass Assignment Guest',
        name_search: 'payment mass assignment guest',
        phone: '+201012345679',
        id_number_enc: 'enc',
        id_number_hash: crypto.randomBytes(32).toString('hex'),
        id_number_last4: '5679',
      });

      const resCreate = await request(app)
        .post('/api/v1/reservations')
        .set(auth(token))
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send({
          guest_id: String(guest._id),
          room_id: String(room._id),
          check_in: '2026-10-18T12:00:00.000Z',
          check_out: '2026-10-19T12:00:00.000Z',
        });
      expect(resCreate.status).toBe(201);

      const resPayment = await request(app)
        .post('/api/v1/payments')
        .set(auth(token))
        .set('Idempotency-Key', crypto.randomUUID())
        .set('x-test-time', Cairo13)
        .send({
          reservation_id: resCreate.body.reservation_id,
          amount: 500,
          payment_method: 'cash',
          staff_id: dummyId, // malicious override
          shift_id: dummyId, // malicious override
          payment_verified: true, // malicious override
        });

      expect(resPayment.status).toBe(201);
      expect(resPayment.body.payment.staff_id).toBe(String(receptionist._id));
      expect(resPayment.body.payment.shift_id).toBe(String(shift.shift_id));
      expect(resPayment.body.payment.payment_verified).toBe(false);
    });
  });

  describe('9. E2E Response Data Leakage Scanner', () => {
    test('all responses across typical workflow are free of password_hash, id_number_enc, id_number_hash, and stack traces', async () => {
      const responses = [];

      // A. Login
      const r1 = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-time', DateTime.fromISO('2026-10-21T13:00:00', { zone: ZONE }).toISO())
        .send({ username: 'sec_receptionist', password });
      responses.push(r1);
      const activeToken = r1.status === 200 ? r1.body.access_token : token;

      // B. Create Guest
      const r2 = await request(app)
        .post('/api/v1/guests')
        .set(auth(activeToken))
        .set('x-test-time', DateTime.fromISO('2026-10-21T13:00:00', { zone: ZONE }).toISO())
        .send({
          name: 'عميل الفحص الأمني',
          phone: '01012349999',
          id_number: '29901011234567',
        });
      responses.push(r2);

      // C. Get Guests search
      const r3 = await request(app)
        .get('/api/v1/guests?name=الفحص')
        .set(auth(activeToken))
        .set('x-test-time', DateTime.fromISO('2026-10-21T13:00:00', { zone: ZONE }).toISO());
      responses.push(r3);

      // D. Get Rooms
      const r4 = await request(app)
        .get('/api/v1/rooms')
        .set(auth(activeToken))
        .set('x-test-time', DateTime.fromISO('2026-10-21T13:00:00', { zone: ZONE }).toISO());
      responses.push(r4);

      // E. Invalid request (500/400 test)
      const r5 = await request(app)
        .get('/api/v1/rooms/invalid-id')
        .set(auth(activeToken))
        .set('x-test-time', DateTime.fromISO('2026-10-21T13:00:00', { zone: ZONE }).toISO());
      responses.push(r5);

      // Verify each response
      const sensitiveKeys = [
        'password_hash',
        'id_number_enc',
        'id_number_hash',
        'node_modules',
        'MongoError',
      ];

      for (const res of responses) {
        const bodyStr = JSON.stringify(res.body);
        for (const key of sensitiveKeys) {
          expect(bodyStr).not.toContain(key);
        }
        // Ensure no raw stack traces in error responses
        if (res.body && res.body.error) {
          expect(res.body.error).not.toHaveProperty('stack');
        }
      }
    });
  });

  describe('10. Unknown Routes Return Unified 404 Error', () => {
    test('unmapped path returns 404 with unified JSON format', async () => {
      const res = await request(app).get('/api/v1/non-existent-security-check');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: { code: 'NOT_FOUND', message: 'Not found' },
      });
    });
  });
});
