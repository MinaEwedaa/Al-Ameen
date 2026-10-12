require('dotenv').config();
const connectDB = require('../db/connect');
const models = require('../db/models');

async function syncAllIndexes() {
  console.log('Connecting to MongoDB for index synchronization...');
  await connectDB();
  console.log('Connected. Syncing indexes for all models...');

  for (const [name, model] of Object.entries(models)) {
    try {
      await model.syncIndexes();
      console.log(`[Synced] ${name} indexes successfully.`);
    } catch (err) {
      console.error(`[Error] Failed to sync indexes for ${name}:`, err.message);
    }
  }

  console.log('Index synchronization completed.');
  process.exit(0);
}

syncAllIndexes().catch((err) => {
  console.error('Index sync failed:', err);
  process.exit(1);
});
