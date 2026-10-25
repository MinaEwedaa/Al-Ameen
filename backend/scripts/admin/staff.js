const { Staff, Session } = require('../../src/db/models');
const { guard } = require('./guard');
const { hashPassword, generatePassword } = require('../../src/utils/password');

async function createStaff({ username, name, shiftType, role = 'receptionist', password, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'CREATE_STAFF',
    details: { username, name, shift_type: shiftType, role },
  });

  const existing = await Staff.findOne({ username });
  if (existing) {
    throw new Error(`Staff member with username '${username}' already exists.`);
  }

  const plainPassword = password || generatePassword();
  const passwordHash = await hashPassword(plainPassword);

  const staff = await Staff.create({
    username,
    name,
    default_shift_type: shiftType,
    role,
    password_hash: passwordHash,
    active: true,
  });

  return {
    staff_id: String(staff._id),
    username: staff.username,
    name: staff.name,
    password: plainPassword,
  };
}

async function disableStaff({ username, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'DISABLE_STAFF',
    details: { username },
  });

  const staff = await Staff.findOne({ username });
  if (!staff) {
    throw new Error(`Staff member with username '${username}' not found.`);
  }

  staff.active = false;
  await staff.save();

  // Invalidate all active sessions immediately
  await Session.updateMany(
    { staff_id: staff._id, revoked_at: null },
    { revoked_at: new Date() }
  );

  return { username: staff.username, active: false };
}

async function resetPassword({ username, password, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'RESET_PASSWORD',
    details: { username },
  });

  const staff = await Staff.findOne({ username });
  if (!staff) {
    throw new Error(`Staff member with username '${username}' not found.`);
  }

  const plainPassword = password || generatePassword();
  const passwordHash = await hashPassword(plainPassword);

  staff.password_hash = passwordHash;
  staff.failed_attempts = 0;
  staff.lock_level = 0;
  staff.locked_until = null;
  await staff.save();

  // Invalidate all active sessions so old tokens return 401
  await Session.updateMany(
    { staff_id: staff._id, revoked_at: null },
    { revoked_at: new Date() }
  );

  return {
    username: staff.username,
    password: plainPassword,
  };
}

async function unlockAccount({ username, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'UNLOCK_ACCOUNT',
    details: { username },
  });

  const staff = await Staff.findOne({ username });
  if (!staff) {
    throw new Error(`Staff member with username '${username}' not found.`);
  }

  staff.failed_attempts = 0;
  staff.lock_level = 0;
  staff.locked_until = null;
  await staff.save();

  return { username: staff.username, unlocked: true };
}

module.exports = {
  createStaff,
  disableStaff,
  resetPassword,
  unlockAccount,
};
