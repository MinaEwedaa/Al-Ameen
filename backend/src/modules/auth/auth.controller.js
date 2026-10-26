const crypto = require('crypto');
const argon2 = require('argon2');
const { DateTime } = require('luxon');
const env = require('../../config/env');
const {
  Shift,
  DailyClosing,
  ShiftReport,
  ApprovalRequest,
  LeaveRequest,
  PasswordResetRequest,
  AuditLog,
  Staff,
  Session,
} = require('../../db/models');
const { E } = require('../../utils/errors');
const authService = require('./auth.service');
const { audit } = require('../audit/audit.service');
const { formatShift } = require('../shifts/shift.service');
const { sanitizeText, normalizeArabic } = require('../../utils/arabic');
const { normalizePhone } = require('../guests/guest.utils');
const { hashPassword, isStrong } = require('../../utils/password');
const { notifyManagers } = require('../notifications/notify');

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
};

const checkOrigin = (req) => {
  const origin = req.headers.origin;
  if (origin && !env.allowedOrigins.includes(origin)) {
    throw E.forbidden('Forbidden origin', 'FORBIDDEN');
  }
};

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login({
      username,
      password,
      ip: req.ip,
      reqTime: req.headers['x-test-time'],
    });

    setRefreshCookie(res, result.refreshToken, result.sessionExpiresAt);

    res.status(200).json({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      staff: result.staff,
      shift: result.shift,
      read_only: result.readOnly,
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    checkOrigin(req);

    const rawRefreshToken = req.cookies?.refresh_token;
    if (!rawRefreshToken) {
      throw E.unauthorized('Refresh token cookie missing');
    }

    const result = await authService.refresh({
      rawRefreshToken,
      ip: req.ip,
    });

    setRefreshCookie(res, result.newRefreshToken, result.sessionExpiresAt);

    res.status(200).json({
      access_token: result.accessToken,
      expires_in: result.expiresIn,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    checkOrigin(req);

    const rawRefreshToken = req.cookies?.refresh_token;
    const sessionId = req.auth?.session?._id;

    await authService.logout({
      sessionId,
      rawRefreshToken,
    });

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'strict',
      path: '/api/v1/auth',
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const staff = req.auth.staff;
    const session = req.auth.session;

    if (staff.role === 'receptionist') {
      let shift = null;
      let readOnly = false;

      if (session && session.shift_id) {
        const shiftDoc = await Shift.findById(session.shift_id);
        if (shiftDoc) shift = formatShift(shiftDoc);
      } else if (session && session.scheduled_shift) {
        readOnly = true;
      }

      return res.status(200).json({
        staff: {
          staff_id: String(staff._id),
          name: staff.name,
          role: staff.role,
          default_shift_type: staff.default_shift_type,
        },
        shift,
        read_only: readOnly,
      });
    }

    // Manager / Admin shape
    const day = await DailyClosing.findOne({ status: 'OPEN' }).lean();

    return res.status(200).json({
      staff: {
        staff_id: String(staff._id),
        name: staff.name,
        role: staff.role,
        default_shift_type: staff.default_shift_type || null,
        staff_type: (staff.role || 'manager').toUpperCase(),
        email: staff.email || null,
        phone: staff.phone || null,
        department: staff.department || null,
      },
      shift: null,
      read_only: false,
      open_business_day: day
        ? {
            business_date: day.business_date,
            status: day.status,
            opened_at: day.opened_at ? day.opened_at.toISOString() : null,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const staff = await Staff.findById(req.auth.staff._id);
    if (!staff) throw E.notFound('Staff member not found');

    const { full_name, phone, email } = req.body || {};
    if (full_name === undefined && phone === undefined && email === undefined) {
      throw E.validation('At least one field is required');
    }

    const changed = {};

    if (full_name !== undefined) {
      const cleanName = sanitizeText(full_name);
      staff.name = cleanName;
      staff.name_search = normalizeArabic(cleanName);
      changed.full_name = cleanName;
    }

    if (phone !== undefined) {
      const cleanPhone = normalizePhone(phone);
      staff.phone = cleanPhone;
      changed.phone = cleanPhone;
    }

    if (email !== undefined) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      staff.email = cleanEmail;
      changed.email = cleanEmail;
    }

    try {
      await staff.save();
    } catch (err) {
      if (err.code === 11000) {
        throw E.conflict('Email already in use', 'CONFLICT');
      }
      throw err;
    }

    await audit({
      action: 'UPDATED_PROFILE',
      actorStaffId: staff._id,
      ip: req.ip,
      details: changed,
    });

    return res.status(200).json(changed);
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body || {};
    const staff = await Staff.findById(req.auth.staff._id);
    if (!staff) throw E.notFound('Staff member not found');

    const isCurrentValid = await argon2.verify(staff.password_hash, current_password || '');
    if (!isCurrentValid) {
      throw E.validation('Validation error', { field: 'current_password', issue: 'incorrect' });
    }

    if (!isStrong(new_password) || new_password === current_password) {
      throw E.validation('Validation error', {
        field: 'new_password',
        issue: new_password === current_password ? 'same_as_current' : 'weak',
      });
    }

    const now = new Date();
    staff.password_hash = await hashPassword(new_password);
    staff.password_changed_at = now;
    await staff.save();

    // Revoke all other active sessions and keep current one
    await Session.updateMany(
      { staff_id: staff._id, _id: { $ne: req.auth.session._id }, revoked_at: null },
      { revoked_at: now }
    );

    await audit({
      action: 'PASSWORD_CHANGED',
      actorStaffId: staff._id,
      ip: req.ip,
    });

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const staffId = req.auth.staff._id;
    const audits_total = await ShiftReport.countDocuments({ reviewed_by_staff_id: staffId });

    const ZONE = 'Africa/Cairo';
    const startOfMonth = DateTime.now().setZone(ZONE).startOf('month').toUTC().toJSDate();

    const [approvalsCount, leavesCount, resetsCount] = await Promise.all([
      ApprovalRequest.countDocuments({ decided_by_staff_id: staffId, decided_at: { $gte: startOfMonth } }),
      LeaveRequest.countDocuments({ decided_by_staff_id: staffId, decided_at: { $gte: startOfMonth } }),
      PasswordResetRequest.countDocuments({ decided_by_staff_id: staffId, decided_at: { $gte: startOfMonth } }),
    ]);

    const decisions_this_month = approvalsCount + leavesCount + resetsCount;
    const reports_pending_review = await ShiftReport.countDocuments({ review_status: 'PENDING_REVIEW' });

    return res.status(200).json({
      data: {
        audits_total,
        decisions_this_month,
        reports_pending_review,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getActivities(req, res, next) {
  try {
    const staffId = req.auth.staff._id;
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

    const logs = await AuditLog.find({ actor_staff_id: staffId })
      .sort({ at: -1 })
      .limit(limit)
      .lean();

    const activities = logs.map((l) => ({
      id: String(l._id),
      action: l.action,
      entity: l.entity || null,
      entity_id: l.entity_id ? String(l.entity_id) : null,
      at: l.at ? l.at.toISOString() : null,
    }));

    return res.status(200).json(activities);
  } catch (err) {
    next(err);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const { username } = req.body || {};
    const cleanUsername = String(username || '').trim().toLowerCase();

    if (!cleanUsername) {
      throw E.badRequest('Username is required');
    }

    // Look for Staff member
    const staff = await Staff.findOne({
      username: cleanUsername,
      active: true,
    });

    if (!staff) {
      throw E.notFound('Staff member not found', 'STAFF_NOT_FOUND');
    }

    if (['manager', 'admin'].includes(staff.role)) {
      throw E.forbidden(
        'Manager and admin accounts cannot request password resets through this portal',
        'MANAGER_CANNOT_RESET'
      );
    }

    // Invalidate existing password immediately so old password no longer works
    const unguessableRandom = crypto.randomBytes(32).toString('hex');
    staff.password_hash = await hashPassword(unguessableRandom);
    staff.password_changed_at = new Date();
    await staff.save();

    // Revoke all active sessions for this staff member immediately
    await Session.updateMany(
      { staff_id: staff._id, revoked_at: null },
      { revoked_at: new Date() }
    );

    const existingPending = await PasswordResetRequest.findOne({
      staff_id: staff._id,
      status: 'PENDING',
    });

    let prr = existingPending;
    if (!existingPending) {
      prr = await PasswordResetRequest.create({
        staff_id: staff._id,
        username: staff.username,
        status: 'PENDING',
        requested_ip: req.ip,
      });

      await notifyManagers({
        type: 'SYSTEM',
        title: 'Password reset request',
        message: cleanUsername,
        refType: 'PasswordResetRequest',
        refId: prr._id,
      });
    }

    await audit({
      action: 'PASSWORD_RESET_REQUESTED',
      actorStaffId: staff._id,
      ip: req.ip,
      details: { username: cleanUsername, reset_request_id: prr._id },
    });

    return res.status(202).json({
      data: {
        message: 'Password reset request sent to the manager',
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  updateMe,
  changePassword,
  getStats,
  getActivities,
  requestPasswordReset,
};
