const {
  User, Collector, WasteCategory, ScrapRate, PickupBooking, Product, Order, Transaction, Complaint, AIAnalysis, ProductCategory, EcoReward,
} = require('../models');
const { BOOKING_STATUS: B, PRODUCT_STATUS: P, ORDER_STATUS: O } = require('../config/constants');
const { productMachine } = require('../utils/stateMachines');
const ApiError = require('../utils/ApiError');
const { getPagination, paginated } = require('../utils/pagination');
const { notify } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const bookings = require('../services/bookingService');
const rewards = require('../services/rewardService');
const settingsService = require('../services/settingsService');
const { platformImpact } = require('../services/impactService');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function monthsBack(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - (n - 1));
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function monthlyCounts(Model, match = {}, since = monthsBack(6)) {
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [`${r._id.y}-${String(r._id.m).padStart(2, '0')}`, r.n]));
}

function monthKeys(n = 6) {
  const out = [];
  const d = monthsBack(n);
  for (let i = 0; i < n; i += 1) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

// ------------------------------------------------------------ dashboard & analytics
exports.dashboard = async (req, res) => {
  const [users, collectors, pendingVerification, bookingsTotal, completed, listings, activeOrders, txAgg, wasteByCat] = await Promise.all([
    User.countDocuments(),
    Collector.countDocuments({ verificationStatus: 'approved' }),
    Collector.countDocuments({ verificationStatus: 'pending' }),
    PickupBooking.countDocuments(),
    PickupBooking.countDocuments({ status: B.COMPLETED }),
    Product.countDocuments({ status: { $in: [P.AVAILABLE, P.RESERVED, P.PENDING_APPROVAL] } }),
    Order.countDocuments({ status: { $in: [O.REQUESTED, O.ACCEPTED] } }),
    Transaction.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    bookingsByMaterial(),
  ]);
  const keys = monthKeys(6);
  const [u, b, p] = await Promise.all([monthlyCounts(User), monthlyCounts(PickupBooking), monthlyCounts(Product)]);
  res.json({
    success: true,
    stats: {
      totalUsers: users,
      totalCollectors: collectors,
      pendingVerification,
      totalBookings: bookingsTotal,
      completedCollections: completed,
      totalListings: listings,
      activeOrders,
      transactions: Object.fromEntries(txAgg.map((t) => [t._id, { total: t.total, count: t.count }])),
    },
    growth: keys.map((k) => ({ month: k, users: u[k] || 0, bookings: b[k] || 0, listings: p[k] || 0 })),
    wasteByCategory: wasteByCat,
  });
};

async function bookingsByMaterial() {
  return PickupBooking.aggregate([
    { $unwind: '$materialSummary' },
    {
      $group: {
        _id: '$materialSummary.name',
        estimatedKg: { $sum: '$materialSummary.estimatedWeightKg' },
        bookings: { $sum: 1 },
      },
    },
    { $project: { _id: 0, name: '$_id', estimatedKg: { $round: ['$estimatedKg', 1] }, bookings: 1 } },
    { $sort: { estimatedKg: -1 } },
  ]);
}

exports.analytics = async (req, res) => {
  const keys = monthKeys(12);
  const since = monthsBack(12);
  const [revenue, bookingStatus, orderStatus, aiByType, aiByProvider, aiDaily, impact, topCollectors] = await Promise.all([
    Transaction.aggregate([
      { $match: { createdAt: { $gte: since }, paymentStatus: 'paid' } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, t: '$type' }, total: { $sum: '$amount' } } },
    ]),
    PickupBooking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    AIAnalysis.aggregate([{ $group: { _id: '$type', n: { $sum: 1 }, ok: { $sum: { $cond: ['$success', 1, 0] } }, avgLatency: { $avg: '$latencyMs' }, avgConfidence: { $avg: '$confidence' } } }]),
    AIAnalysis.aggregate([{ $group: { _id: { $ifNull: ['$provider', 'failed'] }, n: { $sum: 1 } } }]),
    AIAnalysis.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 14 * 864e5) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    platformImpact(),
    Collector.find({ verificationStatus: 'approved' }).sort({ completedCollections: -1 }).limit(5).populate('userId', 'name').select('businessName completedCollections averageRating totalKgCollected').lean(),
  ]);
  const rev = {};
  revenue.forEach((r) => {
    const k = `${r._id.y}-${String(r._id.m).padStart(2, '0')}`;
    rev[k] = rev[k] || { scrap: 0, marketplace: 0 };
    rev[k][r._id.t === 'scrap_collection' ? 'scrap' : 'marketplace'] = r.total;
  });
  res.json({
    success: true,
    transactionsByMonth: keys.map((k) => ({ month: k, scrap: rev[k]?.scrap || 0, marketplace: rev[k]?.marketplace || 0 })),
    bookingStatus: bookingStatus.map((s) => ({ status: s._id, count: s.n })),
    orderStatus: orderStatus.map((s) => ({ status: s._id, count: s.n })),
    ai: {
      byType: aiByType.map((a) => ({ type: a._id, calls: a.n, successRate: a.n ? Math.round((a.ok / a.n) * 100) : 0, avgLatencyMs: Math.round(a.avgLatency || 0), avgConfidence: a.avgConfidence ? Math.round(a.avgConfidence * 100) / 100 : null })),
      byProvider: aiByProvider.map((a) => ({ provider: a._id, calls: a.n })),
      daily: aiDaily.map((d) => ({ day: d._id, calls: d.n })),
    },
    wasteByCategory: await bookingsByMaterial(),
    impact,
    topCollectors,
  });
};

exports.aiActivity = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  const [items, total] = await Promise.all([
    AIAnalysis.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('user', 'name email').lean(),
    AIAnalysis.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

// ------------------------------------------------------------ users
exports.listUsers = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const re = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).select('-addresses -recentlyViewed').lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.updateUser = async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own admin account here');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  if (req.body.role) user.role = req.body.role;
  await user.save();
  res.json({ success: true, user: user.toSafeJSON() });
};

// ------------------------------------------------------------ collectors
exports.listCollectors = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status) filter.verificationStatus = req.query.status;
  if (req.query.q) filter.businessName = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    Collector.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('userId', 'name email phone isActive createdAt').lean(),
    Collector.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.verifyCollector = async (req, res) => {
  const collector = await Collector.findById(req.params.id).populate('userId', 'name email');
  if (!collector) throw ApiError.notFound('Collector not found');
  const { decision, note } = req.body;
  collector.verificationStatus = decision;
  collector.verificationNote = note;
  collector.verifiedAt = new Date();
  collector.verifiedBy = req.user._id;
  await collector.save();
  await notify(collector.userId._id, {
    type: `collector.${decision}`,
    title: decision === 'approved' ? 'You are verified! 🎉' : 'Verification not approved',
    message: decision === 'approved' ? 'You will now receive nearby pickup requests.' : `Reason: ${note || 'Details could not be verified.'}`,
    link: '/collector',
  });
  sendEmail({ to: collector.userId.email, subject: `ReCircle collector verification: ${decision}`, text: `Hi ${collector.userId.name}, your collector application was ${decision}. ${note || ''}` });
  res.json({ success: true, collector });
};

// ------------------------------------------------------------ waste categories
exports.listWasteCategories = async (req, res) => {
  res.json({ success: true, items: await WasteCategory.find().sort({ sortOrder: 1, name: 1 }).lean() });
};
exports.createWasteCategory = async (req, res) => {
  const doc = await WasteCategory.create({ ...req.body, slug: slugify(req.body.name) });
  res.status(201).json({ success: true, item: doc });
};
exports.updateWasteCategory = async (req, res) => {
  const doc = await WasteCategory.findByIdAndUpdate(req.params.id, { ...req.body, slug: slugify(req.body.name) }, { new: true, runValidators: true });
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
};
exports.deleteWasteCategory = async (req, res) => {
  // Soft-delete: categories are referenced by historical bookings.
  const doc = await WasteCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!doc) throw ApiError.notFound();
  await ScrapRate.updateMany({ category: doc._id }, { isActive: false });
  res.json({ success: true, item: doc });
};

// ------------------------------------------------------------ product categories
exports.listProductCategories = async (req, res) => {
  res.json({ success: true, items: await ProductCategory.find().sort({ sortOrder: 1, name: 1 }).lean() });
};
exports.createProductCategory = async (req, res) => {
  const doc = await ProductCategory.create({ ...req.body, slug: slugify(req.body.name) });
  res.status(201).json({ success: true, item: doc });
};
exports.updateProductCategory = async (req, res) => {
  const existing = await ProductCategory.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  // Keep the slug stable — listings reference it.
  Object.assign(existing, { ...req.body, slug: existing.slug });
  await existing.save();
  res.json({ success: true, item: existing });
};
exports.deleteProductCategory = async (req, res) => {
  const doc = await ProductCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!doc) throw ApiError.notFound();
  res.json({ success: true, item: doc });
};

// ------------------------------------------------------------ scrap rates (versioned)
exports.listScrapRates = async (req, res) => {
  const filter = req.query.status === 'all' ? {} : { isActive: true };
  const items = await ScrapRate.find(filter).sort({ isActive: -1, updatedAt: -1 }).populate('category', 'name slug materialType').populate('updatedBy', 'name').lean();
  res.json({ success: true, items });
};

exports.createScrapRate = async (req, res) => {
  const cat = await WasteCategory.findById(req.body.category);
  if (!cat) throw ApiError.badRequest('Unknown category');
  const city = req.body.city || 'All';
  await ScrapRate.updateMany({ category: cat._id, city, isActive: true }, { isActive: false });
  const doc = await ScrapRate.create({ ...req.body, city, updatedBy: req.user._id });
  res.status(201).json({ success: true, item: await doc.populate('category', 'name slug') });
};

exports.updateScrapRate = async (req, res) => {
  const old = await ScrapRate.findById(req.params.id);
  if (!old || !old.isActive) throw ApiError.notFound('Active rate not found');
  old.isActive = false;
  await old.save();
  const doc = await ScrapRate.create({
    category: old.category, city: old.city, unit: old.unit,
    pricePerKg: req.body.pricePerKg,
    resalePricePerKg: req.body.resalePricePerKg ?? old.resalePricePerKg,
    updatedBy: req.user._id,
  });
  res.json({ success: true, item: await doc.populate('category', 'name slug') });
};

exports.deleteScrapRate = async (req, res) => {
  const doc = await ScrapRate.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!doc) throw ApiError.notFound();
  res.json({ success: true });
};

// ------------------------------------------------------------ bookings / listings / orders / transactions
exports.listBookings = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status) filter.status = { $in: req.query.status.split(',') };
  if (req.query.q) filter.bookingRef = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    PickupBooking.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .populate('customerId', 'name email').populate('collectorId', 'name').populate('collectorProfile', 'businessName').lean(),
    PickupBooking.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.assignBooking = async (req, res) => {
  res.json({ success: true, booking: await bookings.adminAssign(req.user, req.params.id, req.body.collectorUserId) });
};

exports.listProducts = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status) filter.status = { $in: req.query.status.split(',') };
  if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('sellerId', 'name email').lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.setProductStatus = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound();
  const { status, reason } = req.body;
  if (!productMachine.canTransition(product.status, status, 'admin')) {
    throw ApiError.conflict(`Cannot change listing from ${product.status} to ${status}`);
  }
  product.status = status;
  if (status === P.REJECTED || status === P.REMOVED) product.rejectionReason = reason;
  await product.save();
  if (status === P.REMOVED) {
    // Cancel open orders on a removed listing.
    await Order.updateMany({ product: product._id, status: { $in: [O.REQUESTED, O.ACCEPTED] } }, {
      status: O.CANCELLED, $push: { statusHistory: { status: O.CANCELLED, role: 'admin', note: 'Listing removed by admin', at: new Date() } },
    });
  }
  const msg = { [P.AVAILABLE]: 'is now live', [P.REJECTED]: 'was not approved', [P.REMOVED]: 'was removed by our moderation team' };
  await notify(product.sellerId, { type: 'listing.status', title: `Listing ${status.toLowerCase()}`, message: `"${product.title}" ${msg[status] || status}. ${reason || ''}`, link: '/customer/listings' });
  res.json({ success: true, product });
};

exports.listOrders = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status) filter.status = { $in: req.query.status.split(',') };
  if (req.query.q) filter.orderRef = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .populate('product', 'title').populate('buyer seller', 'name email').lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.listTransactions = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.q) filter.transactionId = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total, sum] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('buyerId sellerId', 'name').lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  res.json({ success: true, totalAmount: sum[0]?.total || 0, ...paginated(items, total, pg) });
};

// ------------------------------------------------------------ complaints
exports.listComplaints = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Complaint.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('user', 'name email role').lean(),
    Complaint.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.updateComplaint = async (req, res) => {
  const c = await Complaint.findById(req.params.id);
  if (!c) throw ApiError.notFound();
  c.status = req.body.status;
  if (req.body.adminResponse) c.adminResponse = req.body.adminResponse;
  if (['resolved', 'closed'].includes(c.status)) { c.resolvedBy = req.user._id; c.resolvedAt = new Date(); }
  await c.save();
  await notify(c.user, { type: 'complaint.updated', title: `Complaint ${c.complaintRef} ${c.status.replace('_', ' ')}`, message: c.adminResponse || '', link: '/complaints' });
  res.json({ success: true, complaint: c });
};

// ------------------------------------------------------------ rewards & settings
exports.listRewards = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 25 });
  const [items, total, top] = await Promise.all([
    EcoReward.find().sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).populate('user', 'name email').lean(),
    EcoReward.countDocuments(),
    User.find({ ecoPoints: { $gt: 0 } }).sort({ ecoPoints: -1 }).limit(10).select('name ecoPoints role').lean(),
  ]);
  res.json({ success: true, leaderboard: top, ...paginated(items, total, pg) });
};

exports.adjustRewards = async (req, res) => {
  const user = await User.findById(req.body.userId);
  if (!user) throw ApiError.notFound('User not found');
  const entry = await rewards.award(user._id, req.body.points, req.body.reason, 'admin', undefined, req.user._id);
  await notify(user._id, { type: 'reward.adjusted', title: 'Eco-points updated', message: `${req.body.points > 0 ? '+' : ''}${req.body.points} points: ${req.body.reason}`, link: '/customer/impact' });
  res.status(201).json({ success: true, entry });
};

exports.getSettings = async (req, res) => {
  res.json({ success: true, settings: await settingsService.getSettings() });
};

exports.updateSettings = async (req, res) => {
  res.json({ success: true, settings: await settingsService.updateSettings(req.body, req.user._id) });
};
