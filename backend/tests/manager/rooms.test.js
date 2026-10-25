// Tests for Manager Feature M5: Rooms, Room Types & Housekeeping

const request = require('supertest');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Room,
  RoomType,
  Reservation,
  CleaningTask,
  MaintenanceIssue,
  Notification,
  AuditLog,
} = require('../../src/db/models');
const { hashPassword } = require('../../src/utils/password');
const { signAccess } = require('../../src/modules/auth/auth.service');
const { toPhysical, fromPhysical } = require('../../src/modules/manager/common/room.mapper');
const { toPiastres } = require('../../src/utils/money');

const mongoose = require('mongoose');

describe('Manager Feature M5: Rooms, Room Types and Cleaning', () => {
  let manager, receptionist, housekeeper;
  let managerToken, receptionistToken;
  let singleType, doubleType;
  let room101, room102;

  beforeEach(async () => {
    await Staff.deleteMany({});
    await Session.deleteMany({});
    await Room.deleteMany({});
    await RoomType.deleteMany({});
    await Reservation.deleteMany({});
    await CleaningTask.deleteMany({});
    await MaintenanceIssue.deleteMany({});
    await Notification.deleteMany({});
    try { await AuditLog.collection.deleteMany({}); } catch {}

    const pwdHash = await hashPassword('Password123');

    manager = await Staff.create({
      username: 'manager_rooms',
      password_hash: pwdHash,
      name: 'Manager User',
      role: 'manager',
      active: true,
      email: 'mgr@hotel.com',
    });

    receptionist = await Staff.create({
      username: 'rec_rooms',
      password_hash: pwdHash,
      name: 'Rec User',
      role: 'receptionist',
      default_shift_type: 'morning',
      active: true,
      email: 'rec@hotel.com',
    });

    housekeeper = await Staff.create({
      username: 'hk_rooms',
      password_hash: pwdHash,
      name: 'Hassan Cleaner',
      role: 'housekeeper',
      active: true,
    });

    const mSession = await Session.create({
      staff_id: manager._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    managerToken = signAccess({ staffId: manager._id, sessionId: mSession._id, role: 'manager' });

    const rSession = await Session.create({
      staff_id: receptionist._id,
      refresh_hash: 'dummy_hash',
      expires_at: new Date(Date.now() + 86400e3),
      last_seen_at: new Date(),
    });
    receptionistToken = signAccess({ staffId: receptionist._id, sessionId: rSession._id, role: 'receptionist' });

    singleType = await RoomType.create({
      name: 'Single Standard',
      description: 'Single bed room',
      base_price: 500,
      capacity: 1,
      amenities: ['wifi', 'tv'],
      is_active: true,
    });

    doubleType = await RoomType.create({
      name: 'Deluxe Suite',
      description: 'Double king bed',
      base_price: 1200,
      capacity: 2,
      amenities: ['wifi', 'tv', 'balcony'],
      is_active: true,
    });

    room101 = await Room.create({
      room_number: '101',
      room_type: 'Single Standard',
      room_type_id: singleType._id,
      floor: 1,
      price_per_night: toPiastres(550),
      half_day_price: toPiastres(300),
      status: 'available',
      inspected: true,
    });

    room102 = await Room.create({
      room_number: '102',
      room_type: 'Deluxe Suite',
      room_type_id: doubleType._id,
      floor: 1,
      price_per_night: toPiastres(1250),
      half_day_price: toPiastres(700),
      status: 'cleaning',
      inspected: false,
    });
  });

  describe('1. Room Mapper', () => {
    it('correctly maps between DB status/inspected and Contract physical status', () => {
      expect(toPhysical({ status: 'available', inspected: false })).toBe('CLEAN');
      expect(toPhysical({ status: 'available', inspected: true })).toBe('INSPECTED');
      expect(toPhysical({ status: 'cleaning', inspected: false })).toBe('DIRTY');
      expect(toPhysical({ status: 'maintenance', inspected: false })).toBe('MAINTENANCE');
      expect(toPhysical({ status: 'out_of_service', inspected: false })).toBe('OUT_OF_SERVICE');

      expect(fromPhysical('CLEAN')).toEqual({ status: 'available', inspected: false });
      expect(fromPhysical('INSPECTED')).toEqual({ status: 'available', inspected: true });
      expect(fromPhysical('DIRTY')).toEqual({ status: 'cleaning', inspected: false });
      expect(fromPhysical('MAINTENANCE')).toEqual({ status: 'maintenance', inspected: false });
      expect(fromPhysical('OUT_OF_SERVICE')).toEqual({ status: 'out_of_service', inspected: false });
    });
  });

  describe('2. Room Types CRUD', () => {
    it('creates room type and rejects duplicate name with 409 NAME_ALREADY_EXISTS', async () => {
      const res = await request(app)
        .post('/api/v1/manager/room-types')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Executive Villa',
          base_price: 3500,
          capacity: 4,
          description: 'Spacious villa',
          amenities: ['pool', 'wifi', 'balcony'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Executive Villa');
      expect(res.body.data.base_price).toBe(3500);

      // Duplicate name
      const dup = await request(app)
        .post('/api/v1/manager/room-types')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Executive Villa',
          base_price: 4000,
          capacity: 2,
        });

      expect(dup.status).toBe(409);
      expect(dup.body.error?.code || dup.body.code).toBe('NAME_ALREADY_EXISTS');
    });

    it('lists room types with aggregated rooms_count, price_min, and price_max', async () => {
      const res = await request(app)
        .get('/api/v1/manager/room-types')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);

      const s = res.body.data.find((t) => t.id === String(singleType._id));
      expect(s.rooms_count).toBe(1);
      expect(s.price_min).toBe(550);
      expect(s.price_max).toBe(550);
    });

    it('patches room type and renames Room.room_type across rooms in a transaction', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/room-types/${singleType._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Single Premium' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Single Premium');

      // Verify rooms updated
      const updatedRoom = await Room.findById(room101._id);
      expect(updatedRoom.room_type).toBe('Single Premium');
    });
  });

  describe('3. Rooms Management', () => {
    it('lists rooms with physical and occupancy statuses', async () => {
      const res = await request(app)
        .get('/api/v1/manager/rooms')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);

      const r101 = res.body.data.find((r) => r.room_number === '101');
      expect(r101.physical_status).toBe('INSPECTED');
      expect(r101.occupancy_status).toBe('VACANT');

      const r102 = res.body.data.find((r) => r.room_number === '102');
      expect(r102.physical_status).toBe('DIRTY');
    });

    it('patches room price and physical status', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/rooms/${room101._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          price_per_night: 600,
          physical_status: 'DIRTY',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.price_per_night).toBe(600);
      expect(res.body.data.physical_status).toBe('DIRTY');

      const r = await Room.findById(room101._id);
      expect(r.price_per_night).toBe(toPiastres(600));
      expect(r.status).toBe('cleaning');
      expect(r.inspected).toBe(false);
    });

    it('rejects changing physical status of an occupied room with 409 CONFLICT', async () => {
      // Create checked-in reservation
      await Reservation.create({
        guest_id: new mongoose.Types.ObjectId(),
        room_id: room101._id,
        check_in_at: new Date(),
        check_out_at: new Date(Date.now() + 86400e3),
        nights: 1,
        status: 'checked_in',
        price_per_night_snapshot: 55000,
        half_day_price_snapshot: 30000,
        total_amount: 55000,
      });

      const res = await request(app)
        .patch(`/api/v1/manager/rooms/${room101._id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ physical_status: 'OUT_OF_SERVICE' });

      expect(res.status).toBe(409);
    });
  });

  describe('4. Room Activities Timeline', () => {
    it('aggregates activities from cleaning tasks, maintenance, and reservations', async () => {
      await CleaningTask.create({
        room_id: room101._id,
        priority: 'high',
        status: 'done',
        notes: 'Deep cleaned',
        cleaner_name: 'Hassan',
        createdAt: new Date(Date.now() - 3600e3),
      });

      await MaintenanceIssue.create({
        room_id: room101._id,
        problem: 'Leaking pipe',
        priority: 'urgent',
        status: 'open',
        created_at: new Date(Date.now() - 7200e3),
      });

      const res = await request(app)
        .get(`/api/v1/manager/rooms/${room101._id}/activities`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data[0].type).toBe('CLEANING');
      expect(res.body.data[1].type).toBe('MAINTENANCE');
    });
  });

  describe('5. Housekeeping Tasks', () => {
    let task;

    beforeEach(async () => {
      task = await CleaningTask.create({
        room_id: room101._id,
        priority: 'medium',
        status: 'pending',
        notes: 'Daily clean',
      });
    });

    it('lists housekeeping tasks with priority mapped to Contract values', async () => {
      const res = await request(app)
        .get('/api/v1/manager/housekeeping-tasks')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].priority).toBe('NORMAL');
      expect(res.body.data[0].status).toBe('PENDING');
      expect(res.body.data[0].room_number).toBe('101');
    });

    it('assigns task to a housekeeper and escalates priority to RUSH', async () => {
      const res = await request(app)
        .patch(`/api/v1/manager/housekeeping-tasks/${task._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          assigned_to_staff_id: String(housekeeper._id),
          priority: 'RUSH',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.priority).toBe('RUSH');
      expect(res.body.data.cleaner_name).toBe(housekeeper.name);

      const updated = await CleaningTask.findById(task._id);
      expect(updated.cleaner_name).toBe(housekeeper.name);
      expect(updated.priority).toBe('urgent');
    });

    it('rejects lowering priority with 422 INVALID_STATUS_TRANSITION', async () => {
      // Escalated to urgent
      await CleaningTask.updateOne({ _id: task._id }, { priority: 'urgent' });

      const res = await request(app)
        .patch(`/api/v1/manager/housekeeping-tasks/${task._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ priority: 'LOW' });

      expect(res.status).toBe(422);
      expect(res.body.error?.code || res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects assigning a completed task with 422 INVALID_STATUS_TRANSITION', async () => {
      await CleaningTask.updateOne({ _id: task._id }, { status: 'done' });

      const res = await request(app)
        .patch(`/api/v1/manager/housekeeping-tasks/${task._id}/assign`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ priority: 'RUSH' });

      expect(res.status).toBe(422);
    });
  });

  describe('6. Access Control', () => {
    it('returns 403 when receptionist accesses manager room endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/manager/room-types')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/manager/rooms');
      expect(res.status).toBe(401);
    });
  });
});
