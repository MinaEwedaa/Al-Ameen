// Shared Contract-to-Database Name Mappings for Manager Module (M4-M14)

const PRIORITY_MAP = {
  low: 'LOW',
  medium: 'NORMAL',
  high: 'HIGH',
  urgent: 'RUSH',
};

const PRIORITY_MAP_REV = {
  LOW: 'low',
  NORMAL: 'medium',
  HIGH: 'high',
  RUSH: 'urgent',
};

const PAYMENT_TYPE_MAP = {
  payment: 'PAYMENT',
  refund: 'REFUND',
  correction: 'CORRECTION',
};

const PAYMENT_TYPE_MAP_REV = {
  PAYMENT: 'payment',
  REFUND: 'refund',
  CORRECTION: 'correction',
};

module.exports = {
  PRIORITY_MAP,
  PRIORITY_MAP_REV,
  PAYMENT_TYPE_MAP,
  PAYMENT_TYPE_MAP_REV,
};
