const crypto = require('crypto');
const Staff = require('../../src/db/models/Staff');
const Session = require('../../src/db/models/Session');
const { signAccess } = require('../../src/modules/auth/auth.service');

async function makeToken(role = 'manager', extra = {}) {
  let staff;
  if (extra.staff) {
    staff = extra.staff;
  } else {
    staff = await Staff.create({
      username: role + Math.random().toString(36).slice(2, 8),
      password_hash: 'x',
      name: 'Test ' + role,
      role,
      default_shift_type: role === 'receptionist' ? 'morning' : null,
      ...extra,
    });
  }
  const session = await Session.create({
    staff_id: staff._id,
    refresh_hash: crypto.randomUUID(),
    expires_at: new Date(Date.now() + 3600e3),
    shift_id: null,
  });
  const token = signAccess({ staffId: staff._id, sessionId: session._id, role: staff.role });
  return { staff, session, token };
}

module.exports = { makeToken };
