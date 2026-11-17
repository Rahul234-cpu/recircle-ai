const { WasteCategory } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, paginated } = require('../utils/pagination');
const { storeImages } = require('../services/storageService');
const ai = require('../services/aiClient');
const pricing = require('../services/pricingService');
const bookings = require('../services/bookingService');

const NEXT_ACTION = {
  paper: 'Keep it dry and bundle it. Book an EcoPartner pickup.',
  cardboard: 'Flatten boxes to save space, keep dry, and book a pickup.',
  plastic: 'Rinse and dry containers, remove food residue, then book a pickup.',
  metal: 'Separate iron/steel from aluminium if you can, then book a pickup.',
  glass: 'Do not break bottles; pack them safely and book a pickup.',
  'e-waste': 'Remove batteries and personal data. If it still works, consider listing it for reuse instead.',
  textile: 'Wearable clothes can be donated or listed; worn-out textiles go for recycling.',
  mixed: 'Please separate the items by material for an accurate price, then re-upload.',
};

exports.categories = async (req, res) => {
  res.json({ success: true, categories: await pricing.getRateTable(req.query.city) });
};

/** Upload one waste image → AI classification → mapped to an admin-managed category + rate. */
exports.analyze = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Please upload an image of your waste');
  const [stored] = await storeImages([req.file], 'waste');
  const payload = {
    image_base64: req.file.buffer.toString('base64'),
    mime_type: req.file.mimetype,
    filename: req.file.originalname,
    description: req.body.description || '',
  };

  let result;
  try {
    result = await ai.classify(payload, { userId: req.user._id, imageUrl: stored.url });
  } catch (err) {
    if (err.statusCode !== 503) throw err;
    return res.json({
      success: true,
      aiAvailable: false,
      imageUrl: stored.url,
      analysisId: err.analysisId,
      message: err.message,
    });
  }

  const categories = await WasteCategory.find({ isActive: true }).lean();
  const byMaterial = (m) => categories.filter((c) => c.materialType === m);
  const suggested = byMaterial(result.material)[0] || null;
  const rate = suggested ? await pricing.getActiveRate(suggested._id) : null;

  res.json({
    success: true,
    aiAvailable: true,
    analysisId: result.analysisId,
    imageUrl: stored.url,
    material: result.material,
    confidence: result.confidence,
    predictions: result.predictions,
    provider: result.provider,
    isDemo: result.is_demo,
    limitations: result.limitations,
    suggestedCategory: suggested && {
      _id: suggested._id,
      name: suggested.name,
      slug: suggested.slug,
      recyclable: suggested.recyclable,
      recyclingInfo: suggested.recyclingInfo,
      handlingTips: suggested.handlingTips,
      ratePerKg: rate?.pricePerKg ?? null,
    },
    alternativeCategories: byMaterial(result.material).slice(1).map((c) => ({ _id: c._id, name: c.name })),
    recyclable: suggested ? suggested.recyclable : result.material !== 'mixed',
    nextAction: NEXT_ACTION[result.material] || NEXT_ACTION.mixed,
  });
};

exports.estimate = async (req, res) => {
  res.json({ success: true, estimate: await pricing.estimateScrapPrice(req.body.items, req.body.city) });
};

exports.createBooking = async (req, res) => {
  const result = await bookings.createBooking(req.user, req.body);
  res.status(201).json({ success: true, ...result });
};

exports.listBookings = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 10 });
  const { items, total } = await bookings.listBookings(req.user, { ...req.query, ...pg });
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.getBooking = async (req, res) => {
  res.json({ success: true, booking: await bookings.getBooking(req.user, req.params.id) });
};

exports.updateStatus = async (req, res) => {
  const booking = await bookings.updateStatus(req.user, req.params.id, req.body);
  res.json({ success: true, booking: bookings.viewFor(booking, req.user) });
};

exports.receipt = async (req, res) => {
  res.json({ success: true, receipt: await bookings.getReceipt(req.user, req.params.id) });
};
