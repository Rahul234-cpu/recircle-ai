const { Collector, PickupBooking } = require('../models');
const { BOOKING_STATUS, WEEKDAYS } = require('../config/constants');
const { getSettings } = require('./settingsService');

const ACTIVE_STATUSES = [
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.COLLECTOR_ASSIGNED,
  BOOKING_STATUS.ON_THE_WAY,
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.WEIGHT_VERIFIED,
  BOOKING_STATUS.AWAITING_CONFIRMATION,
];

function dayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Pure scoring function (exported for unit tests). */
function scoreCollector({ distanceKm, radiusKm, rating, load, capacity }) {
  const distanceScore = Math.max(0, 1 - distanceKm / radiusKm);
  const ratingScore = (rating || 0) / 5;
  const capacityScore = capacity > 0 ? Math.max(0, 1 - load / capacity) : 0;
  return Math.round((0.45 * distanceScore + 0.35 * ratingScore + 0.2 * capacityScore) * 1000) / 1000;
}

/**
 * Find and rank eligible collectors for a pickup.
 * @param {object} p { coordinates:[lng,lat], date, timeSlot, materialSlugs:[], limit }
 */
async function findEligibleCollectors({ coordinates, date, timeSlot, materialSlugs = [], limit, excludeUserIds = [] }) {
  const settings = await getSettings();
  const radiusKm = settings.matchingRadiusKm;
  const max = limit || settings.maxCandidateCollectors;
  const weekday = date ? WEEKDAYS[new Date(date).getDay()] : null;

  const match = { verificationStatus: 'approved', isAvailable: true };
  if (excludeUserIds.length) match.userId = { $nin: excludeUserIds };
  if (weekday) match['availability.days'] = weekday;
  if (timeSlot) match['availability.timeSlots'] = timeSlot;

  const nearby = await Collector.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates },
        distanceField: 'distanceMeters',
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: match,
      },
    },
    { $limit: 50 },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, profileImage: 1, isActive: 1 } }] } },
    { $unwind: '$user' },
    { $match: { 'user.isActive': true } },
  ]);

  const { start, end } = date ? dayRange(date) : {};
  const results = [];
  for (const c of nearby) {
    const distanceKm = c.distanceMeters / 1000;
    if (distanceKm > c.serviceRadiusKm) continue; // outside the collector's own service radius
    if (materialSlugs.length && c.acceptedMaterials?.length
      && !materialSlugs.some((s) => c.acceptedMaterials.includes(s))) continue;

    let load = 0;
    if (date) {
      // eslint-disable-next-line no-await-in-loop
      load = await PickupBooking.countDocuments({
        collectorId: c.userId,
        status: { $in: ACTIVE_STATUSES },
        preferredDate: { $gte: start, $lt: end },
      });
      if (load >= c.availability.dailyCapacity) continue;
    }

    results.push({
      collectorProfileId: c._id,
      userId: c.userId,
      name: c.user.name,
      businessName: c.businessName,
      profileImage: c.user.profileImage,
      averageRating: c.averageRating,
      ratingCount: c.ratingCount,
      completedCollections: c.completedCollections,
      vehicleType: c.vehicleType,
      distanceKm: Math.round(distanceKm * 10) / 10,
      load,
      capacity: c.availability.dailyCapacity,
      score: scoreCollector({ distanceKm, radiusKm, rating: c.averageRating, load, capacity: c.availability.dailyCapacity }),
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, max);
}

module.exports = { findEligibleCollectors, scoreCollector, ACTIVE_STATUSES };
