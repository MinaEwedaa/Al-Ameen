// الدالة الوحيدة اللي بتحسب إجمالي الحجز. كل المبالغ بالقروش (Piastres).
// محدش تاني يحسب الإجمالي في أي مكان تاني.
const computeTotal = (r) =>
  r.nights * r.price_per_night_snapshot +
  (r.half_day_extensions + (r.early_arrival ? 1 : 0)) * r.half_day_price_snapshot;

module.exports = { computeTotal };