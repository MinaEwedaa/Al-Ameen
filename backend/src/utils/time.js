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

function shiftWindow(shiftDate, shiftType) {
  const s = SHIFTS[shiftType];
  const base = DateTime.fromISO(shiftDate, { zone: ZONE }).startOf('day');
  const startAt = base.set({ hour: s.start, minute: 0, second: 0, millisecond: 0 });
  const endAt = base
    .plus({ days: s.endDayOffset })
    .set({ hour: s.end, minute: 0, second: 0, millisecond: 0 });

  return {
    startAt: startAt.toUTC().toJSDate(),
    endAt: endAt.toUTC().toJSDate(),
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
  NEXT_SHIFT,
  cairoDate,
  shiftWindow,
  stayDay,
  noonCairo,
  nightsBetween,
  stayDays,
};
