const {
  Review, PickupBooking, Order, Collector, User,
} = require('../models');
const { BOOKING_STATUS: B, ORDER_STATUS: O } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { sanitizeText } = require('../utils/privacy');
const { notify } = require('./notificationService');

async function recomputeAverage(revieweeId, targetType) {
  const [agg] = await Review.aggregate([
    { $match: { reviewee: revieweeId, targetType } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const average = agg ? Math.round(agg.avg * 10) / 10 : 0;
  const count = agg ? agg.count : 0;
  if (targetType === 'collector') await Collector.updateOne({ userId: revieweeId }, { averageRating: average, ratingCount: count });
  if (targetType === 'seller') await User.updateOne({ _id: revieweeId }, { sellerRating: { average, count } });
  if (targetType === 'customer') await User.updateOne({ _id: revieweeId }, { customerRating: { average, count } });
}

async function createReview(user, { bookingId, orderId, rating, comment }) {
  if (!bookingId && !orderId) throw ApiError.badRequest('bookingId or orderId is required');
  let doc;

  if (bookingId) {
    const booking = await PickupBooking.findById(bookingId);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status !== B.COMPLETED) throw ApiError.badRequest('You can review once the pickup is completed');
    const isCustomer = String(booking.customerId) === String(user._id);
    const isCollector = String(booking.collectorId) === String(user._id);
    if (!isCustomer && !isCollector) throw ApiError.forbidden();
    const targetType = isCustomer ? 'collector' : 'customer';
    const reviewee = isCustomer ? booking.collectorId : booking.customerId;
    doc = await Review.create({ reviewer: user._id, reviewee, targetType, booking: booking._id, rating, comment: comment && sanitizeText(comment) });
    booking[isCustomer ? 'customerRated' : 'collectorRated'] = true;
    await booking.save();
    await recomputeAverage(reviewee, targetType);
  } else {
    const order = await Order.findById(orderId);
    if (!order) throw ApiError.notFound('Order not found');
    if (order.status !== O.COMPLETED) throw ApiError.badRequest('You can review once the order is completed');
    if (String(order.buyer) !== String(user._id)) throw ApiError.forbidden('Only the buyer can review this order');
    doc = await Review.create({ reviewer: user._id, reviewee: order.seller, targetType: 'seller', order: order._id, product: order.product, rating, comment: comment && sanitizeText(comment) });
    order.buyerRated = true;
    await order.save();
    await recomputeAverage(order.seller, 'seller');
  }

  await notify(doc.reviewee, { type: 'review.new', title: 'You received a new review', message: `${rating}★ — ${comment ? comment.slice(0, 80) : 'No comment'}`, link: '/reviews' });
  return doc;
}

async function listForUser(userId, { skip = 0, limit = 20 } = {}) {
  const filter = { reviewee: userId };
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('reviewer', 'name profileImage').populate('product', 'title'),
    Review.countDocuments(filter),
  ]);
  return { items, total };
}

module.exports = { createReview, listForUser };
