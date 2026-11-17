const mongoose = require('mongoose');
const {
  PickupBooking, WasteItem, Collector, Transaction, AIAnalysis, User,
} = require('../models');
const { BOOKING_STATUS: B, ROLES } = require('../config/constants');
const { bookingMachine } = require('../utils/stateMachines');
const ApiError = require('../utils/ApiError');
const { makeRef } = require('../utils/ids');
const { fuzzDistanceKm, publicAddress } = require('../utils/privacy');
const { distanceKm } = require('../utils/geo');
const pricing = require('./pricingService');
const { findEligibleCollectors } = require('./matchingService');
const { notify, notifyMany } = require('./notificationService');
const { emitToRole } = require('../sockets');
const rewards = require('./rewardService');
const { getSettings } = require('./settingsService');
const { sendEmail } = require('./emailService');

const ASSIGNED_STATUSES = [B.ACCEPTED, B.COLLECTOR_ASSIGNED, B.ON_THE_WAY, B.ARRIVED, B.WEIGHT_VERIFIED, B.AWAITING_CONFIRMATION, B.COMPLETED];

const populateSpec = [
  { path: 'wasteItems', populate: { path: 'category', select: 'name slug materialType icon' } },
  { path: 'customerId', select: 'name phone email profileImage customerRating' },
  { path: 'collectorId', select: 'name phone profileImage' },
  { path: 'collectorProfile', select: 'businessName vehicleType averageRating ratingCount location completedCollections' },
];

function idEq(a, b) { return a && b && String(a._id || a) === String(b._id || b); }

function pushHistory(booking, status, user, note) {
  booking.statusHistory.push({ status, by: user?._id, role: user ? user.role : 'system', note });
}

/**
 * Privacy-aware view of a booking for the requesting user.
 * Collectors who have not been assigned see only coarse location and no contact details.
 */
function viewFor(booking, user) {
  const b = booking.toObject ? booking.toObject() : booking;
  if (user.role === ROLES.ADMIN || idEq(b.customerId, user._id)) return b;

  if (user.role === ROLES.COLLECTOR) {
    const assigned = idEq(b.collectorId, user._id) && ASSIGNED_STATUSES.includes(b.status);
    if (assigned) return b;
    const candidate = (b.candidateCollectors || []).find((c) => idEq(c.collector, user._id));
    return {
      _id: b._id,
      bookingRef: b.bookingRef,
      status: b.status,
      materialSummary: b.materialSummary,
      wasteItems: (b.wasteItems || []).map((w) => ({ _id: w._id, category: w.category, estimatedWeightKg: w.estimatedWeightKg, images: w.images })),
      estimatedWeight: b.estimatedWeight,
      estimatedPrice: b.estimatedPrice,
      preferredDate: b.preferredDate,
      preferredTimeSlot: b.preferredTimeSlot,
      pickupAddress: publicAddress(b.pickupAddress),
      approxDistanceKm: candidate?.distanceKm != null ? fuzzDistanceKm(candidate.distanceKm) : undefined,
      customerNotes: b.customerNotes,
      createdAt: b.createdAt,
      locked: true,
    };
  }
  throw ApiError.forbidden();
}

async function loadBooking(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Booking not found');
  const booking = await PickupBooking.findById(id);
  if (!booking) throw ApiError.notFound('Booking not found');
  return booking;
}

async function notifyCandidates(booking, candidates) {
  const summary = booking.materialSummary.map((m) => m.name).join(', ');
  await notifyMany(candidates.map((c) => c.userId || c.collector), {
    type: 'booking.new_request',
    title: 'New pickup request nearby',
    message: `${summary} · ~${booking.estimatedWeight} kg · ${booking.preferredTimeSlot}`,
    link: `/collector/requests`,
    data: { bookingId: booking._id },
  });
}

// ---------------------------------------------------------------- create
async function createBooking(customer, input) {
  const { items, pickupAddress, preferredDate, preferredTimeSlot, customerNotes } = input;

  const date = new Date(preferredDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date < today) throw ApiError.badRequest('Pickup date must be today or later');

  const estimate = await pricing.estimateScrapPrice(items, pickupAddress.city);

  // Images come only from the user's own AI analyses (prevents arbitrary URL injection).
  const analysisIds = items.map((i) => i.analysisId).filter(Boolean);
  const analyses = analysisIds.length
    ? await AIAnalysis.find({ _id: { $in: analysisIds }, user: customer._id }).lean()
    : [];
  const analysisById = new Map(analyses.map((a) => [String(a._id), a]));

  const booking = new PickupBooking({
    bookingRef: makeRef('PK'),
    customerId: customer._id,
    pickupAddress: {
      ...pickupAddress,
      contactName: pickupAddress.contactName || customer.name,
      contactPhone: pickupAddress.contactPhone || customer.phone,
      location: { type: 'Point', coordinates: pickupAddress.coordinates },
    },
    preferredDate: date,
    preferredTimeSlot,
    estimatedWeight: estimate.totalWeightKg,
    estimatedPrice: estimate.estimatedPrice,
    customerNotes,
    materialSummary: estimate.lines.map((l) => ({ name: l.name, slug: l.slug, estimatedWeightKg: l.estimatedWeightKg })),
    status: B.PENDING,
  });
  pushHistory(booking, B.PENDING, customer, 'Booking created');

  const wasteItems = await WasteItem.insertMany(estimate.lines.map((line, idx) => {
    const src = items[idx];
    const analysis = src.analysisId ? analysisById.get(String(src.analysisId)) : null;
    return {
      owner: customer._id,
      booking: booking._id,
      category: line.categoryId,
      description: src.description,
      images: analysis?.imageUrl ? [{ url: analysis.imageUrl }] : [],
      aiAnalysis: analysis?._id,
      predictedMaterial: analysis?.output?.material,
      aiConfidence: analysis?.output?.confidence,
      userOverrodeAI: Boolean(src.userOverrodeAI),
      estimatedWeightKg: line.estimatedWeightKg,
      ratePerKg: line.ratePerKg,
      estimatedPrice: line.estimatedPrice,
    };
  }));
  booking.wasteItems = wasteItems.map((w) => w._id);

  const candidates = await findEligibleCollectors({
    coordinates: pickupAddress.coordinates,
    date,
    timeSlot: preferredTimeSlot,
    materialSlugs: estimate.lines.map((l) => l.slug),
  });
  booking.candidateCollectors = candidates.map((c) => ({
    collector: c.userId, distanceKm: c.distanceKm, score: c.score, notifiedAt: new Date(),
  }));
  await booking.save();

  if (candidates.length) {
    await notifyCandidates(booking, candidates);
  } else {
    emitToRole('admin', 'admin.alert', { type: 'booking.no_collectors', bookingId: booking._id });
  }
  await notify(customer._id, {
    type: 'booking.created',
    title: 'Pickup request submitted',
    message: candidates.length
      ? `Sent to ${candidates.length} nearby collector(s). You'll be notified when one accepts.`
      : 'No collector is available for that slot yet. Our team will assign one or you can pick another slot.',
    link: `/customer/bookings/${booking._id}`,
  });

  return { booking: await booking.populate(populateSpec), candidatesNotified: candidates.length, estimate };
}

// ---------------------------------------------------------------- read
async function listBookings(user, { status, scope, page, limit, skip }) {
  const filter = {};
  if (user.role === ROLES.CUSTOMER) filter.customerId = user._id;
  else if (user.role === ROLES.COLLECTOR) {
    if (scope === 'requests') {
      filter.status = B.PENDING;
      filter['candidateCollectors.collector'] = user._id;
      filter.rejectedBy = { $ne: user._id };
    } else {
      filter.collectorId = user._id;
    }
  } else if (user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  if (status && scope !== 'requests') {
    const list = String(status).split(',');
    filter.status = { $in: list };
  }

  const [items, total] = await Promise.all([
    PickupBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(populateSpec),
    PickupBooking.countDocuments(filter),
  ]);
  return { items: items.map((b) => viewFor(b, user)), total, page, limit };
}

async function getBooking(user, id) {
  const booking = await loadBooking(id);
  await booking.populate(populateSpec);
  const view = viewFor(booking, user);
  const actor = actorFor(booking, user, true);
  view.allowedActions = actor ? bookingMachine.allowedNext(booking.status, actor) : [];
  return view;
}

/** Determine the acting role on a specific booking (or null if unrelated). */
function actorFor(booking, user, soft = false) {
  if (user.role === ROLES.ADMIN) return 'admin';
  if (user.role === ROLES.CUSTOMER && idEq(booking.customerId, user._id)) return 'customer';
  if (user.role === ROLES.COLLECTOR) {
    if (idEq(booking.collectorId, user._id)) return 'collector';
    if (booking.status === B.PENDING && booking.candidateCollectors.some((c) => idEq(c.collector, user._id))) return 'collector';
  }
  if (soft) return null;
  throw ApiError.forbidden('You are not part of this booking');
}

function assertTransition(booking, to, actor) {
  if (!bookingMachine.canTransition(booking.status, to, actor)) {
    throw ApiError.conflict(`Cannot change booking from "${booking.status}" to "${to}" as ${actor}`, {
      allowed: bookingMachine.allowedNext(booking.status, actor),
    });
  }
}

// ---------------------------------------------------------------- collector accept / reject
async function acceptBooking(collectorUser, id) {
  const profile = await Collector.findOne({ userId: collectorUser._id });
  if (!profile || profile.verificationStatus !== 'approved') throw ApiError.forbidden('Your collector account is not verified yet');

  // Atomic: only one collector can win the race for a pending booking.
  const booking = await PickupBooking.findOneAndUpdate(
    {
      _id: id,
      status: B.PENDING,
      'candidateCollectors.collector': collectorUser._id,
      rejectedBy: { $ne: collectorUser._id },
    },
    {
      $set: { status: B.ACCEPTED, collectorId: collectorUser._id, collectorProfile: profile._id },
      $push: { statusHistory: { status: B.ACCEPTED, by: collectorUser._id, role: 'collector', note: 'Collector accepted' } },
    },
    { new: true },
  );
  if (!booking) {
    const existing = await PickupBooking.findById(id).select('status');
    if (!existing) throw ApiError.notFound('Booking not found');
    throw ApiError.conflict(existing.status === B.PENDING ? 'You are not eligible for this request' : 'This request has already been taken or closed');
  }

  await notify(booking.customerId, {
    type: 'booking.accepted',
    title: 'Collector assigned',
    message: `${profile.businessName} accepted your pickup ${booking.bookingRef}.`,
    link: `/customer/bookings/${booking._id}`,
  });
  const others = booking.candidateCollectors.map((c) => c.collector).filter((c) => !idEq(c, collectorUser._id));
  await notifyMany(others, {
    type: 'booking.taken',
    title: 'Request no longer available',
    message: `Pickup ${booking.bookingRef} was accepted by another collector.`,
    link: '/collector/requests',
  });
  await booking.populate(populateSpec);
  return booking;
}

async function rejectBooking(collectorUser, id, reason) {
  const booking = await loadBooking(id);
  if (booking.status !== B.PENDING) throw ApiError.conflict('Only pending requests can be rejected');
  if (!booking.candidateCollectors.some((c) => idEq(c.collector, collectorUser._id))) throw ApiError.forbidden();
  if (booking.rejectedBy.some((r) => idEq(r, collectorUser._id))) throw ApiError.conflict('You already rejected this request');

  booking.rejectedBy.push(collectorUser._id);
  pushHistory(booking, B.PENDING, collectorUser, `Declined by a collector${reason ? `: ${reason}` : ''}`);

  const allRejected = booking.candidateCollectors.every((c) => booking.rejectedBy.some((r) => idEq(r, c.collector)));
  if (allRejected) {
    // Try to widen the pool with collectors who were not asked yet.
    const more = await findEligibleCollectors({
      coordinates: booking.pickupAddress.location.coordinates,
      date: booking.preferredDate,
      timeSlot: booking.preferredTimeSlot,
      materialSlugs: booking.materialSummary.map((m) => m.slug),
      excludeUserIds: booking.candidateCollectors.map((c) => c.collector),
    });
    if (more.length) {
      more.forEach((c) => booking.candidateCollectors.push({ collector: c.userId, distanceKm: c.distanceKm, score: c.score, notifiedAt: new Date() }));
      await booking.save();
      await notifyCandidates(booking, more);
    } else {
      assertTransition(booking, B.REJECTED, 'system');
      booking.status = B.REJECTED;
      pushHistory(booking, B.REJECTED, null, 'No available collector accepted the request');
      await booking.save();
      await notify(booking.customerId, {
        type: 'booking.rejected',
        title: 'No collector available',
        message: `Sorry, no collector could take ${booking.bookingRef}. Please try another date or time slot.`,
        link: `/customer/bookings/${booking._id}`,
      });
    }
  } else {
    await booking.save();
  }
  return { status: booking.status };
}

// ---------------------------------------------------------------- generic status update
async function updateStatus(user, id, { status, note }) {
  const booking = await loadBooking(id);
  const actor = actorFor(booking, user);

  if (status === B.WEIGHT_VERIFIED) throw ApiError.badRequest('Use the verify-weight endpoint to record weights');
  if (status === B.ACCEPTED) throw ApiError.badRequest('Use the accept endpoint');
  if (status === B.COLLECTOR_ASSIGNED) throw ApiError.badRequest('Use the admin assign endpoint');
  if (actor === 'collector' && booking.status === B.PENDING && status !== B.CANCELLED) {
    throw ApiError.badRequest('Accept the request first');
  }

  assertTransition(booking, status, actor);

  if (status === B.COMPLETED) return completeBooking(booking, user);

  booking.status = status;
  if (status === B.CANCELLED) booking.cancellationReason = note || 'Cancelled';
  pushHistory(booking, status, user, note || (status === B.ARRIVED && actor === 'customer' ? 'Customer disputed the verified weight' : undefined));
  await booking.save();

  const messages = {
    [B.ON_THE_WAY]: ['booking.on_the_way', 'Collector is on the way', 'Your collector has started towards your address.'],
    [B.ARRIVED]: actor === 'customer'
      ? ['booking.disputed', 'Customer disputed the weight', 'Please re-check and verify the weight again.']
      : ['booking.arrived', 'Collector has arrived', 'Your collector is at your pickup address.'],
    [B.CANCELLED]: ['booking.cancelled', 'Booking cancelled', `Booking ${booking.bookingRef} was cancelled. ${note || ''}`],
  };
  const m = messages[status];
  if (m) {
    const recipients = [];
    if (actor !== 'customer') recipients.push(booking.customerId);
    if (booking.collectorId && actor !== 'collector') recipients.push(booking.collectorId);
    await notifyMany(recipients, { type: m[0], title: m[1], message: m[2], link: `/bookings/${booking._id}` });
  }
  await booking.populate(populateSpec);
  return booking;
}

// ---------------------------------------------------------------- weight verification
async function verifyWeight(collectorUser, id, { items, collectorNotes, paymentMethod }) {
  const booking = await loadBooking(id);
  if (!idEq(booking.collectorId, collectorUser._id)) throw ApiError.forbidden('Only the assigned collector can verify weight');
  assertTransition(booking, B.WEIGHT_VERIFIED, 'collector');

  const wasteItems = await WasteItem.find({ _id: { $in: booking.wasteItems } });
  const byId = new Map(wasteItems.map((w) => [String(w._id), w]));
  if (items.length !== wasteItems.length) throw ApiError.badRequest('Provide verified weight for every item in the booking');

  let totalWeight = 0;
  let totalPrice = 0;
  for (const it of items) {
    const w = byId.get(String(it.itemId));
    if (!w) throw ApiError.badRequest('Item does not belong to this booking');
    w.verifiedWeightKg = it.verifiedWeightKg;
    w.finalRatePerKg = it.finalRatePerKg ?? w.ratePerKg;
    w.finalPrice = pricing.round2(w.verifiedWeightKg * w.finalRatePerKg);
    totalWeight += w.verifiedWeightKg;
    totalPrice += w.finalPrice;
  }
  await Promise.all(wasteItems.map((w) => w.save()));

  booking.verifiedWeight = pricing.round2(totalWeight);
  booking.finalPrice = pricing.round2(totalPrice);
  if (collectorNotes) booking.collectorNotes = collectorNotes;
  if (paymentMethod) booking.paymentMethod = paymentMethod;
  booking.status = B.WEIGHT_VERIFIED;
  pushHistory(booking, B.WEIGHT_VERIFIED, collectorUser, `Verified ${booking.verifiedWeight} kg for ₹${booking.finalPrice}`);
  assertTransition(booking, B.AWAITING_CONFIRMATION, 'system');
  booking.status = B.AWAITING_CONFIRMATION;
  pushHistory(booking, B.AWAITING_CONFIRMATION, null, 'Waiting for customer to confirm');
  await booking.save();

  await notify(booking.customerId, {
    type: 'booking.weight_verified',
    title: 'Please confirm your pickup',
    message: `Verified ${booking.verifiedWeight} kg · Final amount ₹${booking.finalPrice}. Confirm once you've received payment.`,
    link: `/customer/bookings/${booking._id}`,
  });
  await booking.populate(populateSpec);
  return booking;
}

// ---------------------------------------------------------------- completion
async function completeBooking(booking, customerUser) {
  const wasteItems = await WasteItem.find({ _id: { $in: booking.wasteItems } }).populate('category', 'name');
  const receiptNumber = makeRef('RCPT');

  const txn = await Transaction.create({
    transactionId: makeRef('TXN'),
    type: 'scrap_collection',
    bookingId: booking._id,
    buyerId: booking.collectorId,
    sellerId: booking.customerId,
    amount: booking.finalPrice,
    paymentMethod: booking.paymentMethod || 'cash',
    paymentStatus: 'paid',
    lineItems: wasteItems.map((w) => ({ name: w.category?.name, weightKg: w.verifiedWeightKg, ratePerKg: w.finalRatePerKg, amount: w.finalPrice })),
    receiptNumber,
  });

  booking.status = B.COMPLETED;
  booking.paymentStatus = 'paid';
  booking.transaction = txn._id;
  booking.receipt = { number: receiptNumber, issuedAt: new Date() };
  booking.completedAt = new Date();
  pushHistory(booking, B.COMPLETED, customerUser, 'Customer confirmed the transaction');
  await booking.save();

  // Estimated collector margin uses the admin reference resale rate where available.
  let resaleValue = 0;
  for (const w of wasteItems) {
    // eslint-disable-next-line no-await-in-loop
    const rate = await pricing.getActiveRate(w.category?._id, booking.pickupAddress.city);
    resaleValue += (w.verifiedWeightKg || 0) * (rate?.resalePricePerKg ?? w.finalRatePerKg ?? 0);
  }
  await Collector.updateOne({ userId: booking.collectorId }, {
    $inc: {
      completedCollections: 1,
      totalKgCollected: booking.verifiedWeight || 0,
      totalPaidToCustomers: booking.finalPrice || 0,
      estimatedMargin: pricing.round2(resaleValue - (booking.finalPrice || 0)),
    },
  });

  const settings = await getSettings();
  const points = Math.round((booking.verifiedWeight || 0) * settings.rewardPointsPerKg);
  await rewards.award(booking.customerId, points, `Recycled ${booking.verifiedWeight} kg (${booking.bookingRef})`, 'booking', booking._id);

  await notifyMany([booking.customerId, booking.collectorId], {
    type: 'booking.completed',
    title: 'Pickup completed',
    message: `Receipt ${receiptNumber} · ₹${booking.finalPrice}. ${points} eco-points earned. Please rate your experience.`,
    link: `/bookings/${booking._id}`,
  });
  const customer = await User.findById(booking.customerId).select('email name');
  sendEmail({
    to: customer?.email,
    subject: `ReCircle receipt ${receiptNumber}`,
    text: `Hi ${customer?.name},\n\nYour pickup ${booking.bookingRef} is complete.\nVerified weight: ${booking.verifiedWeight} kg\nAmount: ₹${booking.finalPrice}\nEco-points earned: ${points}\n\nThank you for recycling with ReCircle AI.`,
  });

  await booking.populate(populateSpec);
  return booking;
}

// ---------------------------------------------------------------- admin
async function adminAssign(admin, id, collectorUserId) {
  const booking = await loadBooking(id);
  assertTransition(booking, B.COLLECTOR_ASSIGNED, 'admin');
  const profile = await Collector.findOne({ userId: collectorUserId, verificationStatus: 'approved' });
  if (!profile) throw ApiError.badRequest('Collector not found or not verified');

  booking.status = B.COLLECTOR_ASSIGNED;
  booking.collectorId = collectorUserId;
  booking.collectorProfile = profile._id;
  const d = distanceKm(booking.pickupAddress.location.coordinates, profile.location.coordinates);
  if (!booking.candidateCollectors.some((c) => idEq(c.collector, collectorUserId))) {
    booking.candidateCollectors.push({ collector: collectorUserId, distanceKm: Math.round(d * 10) / 10, notifiedAt: new Date() });
  }
  pushHistory(booking, B.COLLECTOR_ASSIGNED, admin, `Assigned by admin to ${profile.businessName}`);
  await booking.save();
  await notify(collectorUserId, { type: 'booking.assigned', title: 'New pickup assigned', message: `Admin assigned ${booking.bookingRef} to you.`, link: `/collector/bookings/${booking._id}` });
  await notify(booking.customerId, { type: 'booking.accepted', title: 'Collector assigned', message: `${profile.businessName} will handle ${booking.bookingRef}.`, link: `/customer/bookings/${booking._id}` });
  await booking.populate(populateSpec);
  return booking;
}

async function getReceipt(user, id) {
  const booking = await loadBooking(id);
  actorFor(booking, user);
  if (booking.status !== B.COMPLETED) throw ApiError.badRequest('Receipt is available once the booking is completed');
  await booking.populate([...populateSpec, { path: 'transaction' }]);
  return {
    receiptNumber: booking.receipt.number,
    issuedAt: booking.receipt.issuedAt,
    bookingRef: booking.bookingRef,
    customer: { name: booking.customerId.name },
    collector: { name: booking.collectorId?.name, businessName: booking.collectorProfile?.businessName },
    pickupAddress: { line1: booking.pickupAddress.line1, locality: booking.pickupAddress.locality, city: booking.pickupAddress.city, pincode: booking.pickupAddress.pincode },
    lineItems: booking.transaction?.lineItems || [],
    totalWeightKg: booking.verifiedWeight,
    totalAmount: booking.finalPrice,
    paymentMethod: booking.paymentMethod,
    transactionId: booking.transaction?.transactionId,
    isDemo: booking.isDemo,
  };
}

module.exports = {
  createBooking,
  listBookings,
  getBooking,
  acceptBooking,
  rejectBooking,
  updateStatus,
  verifyWeight,
  adminAssign,
  getReceipt,
  viewFor,
  populateSpec,
};
