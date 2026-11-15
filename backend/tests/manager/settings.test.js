// Tests for Manager Feature M12: Hotel Settings, Shift Settings and Search

const request = require('supertest');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const app = require('../../src/app');
const {
  Staff,
  Session,
  Shift,
  ShiftSchedule,
  Room,
  Setting,
  ShiftReport,
  AuditLog,
} = require('../../src/db/models');
const { makeToken } = require('../helpers/managerAuth');
const {
  ZONE,
  todayCairo,
  shiftWindow,
  validateHours,
  setShiftHours,
  getShiftHours,
} = require('../../src/utils/time');
const { toPiastres } = require('../../src/utils/money');
const { blindIndex, encrypt, normalizeIdNumber } = require('../../src/utils/crypto');

jest.setTimeout(60000);

describe('Manager Feature M12: Hotel Settings, Shift Settings & Universal Search', () => {
  let managerToken;
  let managerStaff;
  let receptionistToken;
  let receptionistStaff;

  const mgrAuth = () => ({ Authorization: `Bearer ${managerToken}` });
  const recAuth = () => ({ Authorization: `Bearer ${receptionistToken}` });

  beforeAll(async () => {
    const mgr = await makeToken('manager');
    managerToken = mgr.token;
    managerStaff = mgr.staff;

    const rec = await makeToken('receptionist');
    receptionistToken = rec.token;
    receptionistStaff = rec.staff;
  });

  beforeEach(async () => {
    // Reset shift hours to standard default
    setShiftHours({
      morning: { start: 7, end: 16 },
      evening: { start: 16, end: 23 },
      night: { start: 23, end: 7 },
    });

    await Promise.all([
      Staff.deleteMany({ _id: { $nin: [managerStaff._id, receptionistStaff._id] } }),
      Room.deleteMany({}),
      Setting.deleteMany({}),
      ShiftSchedule.deleteMany({}),
      ShiftReport.deleteMany({}),
      AuditLog.collection.deleteMany({}),
    ]);
  });

  describe('1. validateHours Unit Tests', () => {
    it('accepts standard default shift hours covering 24h', () => {
      const standard = {
        morning: { start: 7, end: 16 },
        evening: { start: 16, end: 23 },
        night: { start: 23, end: 7 },
      };
      expect(validateHours(standard)).toBe(true);
    });

    it('rejects shift set with a gap', () => {
      const withGap = {
        morning: { start: 7, end: 15 }, // gap between 15 and 16
        evening: { start: 16, end: 23 },
        night: { start: 23, end: 7 },
      };
      expect(validateHours(withGap)).toBe(false);
    });

    it('rejects shift set with an overlap', () => {
      const withOverlap = {
        morning: { start: 7, end: 17 }, // overlap: morning ends 17, evening starts 16
        evening: { start: 16, end: 23 },
        night: { start: 23, end: 7 },
      };
      expect(validateHours(withOverlap)).toBe(false);
    });

    it('rejects equal start and end', () => {
      const equalTimes = {
        morning: { start: 8, end: 8 },
        evening: { start: 8, end: 20 },
        night: { start: 20, end: 8 },
      };
      expect(validateHours(equalTimes)).toBe(false);
    });

    it('rejects non-integer hours', () => {
      const nonInt = {
        morning: { start: 7.5, end: 16 },
        evening: { start: 16, end: 23 },
        night: { start: 23, end: 7.5 },
      };
      expect(validateHours(nonInt)).toBe(false);
    });

    it('rejects shift set that does not sum to 24 hours', () => {
      const shortSet = {
        morning: { start: 8, end: 14 },
        evening: { start: 14, end: 20 },
        night: { start: 20, end: 2 }, // only 18 hours total
      };
      expect(validateHours(shortSet)).toBe(false);
    });
  });

  describe('2. Hotel Settings Endpoints (GET & PATCH /hotel-settings)', () => {
    beforeEach(async () => {
      await Setting.create({
        key: 'hotel',
        value: {
          name: 'Al-Amin Grand Hotel',
          location: 'Alexandria Corniche',
          count_floors: 6,
          floors_count: 6,
        },
      });

      await Room.create([
        {
          room_number: '101',
          floor: 1,
          room_type: 'deluxe',
          price_per_night: toPiastres(1200),
          half_day_price: toPiastres(400),
          status: 'available',
        },
        {
          room_number: '405',
          floor: 4,
          room_type: 'suite',
          price_per_night: toPiastres(2500),
          half_day_price: toPiastres(800),
          status: 'available',
        },
      ]);
    });

    it('GET /hotel-settings returns current hotel metadata and total rooms count', async () => {
      const res = await request(app)
        .get('/api/v1/manager/hotel-settings')
        .set(mgrAuth());

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        name: 'Al-Amin Grand Hotel',
        location: 'Alexandria Corniche',
        floors_count: 6,
        total_rooms: 2,
      });
      expect(res.body.data).toHaveProperty('updated_at');
    });

    it('PATCH /hotel-settings rejects floors_count lower than highest room floor with 400 VALIDATION_ERROR', async () => {
      // Highest room floor is 4
      const res = await request(app)
        .patch('/api/v1/manager/hotel-settings')
        .set(mgrAuth())
        .send({ floors_count: 3 });

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('VALIDATION_ERROR');
      expect(res.text).toContain('highest room floor');
    });

    it('PATCH /hotel-settings successfully updates settings and creates audit log with diff', async () => {
      const res = await request(app)
        .patch('/api/v1/manager/hotel-settings')
        .set(mgrAuth())
        .send({
          name: 'Al-Amin Royal Hotel',
          location: 'Cairo Downtown',
          floors_count: 8,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Al-Amin Royal Hotel');
      expect(res.body.data.location).toBe('Cairo Downtown');
      expect(res.body.data.floors_count).toBe(8);
      expect(res.body.data.total_rooms).toBe(2);

      // Verify audit log
      const auditEntry = await AuditLog.findOne({ action: 'UPDATED_HOTEL_SETTINGS' });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry.actor_staff_id.toString()).toBe(managerStaff._id.toString());
      expect(auditEntry.details?.before?.name).toBe('Al-Amin Grand Hotel');
      expect(auditEntry.details?.after?.name).toBe('Al-Amin Royal Hotel');
    });

    it('PATCH /hotel-settings rejects empty body with 400', async () => {
      const res = await request(app)
        .patch('/api/v1/manager/hotel-settings')
        .set(mgrAuth())
        .send({});

      expect(res.status).toBe(400);
    });

    it('rejects receptionist token with 403', async () => {
      const res = await request(app)
        .get('/api/v1/manager/hotel-settings')
        .set(recAuth());

      expect(res.status).toBe(403);
    });
  });

  describe('3. Shift Settings Endpoints (GET & PATCH /shift-settings)', () => {
    it('GET /shift-settings returns current active shift hours', async () => {
      const res = await request(app)
        .get('/api/v1/manager/shift-settings')
        .set(mgrAuth());

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        morning: { start: 7, end: 16 },
        evening: { start: 16, end: 23 },
        night: { start: 23, end: 7 },
      });
    });

    it('PATCH /shift-settings validates shifts and updates future scheduled shifts with untouched standard window', async () => {
      const today = todayCairo();
      const futureDate = DateTime.now().setZone(ZONE).plus({ days: 3 }).toISODate();
      const oldHours = getShiftHours();

      // Standard future shift (matches old standard morning 7 to 16)
      const standardWin = shiftWindow(futureDate, 'morning', oldHours);
      const standardShift = await ShiftSchedule.create({
        staff_id: receptionistStaff._id,
        shift_date: futureDate,
        shift_type: 'morning',
        start_at: standardWin.start_at,
        end_at: standardWin.end_at,
        status: 'SCHEDULED',
      });

      // Custom/manual future shift (manually chosen times: e.g. 9 to 15)
      const manualStart = DateTime.fromISO(futureDate, { zone: ZONE }).set({ hour: 9 }).toUTC().toJSDate();
      const manualEnd = DateTime.fromISO(futureDate, { zone: ZONE }).set({ hour: 15 }).toUTC().toJSDate();
      const customShift = await ShiftSchedule.create({
        staff_id: managerStaff._id,
        shift_date: futureDate,
        shift_type: 'morning',
        start_at: manualStart,
        end_at: manualEnd,
        status: 'SCHEDULED',
      });

      // New hours: morning 8 to 16, evening 16 to 24 (0), night 0 to 8
      const newHours = {
        morning: { start: 8, end: 16 },
        evening: { start: 16, end: 0 },
        night: { start: 0, end: 8 },
      };

      const res = await request(app)
        .patch('/api/v1/manager/shift-settings')
        .set(mgrAuth())
        .send({
          ...newHours,
          apply_to_future: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.morning).toEqual({ start: 8, end: 16 });
      expect(res.body.data.updated_future_shifts).toBe(1);

      // Verify in-memory updated shiftWindow
      const updatedWin = shiftWindow(futureDate, 'morning');
      const startCairoHour = DateTime.fromJSDate(updatedWin.start_at, { zone: ZONE }).hour;
      expect(startCairoHour).toBe(8);

      // Verify database updated standard shift
      const reloadedStandard = await ShiftSchedule.findById(standardShift._id);
      const reloadedStartHour = DateTime.fromJSDate(reloadedStandard.start_at, { zone: ZONE }).hour;
      expect(reloadedStartHour).toBe(8);

      // Verify custom shift was untouched
      const reloadedCustom = await ShiftSchedule.findById(customShift._id);
      expect(new Date(reloadedCustom.start_at).getTime()).toBe(manualStart.getTime());

      // Verify audit log
      const audit = await AuditLog.findOne({ action: 'UPDATED_SHIFT_SETTINGS' });
      expect(audit).not.toBeNull();
      expect(audit.details?.updated_future_shifts).toBe(1);
    });

    it('PATCH /shift-settings with apply_to_future: false does not touch future shifts', async () => {
      const futureDate = DateTime.now().setZone(ZONE).plus({ days: 4 }).toISODate();
      const oldHours = getShiftHours();
      const standardWin = shiftWindow(futureDate, 'morning', oldHours);

      const shiftRow = await ShiftSchedule.create({
        staff_id: receptionistStaff._id,
        shift_date: futureDate,
        shift_type: 'morning',
        start_at: standardWin.start_at,
        end_at: standardWin.end_at,
        status: 'SCHEDULED',
      });

      const res = await request(app)
        .patch('/api/v1/manager/shift-settings')
        .set(mgrAuth())
        .send({
          morning: { start: 6, end: 15 },
          evening: { start: 15, end: 23 },
          night: { start: 23, end: 6 },
          apply_to_future: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.updated_future_shifts).toBe(0);

      const reloaded = await ShiftSchedule.findById(shiftRow._id);
      expect(new Date(reloaded.start_at).getTime()).toBe(standardWin.start_at.getTime());
    });

    it('PATCH /shift-settings rejects gap or invalid configuration with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch('/api/v1/manager/shift-settings')
        .set(mgrAuth())
        .send({
          morning: { start: 7, end: 15 }, // gap
          evening: { start: 16, end: 23 },
          night: { start: 23, end: 7 },
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('4. Universal Search (GET /search?q=)', () => {
    let testStaff14;

    beforeEach(async () => {
      // Seed Rooms
      await Room.create([
        {
          room_number: '201',
          floor: 2,
          room_type: 'Single Standard',
          price_per_night: toPiastres(800),
          half_day_price: toPiastres(300),
          status: 'available',
        },
        {
          room_number: '202',
          floor: 2,
          room_type: 'Double Deluxe Sea View',
          price_per_night: toPiastres(1500),
          half_day_price: toPiastres(500),
          status: 'available',
        },
      ]);

      // Seed Staff with 14-digit Egyptian National ID
      const nationalId14 = '29810151234567';
      const normalized = normalizeIdNumber(nationalId14);
      const hash14 = blindIndex(normalized);

      testStaff14 = await Staff.create({
        username: 'mahmoud_ali',
        password_hash: 'argon2id$v=19$m=65536,t=3,p=4$dummyhash',
        name: 'محمود علي عبد الله',
        name_search: 'محمود علي عبد الله',
        role: 'receptionist',
        department: 'Front Office',
        active: true,
        id_number_enc: encrypt(normalized),
        id_number_hash: hash14,
        id_number_last4: '4567',
      });

      // Seed Shift Report
      await ShiftReport.create({
        shift_id: new mongoose.Types.ObjectId(),
        shift_date: '2026-10-18',
        shift_type: 'morning',
        staff_id: testStaff14._id,
        staff_name: 'محمود علي عبد الله',
        review_status: 'APPROVED',
      });
    });

    it('returns 400 when query is less than 2 characters', async () => {
      const res = await request(app)
        .get('/api/v1/manager/search?q=a')
        .set(mgrAuth());

      expect(res.status).toBe(400);
      expect(res.body.error?.code || res.body.code).toBe('VALIDATION_ERROR');
    });

    it('matches rooms by prefix and room type', async () => {
      const resPrefix = await request(app)
        .get('/api/v1/manager/search?q=20')
        .set(mgrAuth());

      expect(resPrefix.status).toBe(200);
      expect(resPrefix.body.data.rooms.length).toBeGreaterThanOrEqual(2);
      expect(resPrefix.body.data.rooms[0]).toHaveProperty('physical_status');
      expect(resPrefix.body.data.rooms[0]).toHaveProperty('occupancy_status');

      const resType = await request(app)
        .get('/api/v1/manager/search?q=Sea View')
        .set(mgrAuth());

      expect(resType.status).toBe(200);
      expect(resType.body.data.rooms.some((r) => r.room_number === '202')).toBe(true);
    });

    it('matches staff by Arabic name and username prefix', async () => {
      const resArabic = await request(app)
        .get('/api/v1/manager/search?q=محمود')
        .set(mgrAuth());

      expect(resArabic.status).toBe(200);
      expect(resArabic.body.data.staff.length).toBeGreaterThanOrEqual(1);
      expect(resArabic.body.data.staff[0].full_name).toContain('محمود');

      const resUser = await request(app)
        .get('/api/v1/manager/search?q=mahmoud')
        .set(mgrAuth());

      expect(resUser.status).toBe(200);
      expect(resUser.body.data.staff.some((s) => s.id === String(testStaff14._id))).toBe(true);
    });

    it('14-digit national ID exact HMAC lookup returns masked ID without full number', async () => {
      const resId = await request(app)
        .get('/api/v1/manager/search?q=29810151234567')
        .set(mgrAuth());

      expect(resId.status).toBe(200);
      expect(resId.body.data.staff.length).toBe(1);
      expect(resId.body.data.staff[0].id).toBe(String(testStaff14._id));
      expect(resId.body.data.staff[0].national_id).toBe('******4567');
      expect(JSON.stringify(resId.body)).not.toContain('29810151234567');
    });

    it('matches shift reports by date or staff name', async () => {
      const resDate = await request(app)
        .get('/api/v1/manager/search?q=2026-10-18')
        .set(mgrAuth());

      expect(resDate.status).toBe(200);
      expect(resDate.body.data.shift_reports.length).toBeGreaterThanOrEqual(1);
      expect(resDate.body.data.shift_reports[0].business_date).toBe('2026-10-18');

      const resName = await request(app)
        .get('/api/v1/manager/search?q=علي عبد')
        .set(mgrAuth());

      expect(resName.status).toBe(200);
      expect(resName.body.data.shift_reports.length).toBeGreaterThanOrEqual(1);
    });

    it('handles special regex characters in query safely without crashing', async () => {
      const resSpecial = await request(app)
        .get('/api/v1/manager/search?q=[.*+?^${}()|]')
        .set(mgrAuth());

      expect(resSpecial.status).toBe(200);
      expect(resSpecial.body.data.rooms).toEqual([]);
      expect(resSpecial.body.data.staff).toEqual([]);
      expect(resSpecial.body.data.shift_reports).toEqual([]);
    });

    it('rejects receptionist token on search route with 403', async () => {
      const res = await request(app)
        .get('/api/v1/manager/search?q=Single')
        .set(recAuth());

      expect(res.status).toBe(403);
    });
  });
});
