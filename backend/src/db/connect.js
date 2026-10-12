const mongoose = require('mongoose');
const env = require('../config/env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    return conn;
  } catch (error) {
    console.error('Database connection failed (fail-fast):', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
