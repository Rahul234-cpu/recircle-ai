const orders = require('../services/orderService');
const payments = require('../services/paymentService');
const { getPagination, paginated } = require('../utils/pagination');

exports.create = async (req, res) => {
  res.status(201).json({ success: true, order: await orders.createOrder(req.user, req.body) });
};

exports.list = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 10 });
  const { items, total } = await orders.listOrders(req.user, { ...req.query, ...pg });
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.get = async (req, res) => {
  res.json({ success: true, order: await orders.getOrder(req.user, req.params.id) });
};

exports.updateStatus = async (req, res) => {
  res.json({ success: true, order: await orders.updateStatus(req.user, req.params.id, req.body) });
};

exports.paymentConfig = async (req, res) => {
  res.json({ success: true, ...payments.config() });
};

exports.createPayment = async (req, res) => {
  res.json({ success: true, ...(await payments.createPaymentOrder(req.user, req.params.id)) });
};

exports.verifyPayment = async (req, res) => {
  const order = await payments.verifyPayment(req.user, req.params.id, req.body);
  res.json({ success: true, paymentStatus: order.paymentStatus });
};
