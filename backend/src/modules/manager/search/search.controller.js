const searchService = require('./search.service');

async function search(req, res, next) {
  try {
    const { q, limit } = req.query;
    const result = await searchService.globalSearch({ q, limit });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  search,
};
