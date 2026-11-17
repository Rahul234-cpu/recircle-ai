const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ORDER_STATUS: O } = require('../config/constants');
const { loadOrder } = require('./orderService');
const { notify } = require('./notificationService');

let razorpay = null;
if (env.razorpayEnabled) {
  // eslint-disable-next-line global-require
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
}

function config() {
  return { enabled: env.razorpayEnabled, keyId: env.razorpayEnabled ? env.razorpay.keyId : null, mode: 'test' };
}

/** Create a Razorpay order for an accepted marketplace order (buyer only). */
async function createPaymentOrder(user, orderId) {
  if (!razorpay) throw ApiError.badRequest('Online payment is not configured. Use cash/UPI on handover.');
  const order = await loadOrder(orderId);
  if (String(order.buyer) !== String(user._id)) throw ApiError.forbidden();
  if (order.status !== O.ACCEPTED) throw ApiError.badRequest('You can pay once the seller accepts your request');
  if (order.paymentStatus === 'paid') throw ApiError.conflict('Order already paid');

  const amountPaise = Math.round((order.agreedPrice || order.offeredPrice) * 100);
  const rzpOrder = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt: order.orderRef });
  order.razorpayOrderId = rzpOrder.id;
  order.paymentMethod = 'razorpay';
  await order.save();
  return { razorpayOrderId: rzpOrder.id, amount: amountPaise, currency: 'INR', keyId: env.razorpay.keyId };
}

/** Pure signature check (exported for tests). */
function isValidSignature(razorpayOrderId, razorpayPaymentId, signature, secret = env.razorpay.keySecret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verify payment server-side; never trust the client's "success" callback alone. */
async function verifyPayment(user, orderId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const order = await loadOrder(orderId);
  if (String(order.buyer) !== String(user._id)) throw ApiError.forbidden();
  if (order.razorpayOrderId !== razorpayOrderId) throw ApiError.badRequest('Payment does not match this order');
  if (!isValidSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    throw ApiError.badRequest('Payment signature verification failed');
  }
  order.paymentStatus = 'paid';
  order.razorpayPaymentId = razorpayPaymentId;
  order.statusHistory.push({ status: order.status, by: user._id, role: 'buyer', note: 'Online payment verified' });
  await order.save();
  await notify(order.seller, { type: 'order.paid', title: 'Payment received', message: `Buyer paid online for ${order.orderRef}. Hand over the item and confirm.`, link: `/orders/${order._id}` });
  return order;
}

module.exports = { config, createPaymentOrder, verifyPayment, isValidSignature };
