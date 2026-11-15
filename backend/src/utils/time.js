const { DateTime } = require('luxon');

const ZONE = 'Africa/Cairo';

const SHIFTS = {
  morning: { start: 7, end: 16, endDayOffset: 0 },
  evening: { start: 16, end: 23, endDayOffset: 0 },
  night: { start: 23, end: 7, endDayOffset: 1 },
};

const NEXT_SHIFT = {
  morning: 'evening',
  evening: 'night',
  night: 'morning',
};

const cairoDate = (d = new Date()) =>
  DateTime.fromJSDate(d, { zone: ZONE }).toFormat('yyyy-MM-dd');

let SHIFT_HOURS = {
  morning: { start: 7, end: 16 },
  evening: { start: 16, end: 23 },
  night: { start: 23, end: 7 },
};

const ORDER = ['morning', 'evening', 'night'];

function validateHours(h) {
  if (!h || typeof h !== 'object') return false;
  let total = 0;
  for (const k of ORDER) {
    const { start, end } = h[k] || {};
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      start > 23 ||
      end < 0 ||
      end > 23 ||
      start === end
    ) {
      return false;
    }
    total += (end - start + 24) % 24;
  }
  return (
    total === 24 &&
    h.morning.end === h.evening.start &&
    h.evening.end === h.night.start &&
    h.night.end === h.morning.start
  );
}

function getShiftHours() {
  return JSON.parse(JSON.stringify(SHIFT_HOURS));
}

function setShiftHours(h) {
  if (!validateHours(h)) {
    throw new Error('Invalid shift hours: must cover 24 hours continuously with no gaps or overlaps');
  }
  SHIFT_HOURS = Object.freeze(JSON.parse(JSON.stringify(h)));
}

function todayCairo() {
  return DateTime.now().setZone(ZONE).toFormat('yyyy-MM-dd');
}

function eachDate(start, to) {
  const dates = [];
  let cur = DateTime.fromISO(start, { zone: ZONE });
  const end = DateTime.fromISO(to, { zone: ZONE });
  while (cur <= end) {
    dates.push(cur.toFormat('yyyy-MM-dd'));
    cur = cur.plus({ days: 1 });
  }
  return dates;
}

function shiftWindow(shiftDate, shiftType, hours = SHIFT_HOURS) {
  const type = (shiftType || '').toLowerCase();
  const s = (hours && hours[type]) || SHIFTS[type] || SHIFTS.morning;
  const base = DateTime.fromISO(shiftDate, { zone: ZONE }).startOf('day');
  const sStart = base.set({ hour: s.start, minute: 0, second: 0, millisecond: 0 });
  let sEnd = base.set({ hour: s.end, minute: 0, second: 0, millisecond: 0 });
  if (s.end <= s.start) {
    sEnd = sEnd.plus({ days: 1 });
  }

  const startUtc = sStart.toUTC().toJSDate();
  const endUtc = sEnd.toUTC().toJSDate();

  return {
    start_at: startUtc,
    end_at: endUtc,
    startAt: startUtc,
    endAt: endUtc,
  };
}

/**
 * Hotel stay day runs from 12:00 PM (noon) to 12:00 PM (noon) Cairo time.
 * Before 12:00 PM belongs to yesterday's stay day.
 */
function stayDay(d = new Date()) {
  const t = DateTime.fromJSDate(d, { zone: ZONE });
  return (t.hour >= 12 ? t : t.minus({ days: 1 })).toFormat('yyyy-MM-dd');
}

/**
 * Check-in and check-out standard time is 12:00 PM (noon) Cairo time.
 */
const noonCairo = (dateStr) =>
  DateTime.fromISO(dateStr, { zone: ZONE })
    .set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();

const nightsBetween = (inDay, outDay) =>
  Math.round(DateTime.fromISO(outDay).diff(DateTime.fromISO(inDay), 'days').days);

const stayDays = (inDay, nights) =>
  Array.from({ length: nights }, (_, i) =>
    DateTime.fromISO(inDay).plus({ days: i }).toFormat('yyyy-MM-dd')
  );

module.exports = {
  ZONE,
  SHIFTS,
  SHIFT_HOURS,
  NEXT_SHIFT,
  cairoDate,
  todayCairo,
  eachDate,
  shiftWindow,
  getShiftHours,
  setShiftHours,
  validateHours,
  stayDay,
  noonCairo,
  nightsBetween,
  stayDays,
};
