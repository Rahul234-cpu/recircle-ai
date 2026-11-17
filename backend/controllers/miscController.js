const mongoose = require('mongoose');
const {
  Notification, Message, Favourite, Product, Order, Complaint, Transaction, EcoReward, PickupBooking, User,
} = require('../models');
const { ORDER_STATUS: O, PRODUCT_STATUS: P, BOOKING_STATUS: B } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { getPagination, paginated } = require('../utils/pagination');
const { maskContactInfo, sanitizeText } = require('../utils/privacy');
const { makeRef } = require('../utils/ids');
const { notify } = require('../services/notificationService');
const { emitToUser, emitToRole } = require('../sockets');
const reviews = require('../services/reviewService');
const { platformImpact, userImpact } = require('../services/impactService');
const { sendEmail } = require('../services/emailService');
const env = require('../config/env');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

// ------------------------------------------------------------ notifications
exports.listNotifications = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ success: true, unread, ...paginated(items, total, pg) });
};

exports.markNotificationRead = async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { readAt: new Date() });
  res.json({ success: true });
};

exports.markAllRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
};

// ------------------------------------------------------------ messages
const conversationKey = (productId, a, b) => `${productId}:${[String(a), String(b)].sort().join(':')}`;

async function hasAcceptedOrder(productId, a, b) {
  return Boolean(await Order.exists({
    product: productId,
    status: { $in: [O.ACCEPTED, O.COMPLETED] },
    $or: [{ buyer: a, seller: b }, { buyer: b, seller: a }],
  }));
}

exports.sendMessage = async (req, res) => {
  const { productId, recipientId, body } = req.body;
  if (String(recipientId) === String(req.user._id)) throw ApiError.badRequest('You cannot message yourself');
  const product = await Product.findById(productId).select('sellerId title status');
  if (!product || product.status === P.REMOVED) throw ApiError.notFound('Product not found');
  const sellerInvolved = [String(req.user._id), String(recipientId)].includes(String(product.sellerId));
  if (!sellerInvolved) throw ApiError.forbidden('Messages must be between a buyer and the seller of this product');
  const recipient = await User.findById(recipientId).select('_id isActive');
  if (!recipient?.isActive) throw ApiError.notFound('Recipient not found');

  // Contact details stay hidden until the seller accepts an order.
  const unlocked = await hasAcceptedOrder(productId, req.user._id, recipientId);
  const clean = sanitizeText(body);
  const masked = unlocked ? clean : maskContactInfo(clean);

  const msg = await Message.create({
    conversationKey: conversationKey(productId, req.user._id, recipientId),
    product: productId,
    sender: req.user._id,
    recipient: recipientId,
    body: masked,
    wasMasked: masked !== clean,
  });
  const payload = { ...msg.toObject(), senderName: req.user.name, productTitle: product.title };
  emitToUser(String(recipientId), 'message', payload);
  await notify(recipientId, { type: 'message.new', title: `New message from ${req.user.name}`, message: masked.slice(0, 100), link: `/messages?c=${encodeURIComponent(msg.conversationKey)}` });
  res.status(201).json({ success: true, message: payload });
};

exports.conversations = async (req, res) => {
  const uid = req.user._id;
  const convos = await Message.aggregate([
    { $match: { $or: [{ sender: uid }, { recipient: uid }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationKey',
        last: { $first: '$$ROOT' },
        unread: { $sum: { $cond: [{ $and: [{ $eq: ['$recipient', uid] }, { $eq: ['$readAt', null] }] }, 1, 0] } },
      },
    },
    { $sort: { 'last.createdAt': -1 } },
    { $limit: 50 },
  ]);
  const productIds = convos.map((c) => c.last.product);
  const otherIds = convos.map((c) => (String(c.last.sender) === String(uid) ? c.last.recipient : c.last.sender));
  const [products, users] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select('title images sellerId').lean(),
    User.find({ _id: { $in: otherIds } }).select('name profileImage').lean(),
  ]);
  const pm = new Map(products.map((p) => [String(p._id), p]));
  const um = new Map(users.map((u) => [String(u._id), u]));
  res.json({
    success: true,
    conversations: convos.map((c, i) => ({
      key: c._id,
      product: pm.get(String(c.last.product)),
      other: um.get(String(otherIds[i])),
      lastMessage: c.last.body,
      lastAt: c.last.createdAt,
      unread: c.unread,
    })),
  });
};

exports.thread = async (req, res) => {
  const key = String(req.params.key);
  const parts = key.split(':');
  if (parts.length !== 3 || !parts.includes(String(req.user._id))) throw ApiError.forbidden();
  const messages = await Message.find({ conversationKey: key }).sort({ createdAt: 1 }).limit(500).lean();
  await Message.updateMany({ conversationKey: key, recipient: req.user._id, readAt: null }, { readAt: new Date() });
  const [productId, a, b] = parts;
  const otherId = a === String(req.user._id) ? b : a;
  const [product, other] = await Promise.all([
    Product.findById(productId).select('title images sellingPrice sellerId status').lean(),
    User.findById(otherId).select('name profileImage').lean(),
  ]);
  res.json({ success: true, messages, product, other, contactUnlocked: await hasAcceptedOrder(productId, a, b) });
};

// ------------------------------------------------------------ favourites
exports.listFavourites = async (req, res) => {
  const favs = await Favourite.find({ user: req.user._id }).sort({ createdAt: -1 })
    .populate({ path: 'product', select: 'title images sellingPrice condition status locationLabel category' }).lean();
  res.json({ success: true, items: favs.filter((f) => f.product).map((f) => ({ ...f.product, favouritedAt: f.createdAt })) });
};

exports.toggleFavourite = async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId).select('_id');
  if (!product) throw ApiError.notFound('Product not found');
  const removed = await Favourite.findOneAndDelete({ user: req.user._id, product: productId });
  if (removed) {
    await Product.updateOne({ _id: productId }, { $inc: { favouritesCount: -1 } });
    return res.json({ success: true, isFavourite: false });
  }
  await Favourite.create({ user: req.user._id, product: productId });
  await Product.updateOne({ _id: productId }, { $inc: { favouritesCount: 1 } });
  return res.json({ success: true, isFavourite: true });
};

// ------------------------------------------------------------ reviews
exports.createReview = async (req, res) => {
  res.status(201).json({ success: true, review: await reviews.createReview(req.user, req.body) });
};

exports.reviewsForUser = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 10 });
  const { items, total } = await reviews.listForUser(oid(req.params.userId), pg);
  res.json({ success: true, ...paginated(items, total, pg) });
};

// ------------------------------------------------------------ complaints
exports.createComplaint = async (req, res) => {
  const c = await Complaint.create({ ...req.body, complaintRef: makeRef('CMP'), user: req.user._id, description: sanitizeText(req.body.description) });
  emitToRole('admin', 'admin.alert', { type: 'complaint.new', complaintId: c._id });
  res.status(201).json({ success: true, complaint: c });
};

exports.myComplaints = async (req, res) => {
  res.json({ success: true, items: await Complaint.find({ user: req.user._id }).sort({ createdAt: -1 }).lean() });
};

// ------------------------------------------------------------ wallet / rewards / impact
exports.myTransactions = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 15 });
  const filter = { $or: [{ buyerId: req.user._id }, { sellerId: req.user._id }] };
  const [items, total, totals] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .populate('bookingId', 'bookingRef').populate('orderId', 'orderRef').populate('buyerId sellerId', 'name').lean(),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: { $or: [{ buyerId: req.user._id }, { sellerId: req.user._id }], paymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          earned: { $sum: { $cond: [{ $eq: ['$sellerId', req.user._id] }, '$amount', 0] } },
          spent: { $sum: { $cond: [{ $eq: ['$buyerId', req.user._id] }, '$amount', 0] } },
        },
      },
    ]),
  ]);
  res.json({
    success: true,
    totals: { earned: totals[0]?.earned || 0, spent: totals[0]?.spent || 0 },
    ...paginated(items.map((t) => ({ ...t, direction: String(t.sellerId?._id) === String(req.user._id) ? 'in' : 'out' })), total, pg),
  });
};

exports.myRewards = async (req, res) => {
  const ledger = await EcoReward.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, balance: req.user.ecoPoints, ledger });
};

exports.platformImpact = async (req, res) => {
  const [impact, users, collectors, listings] = await Promise.all([
    platformImpact(),
    User.countDocuments({ role: { $in: ['customer', 'buyer'] } }),
    User.countDocuments({ role: 'collector' }),
    Product.countDocuments({ status: P.AVAILABLE }),
  ]);
  res.json({ success: true, impact: { ...impact, users, collectors, activeListings: listings } });
};

// ------------------------------------------------------------ dashboards (customer & buyer)
exports.customerDashboard = async (req, res) => {
  const uid = req.user._id;
  const [impact, earnedAgg, productsListed, active, completed, recentTx, recentBookings] = await Promise.all([
    userImpact(uid),
    Transaction.aggregate([{ $match: { sellerId: uid, paymentStatus: 'paid' } }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
    Product.countDocuments({ sellerId: uid, status: { $ne: P.REMOVED } }),
    PickupBooking.countDocuments({ customerId: uid, status: { $nin: [B.COMPLETED, B.CANCELLED, B.REJECTED] } }),
    PickupBooking.countDocuments({ customerId: uid, status: B.COMPLETED }),
    Transaction.find({ $or: [{ buyerId: uid }, { sellerId: uid }] }).sort({ createdAt: -1 }).limit(5).lean(),
    PickupBooking.find({ customerId: uid }).sort({ createdAt: -1 }).limit(5).select('bookingRef status preferredDate estimatedPrice finalPrice materialSummary').lean(),
  ]);
  const earned = Object.fromEntries(earnedAgg.map((e) => [e._id, e.total]));
  res.json({
    success: true,
    stats: {
      totalWasteSoldKg: impact.totalRecycledKg,
      totalEarnings: (earned.scrap_collection || 0) + (earned.marketplace_sale || 0),
      scrapEarnings: earned.scrap_collection || 0,
      salesEarnings: earned.marketplace_sale || 0,
      productsListed,
      activeBookings: active,
      completedBookings: completed,
      ecoPoints: req.user.ecoPoints,
    },
    impact,
    recentTransactions: recentTx.map((t) => ({ ...t, direction: String(t.sellerId) === String(uid) ? 'in' : 'out' })),
    recentBookings,
  });
};

exports.buyerDashboard = async (req, res) => {
  const uid = req.user._id;
  const [activeOrders, history, favCount, unread] = await Promise.all([
    Order.find({ buyer: uid, status: { $in: [O.REQUESTED, O.ACCEPTED] } }).sort({ updatedAt: -1 }).limit(10)
      .populate('product', 'title images sellingPrice').lean(),
    Order.find({ buyer: uid, status: { $in: [O.COMPLETED, O.CANCELLED, O.REJECTED] } }).sort({ updatedAt: -1 }).limit(10)
      .populate('product', 'title images').lean(),
    Favourite.countDocuments({ user: uid }),
    Notification.countDocuments({ user: uid, readAt: null }),
  ]);
  res.json({ success: true, activeOrders, history, favouritesCount: favCount, unreadNotifications: unread, ecoPoints: req.user.ecoPoints });
};

// ------------------------------------------------------------ public contact form
exports.contact = async (req, res) => {
  const { name, email, subject, message } = req.body;
  await sendEmail({ to: env.smtp.user || 'support@recircle.local', subject: `[Contact] ${subject}`, text: `From: ${name} <${email}>\n\n${message}` });
  emitToRole('admin', 'admin.alert', { type: 'contact.new', message: `${name}: ${subject}` });
  res.status(201).json({ success: true, message: 'Thanks! Our team will get back to you within 1–2 working days.' });
};
