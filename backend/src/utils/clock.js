const env = require('../config/env');

// الوقت الحقيقي دايمًا، إلا في الاختبارات بس: نسمح بـ X-Test-Time
function getNow(req) {
  if (env.nodeEnv === 'test') {
    const h = req.get('x-test-time');
    if (h) {
      const d = new Date(h);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

module.exports = { getNow };