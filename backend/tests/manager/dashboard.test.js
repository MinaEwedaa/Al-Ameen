// Tests for Manager Feature M11: Dashboard and Activities (documents the current response shapes)

const request = require('supertest');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Room,
  AuditLog,
  CleaningTask,
  MaintenanceIssue,
} = require('../../src/db/models');
const { toPiastres } = require('../../src/utils/money');
const { makeToken } = require('../helpers/managerAuth');

jest.setTimeout(60000);

describe('Manager Feature M11: Dashboard and Activities', () => {
  let mgrToken;
  let recToken;
  const mgrAuth = () => ({ Authorization: `Bearer ${mgrToken}` });
  const recAuth = () => ({ Authorization: `Bearer ${recToken}` });
  const BASE = '/api/v1/manager';

  const mkRoom = (n, floor, status = 'available') =>
    Room.create({
      room_number: String(n),
      room_type: 'double',
      floor,
      price_per_night: toPiastres(1000),
      half_day_price: toPiastres(300),
      status,
    });

  beforeEach(async () => {
    await Promise.all([
      Staff.deleteMany({}),
      Session.deleteMany({}),
      Room.deleteMany({}),
      CleaningTask.deleteMany({}),
      MaintenanceIssue.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);
    mgrToken = (await makeToken('manager')).token;
    recToken = (await makeToken('receptionist')).token;
  });

  describe('access control', () => {
    const paths = [
      '/dashboard/overview',
      '/dashboard/revenue',
      '/dashboard/issues',
      '/activities',
    ];

    test.each(paths)('%s without a token is 401', async (p) => {
      const res = await request(app).get(BASE + p);
      expect(res.status).toBe(401);
    });

    test.each(paths)('%s with a receptionist token is 403', async (p) => {
      const res = await request(app).get(BASE + p).set(recAuth());
      expect(res.status).toBe(403);
    });
  });

  describe('overview', () => {
    test('returns the current shape and consistent counts', async () => {
      await mkRoom(101, 1, 'occupied');
      await mkRoom(102, 1, 'available');
      await mkRoom(201, 2, 'cleaning');
      await mkRoom(202, 2, 'maintenance');

      const res = await request(app).get(`${BASE}/dashboard/overview`).set(mgrAuth());
      expect(res.status).toBe(200);

      const { kpis, room_counts, floors_occupancy } = res.body.data;
      expect(kpis.total_rooms).toBe(4);
      expect(kpis.occupied_rooms).toBe(1);
      expect(kpis.occupancy_rate).toBe(25);
      expect(
        kpis.occupied_rooms + kpis.available_rooms + kpis.cleaning_rooms + kpis.maintenance_rooms
      ).toBe(kpis.total_rooms);
      expect(room_counts.total).toBe(4);
      expect(floors_occupancy).toHaveLength(2);
      expect(floors_occupancy[0]).toMatchObject({ floor: 1, total: 2, occupied: 1 });
    });

    test('works with no rooms', async () => {
      const res = await request(app).get(`${BASE}/dashboard/overview`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.kpis.total_rooms).toBe(0);
      expect(res.body.data.kpis.occupancy_rate).toBe(0);
    });
  });

  describe('revenue', () => {
    test('series length follows days and defaults to 7', async () => {
      const def = await request(app).get(`${BASE}/dashboard/revenue`).set(mgrAuth());
      expect(def.status).toBe(200);
      expect(def.body.data.series).toHaveLength(7);

      const three = await request(app).get(`${BASE}/dashboard/revenue?days=3`).set(mgrAuth());
      expect(three.body.data.series).toHaveLength(3);
    });

    test('days above 90 is capped at 90', async () => {
      const res = await request(app).get(`${BASE}/dashboard/revenue?days=500`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data.series).toHaveLength(90);
    });
  });

  describe('issues', () => {
    test('returns maintenance and cleaning items, respects limit', async () => {
      const room = await mkRoom(101, 1);
      await MaintenanceIssue.create({ room_id: room._id, problem: 'AC broken', priority: 'urgent' });
      await CleaningTask.create({ room_id: room._id, priority: 'high' });

      const res = await request(app).get(`${BASE}/dashboard/issues?limit=10`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].severity).toBe('CRITICAL');
      expect(res.body.data[0].type).toBe('MAINTENANCE');

      const one = await request(app).get(`${BASE}/dashboard/issues?limit=1`).set(mgrAuth());
      expect(one.body.data).toHaveLength(1);
    });
  });

  describe('activities', () => {
    test('respects limit and never exposes details or ip', async () => {
      for (let i = 0; i < 6; i += 1) {
        await AuditLog.collection.insertOne({
          action: 'CHECK_IN',
          entity: 'Reservation',
          entity_id: String(i),
          details: { secret: 'must-not-leak' },
          ip: '10.0.0.9',
          at: new Date(Date.now() - i * 1000),
        });
      }

      const res = await request(app).get(`${BASE}/activities?limit=4`).set(mgrAuth());
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);
      expect(Object.keys(res.body.data[0]).sort()).toEqual(
        ['actor_name', 'category', 'description', 'id', 'timestamp', 'title']
      );
      expect(JSON.stringify(res.body)).not.toContain('10.0.0.9');
      expect(JSON.stringify(res.body)).not.toContain('must-not-leak');
    });
  });
});