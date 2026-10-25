const mongoose = require('mongoose');
const env = require('../config/env');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(env.mongoUri);
    console.log('Successfully connected to MongoDB Atlas!');
    return conn;
  } catch (error) {
    console.error('Database connection failed (fail-fast):', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
