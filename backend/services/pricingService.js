const { ScrapRate, WasteCategory } = require('../models');
const ApiError = require('../utils/ApiError');

/** Active rate for a category, preferring a city-specific rate over the 'All' rate. */
async function getActiveRate(categoryId, city) {
  const rates = await ScrapRate.find({ category: categoryId, isActive: true, city: { $in: [city || 'All', 'All'] } })
    .sort({ effectiveFrom: -1 })
    .lean();
  if (!rates.length) return null;
  return rates.find((r) => city && r.city.toLowerCase() === city.toLowerCase()) || rates[0];
}

/** Map of categoryId -> active rate (All-city), used for listing rates. */
async function getRateTable(city) {
  const categories = await WasteCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const out = [];
  for (const c of categories) {
    // eslint-disable-next-line no-await-in-loop
    const rate = await getActiveRate(c._id, city);
    out.push({ ...c, rate: rate ? { pricePerKg: rate.pricePerKg, unit: rate.unit, city: rate.city, rateId: rate._id, effectiveFrom: rate.effectiveFrom } : null });
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Indicative price: Estimated Weight × Current Admin-Managed Rate Per KG.
 * items: [{ categoryId, estimatedWeightKg }]
 */
async function estimateScrapPrice(items, city) {
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest('Add at least one waste item');
  const lines = [];
  for (const it of items) {
    // eslint-disable-next-line no-await-in-loop
    const category = await WasteCategory.findOne({ _id: it.categoryId, isActive: true }).lean();
    if (!category) throw ApiError.badRequest('Unknown or inactive waste category');
    // eslint-disable-next-line no-await-in-loop
    const rate = await getActiveRate(category._id, city);
    if (!rate) throw ApiError.badRequest(`No active rate configured for ${category.name}`);
    lines.push({
      categoryId: category._id,
      name: category.name,
      slug: category.slug,
      estimatedWeightKg: it.estimatedWeightKg,
      ratePerKg: rate.pricePerKg,
      resalePricePerKg: rate.resalePricePerKg,
      estimatedPrice: round2(it.estimatedWeightKg * rate.pricePerKg),
    });
  }
  const totalWeight = round2(lines.reduce((s, l) => s + l.estimatedWeightKg, 0));
  const totalPrice = round2(lines.reduce((s, l) => s + l.estimatedPrice, 0));
  return {
    lines,
    totalWeightKg: totalWeight,
    estimatedPrice: totalPrice,
    disclaimer: 'Indicative estimate only. The final price is based on the weight verified by the collector at pickup.',
  };
}

module.exports = { getActiveRate, getRateTable, estimateScrapPrice, round2 };
