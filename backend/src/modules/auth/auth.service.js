const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { Staff, Session } = require('../../db/models');
const { E } = require('../../utils/errors');
const { audit } = require('../audit/audit.service');
const { resolveLoginShift, formatShift } = require('../shifts/shift.service');

// Pre-compute dummy hash for timing-attack mitigation
let DUMMY_HASH;
argon2
  .hash('dummy_pass_timing_mitigation')
  .then((h) => {
    DUMMY_HASH = h;
  })
  .catch(() => {
    DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$dummyhashdummyhash$dummy';
  });

const signAccess = ({ staffId, sessionId, role }) =>
  jwt.sign(
    {
      sub: String(staffId),
      sid: String(sessionId),
      role,
    },
    env.jwtSecret,
    { expiresIn: '15m' }
  );

async function login({ username, password, ip, reqTime }) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const staff = await Staff.findOne({ username: cleanUsername, active: true });

  // 1. Timing-attack protection for non-existent users
  if (!staff) {
    await argon2.verify(DUMMY_HASH, password || '');
    await audit({ action: 'LOGIN_FAILED', ip, details: { username: cleanUsername } });
    throw E.unauthorized('Invalid credentials');
  }

  // 2. Lockout verification before computing expensive password hash
  const now = new Date();
  if (staff.locked_until && staff.locked_until > now) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((staff.locked_until.getTime() - now.getTime()) / 1000)
    );
    throw E.tooMany('Account is locked. Try again later.', retryAfterSeconds);
  }

  // 3. Password verification
  const isValid = await argon2.verify(staff.password_hash, password || '');
  if (!isValid) {
    staff.failed_attempts += 1;
    if (staff.failed_attempts >= 5) {
      const lockoutMinutes = [15, 30, 60][Math.min(staff.lock_level, 2)];
      staff.locked_until = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      staff.lock_level += 1;
      staff.failed_attempts = 0;
      await staff.save();

      await audit({
        action: 'LOCKOUT',
        actorStaffId: staff._id,
        ip,
        details: { lock_level: staff.lock_level, lockoutMinutes },
      });

      const retryAfter = lockoutMinutes * 60;
      throw E.tooMany('Account is locked. Try again later.', retryAfter);
    }

    await staff.save();
    await audit({ action: 'LOGIN_FAILED', actorStaffId: staff._id, ip });
    throw E.unauthorized('Invalid credentials');
  }

  // 4. Role validation (Only receptionist can log into receptionist system)
  if (staff.role !== 'receptionist') {
    throw E.forbidden('Forbidden', 'FORBIDDEN');
  }

  // Reset failed attempts on success
  staff.failed_attempts = 0;
  staff.lock_level = 0;
  staff.locked_until = null;
  await staff.save();

  // 5. Shift check
  const shiftInfo = await resolveLoginShift(staff, now, reqTime);

  // 6. Invalidate any existing sessions (one device per receptionist)
  await Session.updateMany(
    { staff_id: staff._id, revoked_at: null },
    { revoked_at: now }
  );

  // 7. Generate random 48-byte refresh token & hash
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // 8. Create new Session
  const session = await Session.create({
    staff_id: staff._id,
    refresh_hash: refreshHash,
    expires_at: shiftInfo.refreshExpiresAt,
    scheduled_shift: shiftInfo.scheduled_shift,
    shift_id: shiftInfo.shift ? shiftInfo.shift._id : null,
    last_seen_at: now,
  });

  // 9. Generate access token
  const accessToken = signAccess({
    staffId: staff._id,
    sessionId: session._id,
    role: staff.role,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
    sessionExpiresAt: session.expires_at,
    staff: {
      staff_id: String(staff._id),
      name: staff.name,
      default_shift_type: staff.default_shift_type,
    },
    shift: formatShift(shiftInfo.shift),
    readOnly: shiftInfo.read_only,
  };
}

async function refresh({ rawRefreshToken, ip }) {
  if (!rawRefreshToken) {
    throw E.unauthorized('Refresh token required');
  }

  const currentHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  let session = await Session.findOne({ refresh_hash: currentHash });

  // Check for refresh token reuse
  if (!session) {
    const reuseSession = await Session.findOne({ previous_refresh_hash: currentHash });
    if (reuseSession) {
      // Reuse attack detected: revoke the entire session immediately
      reuseSession.revoked_at = new Date();
      await reuseSession.save();

      await audit({
        action: 'REFRESH_REUSE',
        actorStaffId: reuseSession.staff_id,
        ip,
      });

      throw E.unauthorized('Invalid refresh token');
    }
    throw E.unauthorized('Invalid refresh token');
  }

  const now = new Date();
  if (session.revoked_at || session.expires_at <= now) {
    throw E.unauthorized('Session has expired or was revoked');
  }

  const staff = await Staff.findById(session.staff_id);
  if (!staff || !staff.active) {
    throw E.unauthorized('Account inactive');
  }

  // Token rotation
  const newRefreshToken = crypto.randomBytes(48).toString('base64url');
  const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  session.previous_refresh_hash = session.refresh_hash;
  session.refresh_hash = newRefreshHash;
  session.last_seen_at = now;
  await session.save();

  const accessToken = signAccess({
    staffId: staff._id,
    sessionId: session._id,
    role: staff.role,
  });

  return {
    accessToken,
    newRefreshToken,
    expiresIn: 900,
    sessionExpiresAt: session.expires_at,
  };
}

async function logout({ sessionId, rawRefreshToken }) {
  const now = new Date();
  if (sessionId) {
    await Session.updateOne({ _id: sessionId }, { revoked_at: now });
  } else if (rawRefreshToken) {
    const hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    await Session.updateOne({ refresh_hash: hash }, { revoked_at: now });
  }
}

module.exports = {
  signAccess,
  login,
  refresh,
  logout,
};
