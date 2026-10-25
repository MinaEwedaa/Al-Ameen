const { Schema, model } = require('mongoose');

const dailyClosingSchema = new Schema(
  {
    business_date: {
      type: String, // 'yyyy-MM-dd'
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
    },
    opened_at: {
      type: Date,
      default: Date.now,
    },
    closed_at: {
      type: Date,
      default: null,
    },
    opened_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    closed_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    cash_total: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    instapay_total: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    vodafone_cash_total: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    gross_revenue: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    refunds_total: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    revenue_total: {
      type: Number,
      default: 0, // Integer in Piastres
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Prevents two open business days at the same time
dailyClosingSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } }
);

module.exports = model('DailyClosing', dailyClosingSchema);
