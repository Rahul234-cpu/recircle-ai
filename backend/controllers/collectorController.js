const mongoose = require('mongoose');
const {
  User, Collector, PickupBooking, Transaction,
} = require('../models');
const { BOOKING_STATUS: B, ROLES } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { getPagination, paginated } = require('../utils/pagination');
const { signToken } = require('../middleware/auth');
const { storeImages } = require('../services/storageService');
const { findEligibleCollectors, ACTIVE_STATUSES } = require('../services/matchingService');
const bookings = require('../services/bookingService');
const reviews = require('../services/reviewService');
const { emitToRole } = require('../sockets');
const { buildSession } = require('./authController');

/** Public registration for kabadiwalas — creates user + pending collector profile. */
exports.register = async (req, res) => {
  const b = req.body;
  if (await User.exists({ email: b.email })) throw ApiError.conflict('An account with this email already exists');

  const user = new User({ name: b.name, email: b.email, phone: b.phone, role: ROLES.COLLECTOR });
  await user.setPassword(b.password);
  await user.save();

  let idProofImage;
  if (req.file) [{ url: idProofImage }] = await storeImages([req.file], 'id-proofs');

  try {
    await Collector.create({
      userId: user._id,
      businessName: b.businessName,
      address: b.address,
      vehicleType: b.vehicleType,
      idProofType: b.idProofType,
      idProofLast4: b.idProofNumber.replace(/\s/g, '').slice(-4),
      idProofImage,
      serviceAreas: b.serviceAreas,
      location: { type: 'Point', coordinates: b.coordinates },
      serviceRadiusKm: b.serviceRadiusKm,
      availability: b.availability || { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], timeSlots: ['10:00-12:00', '14:00-16:00'], dailyCapacity: 6 },
      acceptedMaterials: b.acceptedMaterials || [],
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // keep data consistent
    throw err;
  }

  emitToRole('admin', 'admin.alert', { type: 'collector.pending', message: `${b.businessName} applied as a collector` });
  res.status(201).json({ success: true, token: signToken(user), user: await buildSession(user) });
};

/** Customers preview which collectors can serve a location/slot (no exact collector location exposed). */
exports.nearby = async (req, res) => {
  const { lng, lat, date, timeSlot, materials } = req.query;
  const list = await findEligibleCollectors({
    coordinates: [lng, lat],
    date,
    timeSlot,
    materialSlugs: materials ? materials.split(',') : [],
    limit: 10,
  });
  res.json({
    success: true,
    collectors: list.map(({ collectorProfileId, userId, load, capacity, ...pub }) => ({ ...pub, id: collectorProfileId, slotsLeft: capacity - load })),
  });
};

exports.requests = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const { items, total } = await bookings.listBookings(req.user, { scope: 'requests', ...pg });
  res.json({ success: true, ...paginated(items, total, pg) });
};

exports.accept = async (req, res) => {
  const booking = await bookings.acceptBooking(req.user, req.params.id);
  res.json({ success: true, booking });
};

exports.reject = async (req, res) => {
  const result = await bookings.rejectBooking(req.user, req.params.id, req.body.reason);
  res.json({ success: true, ...result });
};

exports.verifyWeight = async (req, res) => {
  const booking = await bookings.verifyWeight(req.user, req.params.id, req.body);
  res.json({ success: true, booking });
};

exports.getProfile = async (req, res) => {
  const profile = await Collector.findOne({ userId: req.user._id });
  if (!profile) throw ApiError.notFound('Collector profile not found');
  res.json({ success: true, profile });
};

exports.updateProfile = async (req, res) => {
  const profile = await Collector.findOne({ userId: req.user._id });
  if (!profile) throw ApiError.notFound('Collector profile not found');
  const b = req.body;
  ['businessName', 'address', 'vehicleType', 'serviceAreas', 'serviceRadiusKm', 'availability', 'acceptedMaterials', 'isAvailable']
    .forEach((k) => { if (b[k] !== undefined) profile[k] = b[k]; });
  if (b.coordinates) profile.location = { type: 'Point', coordinates: b.coordinates };
  await profile.save();
  res.json({ success: true, profile });
};

exports.dashboard = async (req, res) => {
  const uid = req.user._id;
  const profile = await Collector.findOne({ userId: uid }).lean();
  if (!profile) throw ApiError.notFound('Collector profile not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [pending, accepted, completed, upcoming] = await Promise.all([
    PickupBooking.countDocuments({ status: B.PENDING, 'candidateCollectors.collector': uid, rejectedBy: { $ne: uid } }),
    PickupBooking.countDocuments({ collectorId: uid, status: { $in: ACTIVE_STATUSES } }),
    PickupBooking.countDocuments({ collectorId: uid, status: B.COMPLETED }),
    PickupBooking.find({ collectorId: uid, status: { $in: ACTIVE_STATUSES }, preferredDate: { $gte: today } })
      .sort({ preferredDate: 1 }).limit(30)
      .select('bookingRef preferredDate preferredTimeSlot status materialSummary pickupAddress.locality pickupAddress.city estimatedWeight')
      .lean(),
  ]);

  res.json({
    success: true,
    stats: {
      verificationStatus: profile.verificationStatus,
      isAvailable: profile.isAvailable,
      totalCollections: profile.completedCollections,
      pendingRequests: pending,
      acceptedBookings: accepted,
      completedPickups: completed,
      totalKgCollected: profile.totalKgCollected,
      totalPaidToCustomers: profile.totalPaidToCustomers,
      estimatedMargin: profile.estimatedMargin,
      averageRating: profile.averageRating,
      ratingCount: profile.ratingCount,
    },
    calendar: upcoming,
  });
};

exports.earnings = async (req, res) => {
  const uid = new mongoose.Types.ObjectId(String(req.user._id));
  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);
  const monthly = await Transaction.aggregate([
    { $match: { type: 'scrap_collection', buyerId: uid, createdAt: { $gte: since } } },
    { $lookup: { from: 'pickupbookings', localField: 'bookingId', foreignField: '_id', as: 'b' } },
    { $unwind: '$b' },
    {
      $group: {
        _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
        paid: { $sum: '$amount' },
        kg: { $sum: { $ifNull: ['$b.verifiedWeight', 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.y': 1, '_id.m': 1 } },
  ]);
  const recent = await Transaction.find({ type: 'scrap_collection', buyerId: uid })
    .sort({ createdAt: -1 }).limit(20).populate('bookingId', 'bookingRef verifiedWeight').lean();
  const profile = await Collector.findOne({ userId: uid }).select('totalPaidToCustomers estimatedMargin totalKgCollected completedCollections').lean();
  res.json({
    success: true,
    summary: profile,
    monthly: monthly.map((m) => ({ month: `${m._id.y}-${String(m._id.m).padStart(2, '0')}`, paid: m.paid, kg: Math.round(m.kg * 10) / 10, count: m.count })),
    recent,
    note: 'Estimated margin = verified kg × admin reference resale rate − amount paid to customers. It is an estimate, not accounting data.',
  });
};

exports.reviews = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const { items, total } = await reviews.listForUser(req.user._id, pg);
  res.json({ success: true, ...paginated(items, total, pg) });
};
