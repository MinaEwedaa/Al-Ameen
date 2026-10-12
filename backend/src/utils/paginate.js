async function paginate(
  Model,
  filter,
  { page = 1, limit = 20, sort = { _id: -1 } } = {},
  toDto = (doc) => doc
) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));

  const [docs, total] = await Promise.all([
    Model.find(filter)
      .sort(sort)
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
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
