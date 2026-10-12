const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Staff, Session } = require('../db/models');
const { E } = require('../utils/errors');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw E.unauthorized('Authentication required');
    }

    const token = authHeader.slice(7).trim();
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch {
      throw E.unauthorized('Invalid or expired token');
    }

    const session = await Session.findById(decoded.sid);
    if (!session || session.revoked_at || session.expires_at <= new Date()) {
      throw E.unauthorized('Session has been revoked or expired');
    }

    const staff = await Staff.findById(decoded.sub);
    if (!staff || !staff.active) {
      throw E.unauthorized('User inactive or not found');
    }

    // Update last_seen_at
    session.last_seen_at = new Date();
    await session.save();

    req.auth = {
      staff,
      session,
      role: decoded.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate };
