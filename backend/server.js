require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check / base route
app.get('/', (req, res) => {
  res.send('Hotel API is running');
});

// ==========================================
// Routes Placeholder
// Mount future routes here, for example:
// app.use('/api/staff', require('./routes/staff'));
// app.use('/api/rooms', require('./routes/rooms'));
// app.use('/api/shifts', require('./routes/shifts'));
// app.use('/api/cleaning-tasks', require('./routes/cleaningTasks'));
// app.use('/api/maintenance-issues', require('./routes/maintenanceIssues'));
// ==========================================

const PORT = process.env.PORT || 5000;

// Start listening only after DB connection resolves
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
