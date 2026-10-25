async function paginateM(
  Model,
  filter,
  { page = 1, limit = 20, sort = { _id: -1 } } = {},
  toDto = (d) => d
) {
  limit = Math.min(Number(limit) || 20, 100);
  page = Math.max(Number(page) || 1, 1);
  const [docs, total] = await Promise.all([
    Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  const data = await Promise.all(docs.map((d) => toDto(d)));
  return {
    data,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

module.exports = { paginateM };
