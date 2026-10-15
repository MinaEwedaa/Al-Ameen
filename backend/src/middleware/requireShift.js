const mongoose = require('mongoose');
const { Shift } = require('../db/models');
const { shiftWindow } = require('../utils/time');
const { E } = require('../utils/errors');
const shiftService = require('../modules/shifts/shift.service');
const { getNow } = require('../utils/clock');

function createRequireShift({ allowHandoverOnly = false } = {}) {
  return async function requireShiftMiddleware(req, res, next) {
    try {
      if (!req.auth || !req.auth.staff) {
        throw E.unauthorized('Authentication required');
      }

      const now = getNow(req);
      const session = req.auth.session;

      // 1. Check if session is locked in read-only pre-shift window
      if (session && session.scheduled_shift && !session.shift_id) {
        const [dateStr, sType] = session.scheduled_shift.split('_');
        const win = shiftWindow(dateStr, sType);
        if (now < win.startAt) {
          throw E.forbidden('This session is read-only until your shift starts.', 'FORBIDDEN');
        }
      }

      // 2. Ensure active shift is open / resumed
      const shift = await shiftService.ensureShiftOpen(req.auth.staff, session, now);

      // 3. Check if shift has already been handed over
      if (shift.status === 'handed_over') {
        throw E.conflict('Shift has been handed over and closed.', 'SHIFT_CLOSED');
      }

      // 4. Check if newer shift has opened (handover-only state)
      if (!allowHandoverOnly) {
        const newerShift = await Shift.findOne({
          start_at: mongoose.trusted({ $gt: shift.start_at }),
          status: 'active',
        });
        if (newerShift) {
          throw E.conflict(
            'The next shift has started; this session can only hand over.',
            'SHIFT_HANDOVER_ONLY'
          );
        }
      }

      req.shift = shift;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = function requireShift(arg, res, next) {
  if (arg && arg.headers && typeof res?.status === 'function') {
    return createRequireShift({ allowHandoverOnly: false })(arg, res, next);
  }
  return createRequireShift(arg || {});
};
