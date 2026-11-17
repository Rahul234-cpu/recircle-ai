const { EcoReward, User } = require('../models');

/** Award (or deduct, with negative points) eco-points and keep User.ecoPoints in sync. */
async function award(userId, points, reason, refType, refId, awardedBy) {
  if (!userId || !points) return null;
  const entry = await EcoReward.create({
    user: userId,
    points,
    type: refType === 'admin' ? 'adjust' : points > 0 ? 'earn' : 'redeem',
    reason,
    refType,
    refId,
    awardedBy,
  });
  await User.updateOne({ _id: userId }, { $inc: { ecoPoints: points } });
  // Never let a balance go negative after an adjustment.
  await User.updateOne({ _id: userId, ecoPoints: { $lt: 0 } }, { $set: { ecoPoints: 0 } });
  return entry;
}

module.exports = { award };
