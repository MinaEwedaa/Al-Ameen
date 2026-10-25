const { Schema, model } = require('mongoose');

const shiftReportSchema = new Schema(
  {
    shift_id: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
      required: true,
      unique: true,
    },
    pdf: {
      type: Buffer,
      default: null,
    },
    sha256: {
      type: String,
      default: null,
    },
    pdf_data: {
      type: Buffer,
      select: false,
      default: null,
    },
    pdf_generated_at: {
      type: Date,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    // M1 added fields
    shift_date: {
      type: String, // 'yyyy-MM-dd'
    },
    shift_type: {
      type: String,
      enum: ['morning', 'evening', 'night'],
    },
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
    staff_name: {
      type: String,
    },
    handled_rooms: {
      type: Number,
      default: 0,
    },
    tasks_cleaning: {
      type: Number,
      default: 0,
    },
    maintenance_requests: {
      type: Number,
      default: 0,
    },
    pending_items: {
      type: Number,
      default: 0,
    },
    cash_total: {
      type: Number,
      default: 0,
    },
    instapay_total: {
      type: Number,
      default: 0,
    },
    vodafone_cash_total: {
      type: Number,
      default: 0,
    },
    gross_revenue: {
      type: Number,
      default: 0,
    },
    refunds_total: {
      type: Number,
      default: 0,
    },
    cancellation_retained_total: {
      type: Number,
      default: 0,
    },
    net_revenue: {
      type: Number,
      default: 0,
    },
    review_status: {
      type: String,
      enum: ['PENDING_REVIEW', 'APPROVED', 'NEEDS_REVIEW'],
      default: 'PENDING_REVIEW',
    },
    reviewed_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    manager_comment: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

shiftReportSchema.index({ review_status: 1, shift_date: 1 });
shiftReportSchema.index({ shift_date: 1 });

module.exports = model('ShiftReport', shiftReportSchema);
