const mongoose = require('mongoose');

/**
 * Runs a callback inside a MongoDB multi-document transaction.
 * @param {Function} fn - async function receiving (session)
 * @returns {Promise<*>} result of the callback
 */
async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction };
