const { Schema, model } = require('mongoose');

const expenseSchema = new Schema(
  {
    expense_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['CLEANING', 'MAINTENANCE', 'UTILITIES', 'EMERGENCY'],
      default: 'CLEANING',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'EGP',
    },
    recorded_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
    recorded_by_staff_name: {
      type: String,
      default: null,
    },
    business_date: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: null,
    },
    invoice_url: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = model('Expense', expenseSchema);

