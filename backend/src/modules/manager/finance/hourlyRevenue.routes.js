const router = require('express').Router();
const { DateTime } = require('luxon');
const { Payment } = require('../../../db/models');
const { ZONE, todayCairo } = require('../../../utils/time');
const { toEgp } = require('../../../utils/money');

router.get('/hourly-revenue', async (req, res, next) => {
  try {
    const businessDate = req.query.date || todayCairo();
    const dt = DateTime.fromISO(businessDate, { zone: ZONE });
    const start = dt.startOf('day').toJSDate();
    const end = dt.endOf('day').toJSDate();

    const payments = await Payment.find({
      payment_datetime: { $gte: start, $lte: end },
    }).lean();

    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
    const hourTotals = {
      '09': 0,
      '10': 0,
      '11': 0,
      '12': 0,
      '13': 0,
      '14': 0,
      '15': 0,
      '16': 0,
    };

    for (const p of payments) {
      const pDt = DateTime.fromJSDate(p.payment_datetime, { zone: ZONE });
      const hStr = pDt.toFormat('HH');
      if (hourTotals[hStr] !== undefined) {
        hourTotals[hStr] += toEgp(p.amount);
      }
    }

    const points = hours.map((h) => Math.round(hourTotals[h.slice(0, 2)] || 0));

    res.json({
      data: {
        business_date: businessDate,
        hours,
        points,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

