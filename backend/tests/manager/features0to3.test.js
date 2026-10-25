const request = require('supertest');
const app = require('../../src/app');
const { makeToken } = require('../helpers/managerAuth');
const { Room } = require('../../src/db/models');

describe('Manager Features 0-3 Endpoints', () => {
  let managerToken;
  let receptionistToken;
  let createdStaffId;
  let sampleRoomId;

  beforeAll(async () => {
    const manager = await makeToken('manager');
    managerToken = manager.token;

    const receptionist = await makeToken('receptionist');
    receptionistToken = receptionist.token;

    const sampleRoom = await Room.findOne().lean();
    if (sampleRoom) {
      sampleRoomId = String(sampleRoom._id);
    }
  });

  describe('Phase 1: Staff CRUD & Shifts', () => {
    test('GET /api/v1/manager/staff returns paginated staff list', async () => {
      const res = await request(app)
        .get('/api/v1/manager/staff?include=today_shift,workload')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
    });

    test('POST /api/v1/manager/staff creates staff and returns temporary_password', async () => {
      const uniqueSuffix = Date.now();
      const payload = {
        full_name: 'Ahmed Manager Test',
        email: `ahmed.test.${uniqueSuffix}@hotel.com`,
        phone: '01012345678',
        staff_type: 'RECEPTIONIST',
        hire_date: '2026-10-01',
      };

      const res = await request(app)
        .post('/api/v1/manager/staff')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('staff_id');
      expect(res.body.data).toHaveProperty('temporary_password');
      expect(typeof res.body.data.temporary_password).toBe('string');
      expect(res.body.data.staff_type).toBe('RECEPTIONIST');

      createdStaffId = res.body.data.staff_id;
    });

    test('GET /api/v1/manager/staff/:id returns staff details', async () => {
      const res = await request(app)
        .get(`/api/v1/manager/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.staff_id).toBe(createdStaffId);
      expect(res.body.data.full_name).toBe('Ahmed Manager Test');
    });

    test('PATCH /api/v1/manager/staff/:id updates staff info', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ full_name: 'Ahmed Updated Test', phone: '01099998888' });

      expect(res.status).toBe(200);
      expect(res.body.data.full_name).toBe('Ahmed Updated Test');
      expect(res.body.data.phone).toBe('01099998888');
    });

    test('POST /api/v1/manager/staff/:id/reset-password returns new temporary password', async () => {
      const res = await request(app)
        .post(`/api/v1/manager/staff/${createdStaffId}/reset-password`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('temporary_password');
      expect(typeof res.body.data.temporary_password).toBe('string');
    });

    test('DELETE /api/v1/manager/staff/:id deactivates staff', async () => {
      const res = await request(app)
        .delete(`/api/v1/manager/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(204);

      const check = await request(app)
        .get(`/api/v1/manager/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(check.body.data.is_active).toBe(false);
    });

    test('POST /api/v1/manager/staff/:id/reactivate reactivates staff', async () => {
      const res = await request(app)
        .post(`/api/v1/manager/staff/${createdStaffId}/reactivate`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(true);
    });

    test('GET /api/v1/manager/shifts/overview returns shift coverage', async () => {
      const res = await request(app)
        .get('/api/v1/manager/shifts/overview?business_date=2026-10-25')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.length).toBe(3); // morning, evening, night
      expect(res.body.data[0]).toHaveProperty('shift_type');
      expect(res.body.data[0]).toHaveProperty('start_time');
      expect(res.body.data[0]).toHaveProperty('end_time');
    });

    test('POST /api/v1/manager/shifts schedules a shift for staff', async () => {
      const res = await request(app)
        .post('/api/v1/manager/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          staff_id: createdStaffId,
          business_date: '2026-11-15',
          shift_type: 'MORNING',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('shift_date', '2026-11-15');
      expect(res.body.data).toHaveProperty('shift_type', 'morning');
    });
  });

  describe('Phase 2: Manager Rooms & Activities', () => {
    test('GET /api/v1/manager/rooms returns paginated rooms with contract statuses', async () => {
      const res = await request(app)
        .get('/api/v1/manager/rooms?page=1&limit=50')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      if (res.body.data.length > 0) {
        const room = res.body.data[0];
        expect(room).toHaveProperty('room_number');
        expect(room).toHaveProperty('physical_status');
        expect(room).toHaveProperty('occupancy_status');
        expect(room).toHaveProperty('price_per_night');
      }
    });

    test('GET /api/v1/manager/rooms/:id/activities returns chronological timeline', async () => {
      if (!sampleRoomId) return;

      const res = await request(app)
        .get(`/api/v1/manager/rooms/${sampleRoomId}/activities`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Phase 3: Manager Dashboard Aggregations & Activities', () => {
    test('GET /api/v1/manager/dashboard/overview returns KPIs and room breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/manager/dashboard/overview')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('kpis');
      expect(res.body.data.kpis).toHaveProperty('total_rooms');
      expect(res.body.data.kpis).toHaveProperty('occupancy_rate');
      expect(res.body.data.kpis).toHaveProperty('today_revenue');
      expect(res.body.data).toHaveProperty('room_counts');
      expect(res.body.data).toHaveProperty('floors_occupancy');
      expect(Array.isArray(res.body.data.floors_occupancy)).toBe(true);
    });

    test('GET /api/v1/manager/dashboard/revenue returns series and payment method breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/manager/dashboard/revenue?days=7')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('totals');
      expect(res.body.data).toHaveProperty('series');
      expect(res.body.data).toHaveProperty('by_method');
      expect(Array.isArray(res.body.data.series)).toBe(true);
      expect(Array.isArray(res.body.data.by_method)).toBe(true);
    });

    test('GET /api/v1/manager/dashboard/issues returns critical issues', async () => {
      const res = await request(app)
        .get('/api/v1/manager/dashboard/issues?limit=4')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('GET /api/v1/manager/activities returns hotel activity stream', async () => {
      const res = await request(app)
        .get('/api/v1/manager/activities?limit=10')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('Receptionist cannot access manager dashboard endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/manager/dashboard/overview')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
    });
  });
});
