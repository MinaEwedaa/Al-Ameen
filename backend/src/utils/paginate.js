async function paginate(
  Model,
  filter,
  { page = 1, limit = 20, sort = { _id: -1 }, populate } = {},
  toDto = (doc) => doc
) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  let query = Model.find(filter)
    .sort(sort)
    .skip((p - 1) * l)
    .limit(l);

  if (populate) {
    query = query.populate(populate);
  }

  const [docs, total] = await Promise.all([
    query.lean(),
    Model.countDocuments(filter),
  ]);

  return {
    data: docs.map(toDto),
    meta: {
      page: p,
      limit: l,
      total,
    },
  };
}

module.exports = { paginate };
