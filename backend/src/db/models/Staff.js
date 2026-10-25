const { Schema, model } = require('mongoose');

const staffSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    default_shift_type: {
      type: String,
      enum: ['morning', 'evening', 'night', null],
      default: function () {
        return this.role === 'receptionist' ? 'morning' : null;
      },
      required: function () {
        return this.role === 'receptionist';
      },
    },
    role: {
      type: String,
      enum: ['receptionist', 'manager', 'admin', 'housekeeper', 'technician'],
      default: 'receptionist',
    },
    active: {
      type: Boolean,
      default: true,
    },
    failed_attempts: {
      type: Number,
      default: 0,
    },
    lock_level: {
      type: Number,
      default: 0,
    },
    locked_until: {
      type: Date,
      default: null,
    },
    // M1 Added fields
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    hire_date: {
      type: Date,
    },
    name_search: {
      type: String,
      index: true,
    },
    id_number_enc: {
      type: String,
    },
    id_number_hash: {
      type: String,
      unique: true,
      sparse: true,
    },
    id_number_last4: {
      type: String,
    },
    notification_prefs: {
      type: new Schema(
        {
          approval_request: { type: Boolean, default: true },
          leave_request: { type: Boolean, default: true },
          critical_maintenance: { type: Boolean, default: true },
          critical_complaint: { type: Boolean, default: true },
          shift_report_submitted: { type: Boolean, default: true },
          system: { type: Boolean, default: true },
        },
        { _id: false }
      ),
      default: () => ({
        approval_request: true,
        leave_request: true,
        critical_maintenance: true,
        critical_complaint: true,
        shift_report_submitted: true,
        system: true,
      }),
    },
    password_changed_at: {
      type: Date,
      default: null,
    },
    deactivated_at: {
      type: Date,
      default: null,
    },
    created_by_staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = model('Staff', staffSchema);
