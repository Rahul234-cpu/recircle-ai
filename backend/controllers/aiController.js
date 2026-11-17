const { Product, ProductCategory } = require('../models');
const { PRODUCT_STATUS: P } = require('../config/constants');
const ai = require('../services/aiClient');
const { storeImages } = require('../services/storageService');
const wasteController = require('./wasteController');

// POST /api/ai/classify — same pipeline as /api/waste/analyze (single implementation).
exports.classify = wasteController.analyze;

/** Reuse vs Recycle vs Repair vs Donate. Image optional; user keeps the final decision. */
exports.recommend = async (req, res) => {
  let imageUrl;
  const payload = { ...req.body };
  if (req.file) {
    [{ url: imageUrl }] = await storeImages([req.file], 'analysis');
    payload.image_base64 = req.file.buffer.toString('base64');
    payload.mime_type = req.file.mimetype;
  }
  const categories = await ProductCategory.find({ isActive: true }).select('name slug').lean();
  payload.available_categories = categories.map((c) => c.slug);
  payload.age_months = payload.ageMonths;
  payload.is_working = payload.isWorking;
  delete payload.ageMonths;
  delete payload.isWorking;

  const result = await ai.recommend(payload, { userId: req.user._id, imageUrl });
  res.json({ success: true, recommendation: result, note: 'This is a suggestion. You decide what to do with your item.' });
};

/** Second-hand price range using comparable sold listings from our own marketplace. */
exports.priceEstimate = async (req, res) => {
  const b = req.body;
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const comparables = await Product.find({
    category: b.category,
    status: P.SOLD,
    soldAt: { $gte: since },
  }).sort({ soldAt: -1 }).limit(30).select('sellingPrice condition ageMonths brand originalPrice').lean();

  const result = await ai.priceEstimate({
    category: b.category,
    brand: b.brand,
    title: b.title,
    age_months: b.ageMonths,
    condition: b.condition,
    original_price: b.originalPrice,
    comparables: comparables.map((c) => ({
      price: c.sellingPrice, condition: c.condition, age_months: c.ageMonths, brand: c.brand, original_price: c.originalPrice,
    })),
  }, { userId: req.user._id });
  res.json({ success: true, estimate: result });
};

exports.generateDescription = async (req, res) => {
  const b = req.body;
  const result = await ai.generateDescription({
    title: b.title, category: b.category, brand: b.brand, condition: b.condition, age_months: b.ageMonths, features: b.features || [], notes: b.notes,
  }, { userId: req.user._id });
  res.json({ success: true, ...result });
};

exports.chat = async (req, res) => {
  const result = await ai.chat({ message: req.body.message, history: req.body.history || [], user_role: req.user?.role || 'guest' }, { userId: req.user?._id });
  res.json({ success: true, ...result });
};

exports.health = async (req, res) => {
  res.json({ success: true, ai: await ai.health() });
};
