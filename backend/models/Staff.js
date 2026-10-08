const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const staffSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password_hash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Static helper to hash plain text password with bcrypt (salt rounds: 10)
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
staffSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainPassword, salt);
};

/**
 * Static helper to compare candidate password with a hash
 * @param {string} candidatePassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
staffSchema.statics.comparePassword = async function (candidatePassword, hash) {
  return await bcrypt.compare(candidatePassword, hash);
};

/**
 * Instance method to compare candidate password with this staff member's password_hash
 * Note: If querying without selecting password_hash, retrieve it first using .select('+password_hash')
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
staffSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

module.exports = mongoose.model('Staff', staffSchema);
