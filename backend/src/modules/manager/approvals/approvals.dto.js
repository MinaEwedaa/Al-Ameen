const { toEgp } = require('../../../utils/money');

const iso = (d) => (d ? new Date(d).toISOString() : null);
const idOrNull = (v) => (v ? String(v) : null);

function toApprovalDto(a, { requesterName = null, reservation = null, netOverride } = {}) {
  const net = netOverride !== undefined ? netOverride : a.net_paid_amount || 0;
  return {
    approval_id: String(a._id),
    booking_id: idOrNull(a.reservation_id),
    request_type: a.request_type,
    status: a.status,
    requested_by_staff_id: idOrNull(a.requested_by_staff_id),
    requested_by_name: requesterName,
    reason: a.reason || '',
    requested_refund_amount: toEgp(a.requested_refund_amount || 0),
    net_paid_amount: toEgp(net),
    approved_refund_amount: toEgp(a.approved_refund_amount || 0),
    retained_amount: toEgp(a.amount_retained || 0),
    manager_comment: a.manager_comment ?? null,
    decided_by_staff_id: idOrNull(a.decided_by_staff_id),
    decided_at: iso(a.decided_at),
    created_at: iso(a.createdAt),
    reservation,
  };
}

module.exports = { toApprovalDto };