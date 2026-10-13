// ObjectId صالح = 24 حرف hex بالظبط (mongoose.isValidObjectId بتقبل نصوص من 12 حرف، فمش مناسبة)
const isObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

module.exports = { isObjectId };