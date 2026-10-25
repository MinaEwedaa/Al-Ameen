// Manager Staff Service (M4)
// Implements complete staff management specifications from M4 Guide

const mongoose = require('mongoose');
const { Staff, Session, ShiftSchedule, Shift, CleaningTask, MaintenanceIssue } = require('../../../db/models');
const { E } = require('../../../utils/errors');
const { cairoDate, ZONE } = require('../../../utils/time');
const { DateTime } = require('luxon');
const { encrypt, blindIndex, normalizeIdNumber } = require('../../../utils/crypto');
const { normalizeArabic, normalizePhone, sanitizeText } = require('../../../utils/arabic');
const { hashPassword, generatePassword } = require('../../../utils/password');
const { audit } = require('../../audit/audit.service');
const { runInTransaction } = require('../../../utils/transaction');
const { toStaffDto, toStaffCreatedDto } = require('./staff.dto');

const ROLE_MAP_REVERSE = {
  RECEPTIONIST: 'receptionist',
  HOUSEKEEPER: 'housekeeper',
  TECHNICIAN: 'technician',
  MANAGER: 'manager',
  ADMIN: 'admin',
};

function canManage(actor, target) {
  if (!actor || !target) throw E.forbidden('Forbidden', 'FORBIDDEN');
  if (actor.role === 'admin') return true;
  if (actor.role === 'manager') {
    if (['receptionist', 'housekeeper', 'technician'].includes(target.role)) {
      return true;
    }
  }
  throw E.forbidden('Forbidden', 'FORBIDDEN');
}

// ─── Extras Loaders (Batch, Zero Per-Row Queries) ───────────────────────────

async function buildTodayShifts(staffIds, now = new Date()) {
  const endOfDayCairo = DateTime.fromJSDate(now).setZone(ZONE).endOf('day').toJSDate();
  const schedules = await ShiftSchedule.find({
    staff_id: { $in: staffIds },
    status: 'SCHEDULED',
    end_at: { $gt: now },
    start_at: { $lt: endOfDayCairo },
  })
    .sort({ start_at: 1 })
    .lean();

  const map = new Map();
  for (const s of schedules) {
    const sid = String(s.staff_id);
    if (!map.has(sid)) {
      map.set(sid, {
        shift_id: String(s._id),
        shift_type: s.shift_type ? s.shift_type.toUpperCase() : 'MORNING',
        start_at: s.start_at ? s.start_at.toISOString() : null,
        end_at: s.end_at ? s.end_at.toISOString() : null,
        status: s.status,
      });
    }
  }
  return map;
}

async function buildWorkloads(staffIds) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86400e3);

  const [cleaningTasks, futureShifts] = await Promise.all([
    CleaningTask.aggregate([
      {
        $match: {
          assigned_to_staff_id: { $in: staffIds },
          status: 'pending',
        },
      },
      { $group: { _id: '$assigned_to_staff_id', count: { $sum: 1 } } },
    ]),
    ShiftSchedule.aggregate([
      {
        $match: {
          staff_id: { $in: staffIds },
          status: 'SCHEDULED',
          start_at: { $gte: now, $lte: in7Days },
        },
      },
      { $group: { _id: '$staff_id', count: { $sum: 1 } } },
    ]),
  ]);

  const map = new Map();
  for (const id of staffIds) {
    map.set(String(id), { pending_tasks: 0, scheduled_shifts_next_7_days: 0 });
  }

  for (const c of cleaningTasks) {
    const entry = map.get(String(c._id));
    if (entry) entry.pending_tasks = c.count;
  }
  for (const s of futureShifts) {
    const entry = map.get(String(s._id));
    if (entry) entry.scheduled_shifts_next_7_days = s.count;
  }

  return map;
}

async function buildLastLogins(staffIds) {
  const sessions = await Session.aggregate([
    { $match: { staff_id: { $in: staffIds } } },
    { $group: { _id: '$staff_id', last_seen: { $max: '$last_seen_at' } } },
  ]);

  const map = new Map();
  for (const s of sessions) {
    map.set(String(s._id), s.last_seen);
  }
  return map;
}

async function attachExtras(staffList, include, now = new Date()) {
  const ids = staffList.map((s) => s._id);
  const wantShift = include.includes('today_shift');
  const wantWorkload = include.includes('workload');

  const [shiftMap, workloadMap, loginMap] = await Promise.all([
    wantShift ? buildTodayShifts(ids, now) : Promise.resolve(new Map()),
    wantWorkload ? buildWorkloads(ids) : Promise.resolve(new Map()),
    buildLastLogins(ids),
  ]);

  return staffList.map((staff) => {
    const id = String(staff._id);
    return toStaffDto(staff, {
      lastLogin: loginMap.get(id) ?? null,
      todayShift: wantShift ? (shiftMap.get(id) ?? null) : undefined,
      workload: wantWorkload ? (workloadMap.get(id) ?? { pending_tasks: 0, scheduled_shifts_next_7_days: 0 }) : undefined,
    });
  });
}

// ─── Service Methods ─────────────────────────────────────────────────────────

async function listStaff({ staff_type, department, is_active, on_shift, q, search, page, limit, include }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const queryStr = (q || search || '').trim();

  const filter = {};
  if (staff_type) {
    const role = ROLE_MAP_REVERSE[staff_type.toUpperCase()];
    if (!role) throw E.validation(`Invalid staff_type: ${staff_type}`);
    filter.role = role;
  }
  if (department) {
    filter.department = String(department).trim();
  }
  if (is_active !== undefined && is_active !== '') {
    filter.active = String(is_active) === 'true';
  }

  if (queryStr) {
    const safeRegex = queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalized = normalizeArabic(queryStr).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name_search: { $regex: normalized, $options: 'i' } },
      { username: { $regex: `^${safeRegex}`, $options: 'i' } },
      { email: { $regex: safeRegex, $options: 'i' } },
    ];
  }

  const now = new Date();
  if (on_shift !== undefined && on_shift !== '') {
    const onShiftBool = String(on_shift) === 'true';
    const activeStaffIds = await ShiftSchedule.distinct('staff_id', {
      status: 'SCHEDULED',
      start_at: { $lte: now },
      end_at: { $gt: now },
    });
    if (onShiftBool) {
      filter._id = { $in: activeStaffIds };
    } else {
      filter._id = { $nin: activeStaffIds };
    }
  }

  const total = await Staff.countDocuments(filter);
  const staffList = await Staff.find(filter)
    .sort({ name_search: 1 })
    .skip((p - 1) * l)
    .limit(l)
    .lean();

  const includeArr = include ? include.split(',').map((x) => x.trim()) : [];
  const data = await attachExtras(staffList, includeArr, now);

  return { data, meta: { page: p, limit: l, total, total_pages: Math.ceil(total / l) || 1 } };
}

async function getStaff(staffId, include) {
  if (!mongoose.isValidObjectId(staffId)) throw E.notFound('Staff not found');
  const staff = await Staff.findById(staffId).lean();
  if (!staff) throw E.notFound('Staff not found');
  const includeArr = include ? include.split(',').map((x) => x.trim()) : ['today_shift', 'workload'];
  const [dto] = await attachExtras([staff], includeArr);
  return dto;
}

async function createStaff(
  { username, full_name, staff_type, department, phone, email, national_id, hire_date, default_shift_type },
  actorStaff,
  ip
) {
  if (!full_name || !full_name.trim()) throw E.validation('full_name is required', { field: 'full_name' });
  if (!staff_type) throw E.validation('staff_type is required', { field: 'staff_type' });

  const role = ROLE_MAP_REVERSE[staff_type.toUpperCase()];
  if (!role) throw E.validation('Invalid staff_type', { field: 'staff_type' });

  // Role permissions: manager can only create receptionist, housekeeper, technician
  if (['manager', 'admin'].includes(role) && actorStaff.role !== 'admin') {
    throw E.forbidden('Only admin can create manager or admin accounts', 'FORBIDDEN');
  }

  // default_shift_type required for receptionist
  let finalDefaultShift = null;
  if (role === 'receptionist') {
    if (!default_shift_type) {
      throw E.validation('default_shift_type is required for receptionist', { field: 'default_shift_type' });
    }
    const shiftTypeLower = default_shift_type.toLowerCase();
    if (!['morning', 'evening', 'night'].includes(shiftTypeLower)) {
      throw E.validation('Invalid default_shift_type', { field: 'default_shift_type' });
    }
    finalDefaultShift = shiftTypeLower;
  }

  // Username validation: lowercase 3 to 30 chars of a-z, 0-9, dot, dash, underscore
  let cleanUsername = username ? String(username).trim().toLowerCase() : '';
  if (!cleanUsername) {
    const base = email ? email.split('@')[0].replace(/[^a-z0-9]/g, '') : 'staff';
    cleanUsername = `${base.slice(0, 20)}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
    throw E.validation('Username must be 3-30 characters of a-z, 0-9, dot, dash, underscore', { field: 'username' });
  }

  const duplicateUsername = await Staff.findOne({ username: cleanUsername }).lean();
  if (duplicateUsername) {
    throw E.conflict('Username already in use', 'CONFLICT', { field: 'username' });
  }

  // Email validation if present
  let cleanEmail = null;
  if (email && email.trim()) {
    cleanEmail = email.trim().toLowerCase();
    const duplicateEmail = await Staff.findOne({ email: cleanEmail }).lean();
    if (duplicateEmail) {
      throw E.conflict('Email already in use', 'CONFLICT', { field: 'email' });
    }
  }

  // National ID validation & encryption
  let id_number_enc = undefined;
  let id_number_hash = undefined;
  let id_number_last4 = undefined;
  if (national_id) {
    const normalized = normalizeIdNumber(national_id);
    if (!/^[23]\d{13}$/.test(normalized)) {
      throw E.validation('Invalid national_id format', { field: 'national_id' });
    }
    const hash = blindIndex(normalized);
    const existing = await Staff.findOne({ id_number_hash: hash }).lean();
    if (existing) {
      throw E.conflict('National ID already registered', 'CONFLICT');
    }
    id_number_enc = encrypt(normalized);
    id_number_hash = hash;
    id_number_last4 = normalized.slice(-4);
  }

  // Password generation: housekeepers & technicians have no login
  let temporaryPassword = null;
  let passwordToHash = generatePassword(24);
  if (['receptionist', 'manager', 'admin'].includes(role)) {
    temporaryPassword = generatePassword(16);
    passwordToHash = temporaryPassword;
  }
  const password_hash = await hashPassword(passwordToHash);

  const cleanName = sanitizeText(full_name);
  const nameSearch = normalizeArabic(cleanName);
  const hireDate = hire_date ? new Date(hire_date) : new Date();

  const staff = await Staff.create({
    username: cleanUsername,
    name: cleanName,
    name_search: nameSearch,
    password_hash,
    role,
    department: department ? sanitizeText(department) : null,
    phone: phone ? normalizePhone(phone) : null,
    email: cleanEmail,
    default_shift_type: finalDefaultShift,
    hire_date: hireDate,
    active: true,
    created_by_staff_id: actorStaff._id,
    ...(id_number_enc && { id_number_enc, id_number_hash, id_number_last4 }),
  });

  await audit({
    action: 'CREATED_STAFF',
    actorStaffId: actorStaff._id,
    entity: 'Staff',
    entityId: String(staff._id),
    details: { role, username: cleanUsername },
    ip,
  });

  return toStaffCreatedDto(staff.toObject(), temporaryPassword);
}

async function updateStaff(staffId, { full_name, department, phone, email, default_shift_type, is_active }, actorStaff, ip) {
  if (!mongoose.isValidObjectId(staffId)) throw E.notFound('Staff not found');
  const staff = await Staff.findById(staffId);
  if (!staff) throw E.notFound('Staff not found');

  canManage(actorStaff, staff);

  if (is_active === false) {
    throw E.badRequest('Deactivation has its own endpoint');
  }

  const updates = {};
  if (full_name !== undefined) {
    if (!full_name.trim()) throw E.validation('full_name cannot be empty', { field: 'full_name' });
    const cleanName = sanitizeText(full_name);
    updates.name = cleanName;
    updates.name_search = normalizeArabic(cleanName);
  }

  if (department !== undefined) {
    updates.department = department ? sanitizeText(department) : null;
  }

  if (phone !== undefined) {
    updates.phone = phone ? normalizePhone(phone) : null;
  }

  if (email !== undefined) {
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const conflict = await Staff.findOne({ email: cleanEmail, _id: { $ne: staff._id } }).lean();
      if (conflict) throw E.conflict('Email already in use', 'CONFLICT', { field: 'email' });
    }
    updates.email = cleanEmail;
  }

  if (default_shift_type !== undefined) {
    if (staff.role === 'receptionist') {
      const shiftType = default_shift_type ? default_shift_type.toLowerCase() : null;
      if (!['morning', 'evening', 'night'].includes(shiftType)) {
        throw E.validation('Invalid default_shift_type', { field: 'default_shift_type' });
      }
      updates.default_shift_type = shiftType;
    }
  }

  if (is_active === true) {
    updates.active = true;
    updates.deactivated_at = null;
  }

  if (Object.keys(updates).length === 0) {
    throw E.validation('At least one field is required to update');
  }

  Object.assign(staff, updates);
  await staff.save();

  await audit({
    action: 'UPDATED_STAFF',
    actorStaffId: actorStaff._id,
    entity: 'Staff',
    entityId: staffId,
    details: updates,
    ip,
  });

  return getStaff(staffId, 'today_shift,workload');
}

async function deactivateStaff(staffId, actorStaff, ip) {
  if (!mongoose.isValidObjectId(staffId)) throw E.notFound('Staff not found');
  const target = await Staff.findById(staffId);
  if (!target) throw E.notFound('Staff not found');

  if (String(staffId) === String(actorStaff._id)) {
    throw E.conflict('You cannot deactivate yourself');
  }

  canManage(actorStaff, target);

  if (!target.active) {
    throw E.conflict('Staff is already deactivated');
  }

  const now = new Date();

  await runInTransaction(async (session) => {
    const openShift = await Shift.exists({ staff_id: staffId, status: { $in: ['active', 'open'] } }).session(session);
    if (openShift) {
      throw E.conflict('Employee has an open shift. Force-close it first (M6)', 'SHIFT_ALREADY_STARTED');
    }

    const others = await Staff.countDocuments({
      _id: { $ne: staffId },
      role: { $in: ['manager', 'admin'] },
      active: true,
    }).session(session);

    if (target.role !== 'receptionist' && target.role !== 'housekeeper' && target.role !== 'technician' && !others) {
      throw E.conflict('This is the last active manager or admin');
    }

    await Staff.updateOne({ _id: staffId }, { $set: { active: false, deactivated_at: now } }, { session });
    await Session.updateMany({ staff_id: staffId, revoked_at: null }, { $set: { revoked_at: now } }, { session });
    await ShiftSchedule.updateMany(
      { staff_id: staffId, status: 'SCHEDULED', start_at: { $gt: now } },
      { $set: { status: 'CANCELLED', cancel_reason: 'STAFF_DEACTIVATED' } },
      { session }
    );
  });

  await audit({
    action: 'DEACTIVATED_STAFF',
    actorStaffId: actorStaff._id,
    entity: 'Staff',
    entityId: staffId,
    ip,
  });

  return getStaff(staffId, 'today_shift,workload');
}

async function reactivateStaff(staffId, actorStaff, ip) {
  if (!mongoose.isValidObjectId(staffId)) throw E.notFound('Staff not found');
  const target = await Staff.findById(staffId);
  if (!target) throw E.notFound('Staff not found');

  canManage(actorStaff, target);

  if (target.active) {
    throw E.conflict('Staff is already active');
  }

  target.active = true;
  target.deactivated_at = null;
  await target.save();

  await audit({
    action: 'REACTIVATED_STAFF',
    actorStaffId: actorStaff._id,
    entity: 'Staff',
    entityId: staffId,
    ip,
  });

  return getStaff(staffId, 'today_shift,workload');
}

async function resetPassword(staffId, actorStaff, ip) {
  if (!mongoose.isValidObjectId(staffId)) throw E.notFound('Staff not found');
  const target = await Staff.findById(staffId);
  if (!target) throw E.notFound('Staff not found');

  if (String(target._id) === String(actorStaff._id)) {
    throw E.conflict('You cannot reset your own password here. Use change password instead.');
  }

  canManage(actorStaff, target);
  if (['housekeeper', 'technician'].includes(target.role)) {
    throw E.conflict('Account has no login access');
  }
  if (!target.active) {
    throw E.conflict('Cannot reset password for deactivated staff');
  }

  const temporaryPassword = generatePassword(16);
  const password_hash = await hashPassword(temporaryPassword);
  const now = new Date();

  await runInTransaction(async (session) => {
    await Staff.updateOne(
      { _id: target._id },
      {
        $set: {
          password_hash,
          password_changed_at: now,
          failed_attempts: 0,
          lock_level: 0,
          locked_until: null,
        },
      },
      { session }
    );
    await Session.updateMany({ staff_id: target._id, revoked_at: null }, { $set: { revoked_at: now } }, { session });
  });

  await audit({
    action: 'RESET_STAFF_PASSWORD',
    actorStaffId: actorStaff._id,
    entity: 'Staff',
    entityId: staffId,
    ip,
  });

  return { id: staffId, temporary_password: temporaryPassword };
}

module.exports = {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
  reactivateStaff,
  resetPassword,
};
