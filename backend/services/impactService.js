/**
 * Environmental impact = measured quantities only (kg diverted per material, items reused).
 * We deliberately do NOT compute CO2 savings: without a defined methodology and
 * region-specific emission factors any number would be misleading. See docs/architecture.md.
 */
const mongoose = require('mongoose');
const { PickupBooking, WasteItem, Order, EcoReward } = require('../models');
const { BOOKING_STATUS: B, ORDER_STATUS: O } = require('../config/constants');

const METHODOLOGY = 'Figures are sums of collector-verified weights from completed pickups and completed second-hand sales on ReCircle AI. No carbon-savings figures are shown because they require validated, region-specific emission factors.';

async function materialBreakdown(match) {
  const completed = await PickupBooking.find({ ...match, status: B.COMPLETED }).select('_id').lean();
  const ids = completed.map((b) => b._id);
  if (!ids.length) return [];
  return WasteItem.aggregate([
    { $match: { booking: { $in: ids } } },
    { $lookup: { from: 'wastecategories', localField: 'category', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    { $group: { _id: '$cat.materialType', kg: { $sum: { $ifNull: ['$verifiedWeightKg', 0] } } } },
    { $project: { _id: 0, material: '$_id', kg: { $round: ['$kg', 2] } } },
    { $sort: { kg: -1 } },
  ]);
}

async function userImpact(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const [materials, productsSold, productsBought, points, completedPickups] = await Promise.all([
    materialBreakdown({ customerId: uid }),
    Order.countDocuments({ seller: uid, status: O.COMPLETED }),
    Order.countDocuments({ buyer: uid, status: O.COMPLETED }),
    EcoReward.aggregate([{ $match: { user: uid } }, { $group: { _id: null, total: { $sum: '$points' } } }]),
    PickupBooking.countDocuments({ customerId: uid, status: B.COMPLETED }),
  ]);
  return summarize(materials, { productsReused: productsSold + productsBought, productsSold, productsBought, completedPickups, ecoPoints: points[0]?.total || 0 });
}

async function platformImpact() {
  const [materials, productsReused, completedPickups] = await Promise.all([
    materialBreakdown({}),
    Order.countDocuments({ status: O.COMPLETED }),
    PickupBooking.countDocuments({ status: B.COMPLETED }),
  ]);
  return summarize(materials, { productsReused, completedPickups });
}

function summarize(materials, extra) {
  const get = (m) => materials.find((x) => x.material === m)?.kg || 0;
  const totalKg = Math.round(materials.reduce((s, m) => s + m.kg, 0) * 100) / 100;
  return {
    totalRecycledKg: totalKg,
    paperKg: Math.round((get('paper') + get('cardboard')) * 100) / 100,
    plasticKg: get('plastic'),
    metalKg: get('metal'),
    eWasteKg: get('e-waste'),
    glassKg: get('glass'),
    materials,
    ...extra,
    methodology: METHODOLOGY,
  };
}

module.exports = { userImpact, platformImpact, METHODOLOGY };
