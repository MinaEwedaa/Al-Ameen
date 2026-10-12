const app = require('./app');
const env = require('./config/env');
const connectDB = require('./db/connect');

connectDB().then(() => {
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });
});
