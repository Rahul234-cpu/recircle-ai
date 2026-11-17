const User = require('./User');
const Collector = require('./Collector');
const WasteCategory = require('./WasteCategory');
const ScrapRate = require('./ScrapRate');
const WasteItem = require('./WasteItem');
const PickupBooking = require('./PickupBooking');
const Product = require('./Product');
const Order = require('./Order');
const Transaction = require('./Transaction');
const Review = require('./Review');
const misc = require('./misc');

module.exports = {
  User,
  Collector,
  WasteCategory,
  ScrapRate,
  WasteItem,
  PickupBooking,
  Product,
  Order,
  Transaction,
  Review,
  ...misc,
};
