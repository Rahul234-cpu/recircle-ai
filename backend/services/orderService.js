const mongoose = require('mongoose');
const { Order, Product, Transaction } = require('../models');
const { ORDER_STATUS: O, PRODUCT_STATUS: P, ROLES } = require('../config/constants');
const { orderMachine } = require('../utils/stateMachines');
const ApiError = require('../utils/ApiError');
const { makeRef } = require('../utils/ids');
const { notify, notifyMany } = require('./notificationService');
const rewards = require('./rewardService');
const { getSettings } = require('./settingsService');

const populateSpec = [
  { path: 'product', select: 'title images sellingPrice status category locationLabel condition' },
  { path: 'buyer', select: 'name profileImage' },
  { path: 'seller', select: 'name profileImage sellerRating' },
];

const idEq = (a, b) => a && b && String(a._id || a) === String(b._id || b);

function actorFor(order, user) {
  if (user.role === ROLES.ADMIN) return 'admin';
  if (idEq(order.seller, user._id)) return 'seller';
  if (idEq(order.buyer, user._id)) return 'buyer';
  throw ApiError.forbidden('You are not part of this order');
}

async function loadOrder(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Order not found');
  const order = await Order.findById(id);
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

async function createOrder(buyer, { productId, offeredPrice, message, paymentMethod }) {
  const product = await Product.findById(productId);
  if (!product || product.status !== P.AVAILABLE) throw ApiError.badRequest('This product is not available for purchase');
  if (idEq(product.sellerId, buyer._id)) throw ApiError.badRequest('You cannot buy your own listing');

  const existing = await Order.findOne({ product: product._id, buyer: buyer._id, status: { $in: [O.REQUESTED, O.ACCEPTED] } });
  if (existing) throw ApiError.conflict('You already have an active request for this product');

  const order = await Order.create({
    orderRef: makeRef('ORD'),
    product: product._id,
    buyer: buyer._id,
    seller: product.sellerId,
    offeredPrice: offeredPrice || product.sellingPrice,
    message,
    paymentMethod: paymentMethod || 'cash',
    status: O.REQUESTED,
    statusHistory: [{ status: O.REQUESTED, by: buyer._id, role: 'buyer', note: 'Purchase request submitted' }],
  });

  await notify(product.sellerId, {
    type: 'order.requested',
    title: 'New purchase request',
    message: `${buyer.name} offered ₹${order.offeredPrice} for "${product.title}".`,
    link: `/orders/${order._id}`,
  });
  return order.populate(populateSpec);
}

async function listOrders(user, { as, status, skip, limit }) {
  const filter = {};
  if (user.role !== ROLES.ADMIN) {
    if (as === 'seller') filter.seller = user._id;
    else if (as === 'buyer') filter.buyer = user._id;
    else filter.$or = [{ buyer: user._id }, { seller: user._id }];
  }
  if (status) filter.status = { $in: String(status).split(',') };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(populateSpec),
    Order.countDocuments(filter),
  ]);
  return { items, total };
}

async function getOrder(user, id) {
  const order = await loadOrder(id);
  const actor = actorFor(order, user);
  await order.populate(populateSpec);
  const obj = order.toObject();
  obj.myRole = actor;
  obj.allowedActions = orderMachine.allowedNext(order.status, actor);
  return obj;
}

async function updateStatus(user, id, { status, note, agreedPrice, handoverNote }) {
  const order = await loadOrder(id);
  const actor = actorFor(order, user);
  if (!orderMachine.canTransition(order.status, status, actor)) {
    throw ApiError.conflict(`Cannot change order from "${order.status}" to "${status}" as ${actor}`, {
      allowed: orderMachine.allowedNext(order.status, actor),
    });
  }
  const product = await Product.findById(order.product);
  const prevStatus = order.status;

  if (status === O.ACCEPTED) {
    // Reserve atomically so two requests cannot both be accepted.
    const reserved = await Product.findOneAndUpdate(
      { _id: order.product, status: P.AVAILABLE },
      { status: P.RESERVED },
      { new: true },
    );
    if (!reserved) throw ApiError.conflict('Product is no longer available (another request may already be accepted)');
    order.agreedPrice = agreedPrice || order.offeredPrice;
  }

  if (status === O.COMPLETED) {
    if (order.paymentMethod === 'razorpay' && order.paymentStatus !== 'paid') {
      throw ApiError.badRequest('Online payment has not been verified yet');
    }
    const txn = await Transaction.create({
      transactionId: makeRef('TXN'),
      type: 'marketplace_sale',
      orderId: order._id,
      buyerId: order.buyer,
      sellerId: order.seller,
      amount: order.agreedPrice || order.offeredPrice,
      paymentMethod: order.paymentMethod,
      paymentStatus: 'paid',
      gatewayRef: order.razorpayPaymentId,
      lineItems: [{ name: product?.title, amount: order.agreedPrice || order.offeredPrice }],
      receiptNumber: makeRef('RCPT'),
    });
    order.transaction = txn._id;
    order.paymentStatus = 'paid';
    order.completedAt = new Date();
    if (handoverNote) order.handoverNote = handoverNote;
    await Product.updateOne({ _id: order.product }, { status: P.SOLD, soldAt: new Date() });

    // Close other open requests for the same product.
    const others = await Order.find({ product: order.product, _id: { $ne: order._id }, status: O.REQUESTED });
    for (const o of others) {
      o.status = O.REJECTED;
      o.statusHistory.push({ status: O.REJECTED, role: 'system', note: 'Product sold to another buyer' });
      // eslint-disable-next-line no-await-in-loop
      await o.save();
    }
    await notifyMany(others.map((o) => o.buyer), { type: 'order.rejected', title: 'Product sold', message: `"${product?.title}" was sold to another buyer.`, link: '/orders' });

    const settings = await getSettings();
    await rewards.award(order.seller, settings.rewardPointsPerProductSale, `Gave "${product?.title}" a second life`, 'order', order._id);
    await rewards.award(order.buyer, settings.rewardPointsPerProductPurchase, `Bought pre-loved "${product?.title}"`, 'order', order._id);
  }

  if (status === O.CANCELLED && prevStatus === O.ACCEPTED) {
    await Product.updateOne({ _id: order.product, status: P.RESERVED }, { status: P.AVAILABLE });
  }

  order.status = status;
  order.statusHistory.push({ status, by: user._id, role: actor, note });
  await order.save();

  const recipient = actor === 'buyer' ? order.seller : order.buyer;
  const titles = {
    [O.ACCEPTED]: 'Purchase request accepted',
    [O.REJECTED]: 'Purchase request declined',
    [O.COMPLETED]: 'Order completed',
    [O.CANCELLED]: 'Order cancelled',
  };
  await notify(recipient, {
    type: `order.${status.toLowerCase()}`,
    title: titles[status],
    message: `"${product?.title}" · ${status}${note ? ` — ${note}` : ''}`,
    link: `/orders/${order._id}`,
  });
  if (actor === 'admin') await notify(order.seller, { type: `order.${status.toLowerCase()}`, title: titles[status], message: `Admin updated order ${order.orderRef}`, link: `/orders/${order._id}` });

  return order.populate(populateSpec);
}

module.exports = { createOrder, listOrders, getOrder, updateStatus, loadOrder, populateSpec };
