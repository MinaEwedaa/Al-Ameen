const env = require('../../config/env');
const { Shift } = require('../../db/models');
const { E } = require('../../utils/errors');
const authService = require('./auth.service');
const { formatShift } = require('../shifts/shift.service');

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
    let shift = null;
    let readOnly = false;

    if (session && session.shift_id) {
      const shiftDoc = await Shift.findById(session.shift_id);
      if (shiftDoc) shift = formatShift(shiftDoc);
    } else if (session && session.scheduled_shift) {
      readOnly = true;
    }

    res.status(200).json({
      staff: {
        staff_id: String(staff._id),
        name: staff.name,
        default_shift_type: staff.default_shift_type,
      },
      shift,
      read_only: readOnly,
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
};
