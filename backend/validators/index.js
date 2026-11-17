const { z } = require('zod');
const mongoose = require('mongoose');
const {
  ROLES, TIME_SLOTS, PRODUCT_CONDITIONS, BOOKING_STATUS, ORDER_STATUS, WEEKDAYS, MATERIAL_TYPES, PRODUCT_STATUS,
} = require('../config/constants');

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');
const coords = z.tuple([z.coerce.number().min(-180).max(180), z.coerce.number().min(-90).max(90)]);
const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
const pincode = z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a number');

// Multipart forms send JSON fields as strings.
const jsonField = (schema) => z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}, schema);

const boolField = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

const idParam = z.object({ id: objectId });

const pagination = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

const auth = {
  register: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    phone: phone.optional(),
    password,
    role: z.enum([ROLES.CUSTOMER, ROLES.BUYER]).default(ROLES.CUSTOMER),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),
};

const address = z.object({
  label: z.string().trim().max(40).optional(),
  line1: z.string().trim().min(3).max(200),
  locality: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional(),
  pincode: pincode.optional(),
  coordinates: coords.optional(),
  isDefault: z.boolean().optional(),
});

const user = {
  updateProfile: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: phone.optional(),
  }),
  address,
};

const collectorBase = {
  businessName: z.string().trim().min(2).max(120),
  address: z.string().trim().max(250).optional(),
  vehicleType: z.enum(['cycle-cart', 'auto', 'mini-truck', 'two-wheeler', 'other']).optional(),
  serviceAreas: jsonField(z.array(z.object({ name: z.string().trim().min(2), pincode: pincode.optional() })).min(1).max(20)),
  coordinates: jsonField(coords),
  serviceRadiusKm: z.coerce.number().min(1).max(50).optional(),
  availability: jsonField(z.object({
    days: z.array(z.enum(WEEKDAYS)).min(1),
    timeSlots: z.array(z.enum(TIME_SLOTS)).min(1),
    dailyCapacity: z.coerce.number().int().min(1).max(50),
  })).optional(),
  acceptedMaterials: jsonField(z.array(z.string())).optional(),
};

const collector = {
  register: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    phone,
    password,
    idProofType: z.enum(['aadhaar', 'pan', 'voter-id', 'driving-licence', 'other']),
    idProofNumber: z.string().trim().min(4).max(20).regex(/^[A-Za-z0-9 ]+$/),
    ...collectorBase,
  }),
  update: z.object({
    ...Object.fromEntries(Object.entries(collectorBase).map(([k, v]) => [k, v.optional()])),
    isAvailable: boolField.optional(),
  }),
  nearbyQuery: z.object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    date: z.string().optional(),
    timeSlot: z.enum(TIME_SLOTS).optional(),
    materials: z.string().optional(),
  }),
  reject: z.object({ reason: z.string().trim().max(200).optional() }),
  verifyWeight: z.object({
    items: z.array(z.object({
      itemId: objectId,
      verifiedWeightKg: z.coerce.number().min(0).max(5000),
      finalRatePerKg: z.coerce.number().min(0).max(100000).optional(),
    })).min(1),
    paymentMethod: z.enum(['cash', 'upi', 'bank-transfer']).optional(),
    collectorNotes: z.string().trim().max(500).optional(),
  }),
};

const waste = {
  analyze: z.object({ description: z.string().trim().max(300).optional() }),
  estimate: z.object({
    city: z.string().optional(),
    items: z.array(z.object({ categoryId: objectId, estimatedWeightKg: z.coerce.number().min(0.1).max(2000) })).min(1).max(15),
  }),
  createBooking: z.object({
    items: z.array(z.object({
      categoryId: objectId,
      estimatedWeightKg: z.coerce.number().min(0.1).max(2000),
      analysisId: objectId.optional(),
      userOverrodeAI: z.boolean().optional(),
      description: z.string().trim().max(300).optional(),
    })).min(1).max(15),
    pickupAddress: z.object({
      line1: z.string().trim().min(3).max(200),
      locality: z.string().trim().max(80).optional(),
      city: z.string().trim().min(2).max(80),
      state: z.string().trim().max(80).optional(),
      pincode: pincode.optional(),
      contactName: z.string().trim().max(80).optional(),
      contactPhone: phone.optional(),
      coordinates: coords,
    }),
    preferredDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
    preferredTimeSlot: z.enum(TIME_SLOTS),
    customerNotes: z.string().trim().max(500).optional(),
  }),
  listQuery: z.object({ ...pagination, status: z.string().optional(), scope: z.enum(['requests', 'assigned']).optional() }),
  status: z.object({ status: z.enum(Object.values(BOOKING_STATUS)), note: z.string().trim().max(300).optional() }),
};

const product = {
  create: z.object({
    title: z.string().trim().min(4).max(120),
    description: z.string().trim().min(20).max(3000),
    category: z.string().trim().min(2).max(60),
    brand: z.string().trim().max(60).optional(),
    condition: z.enum(PRODUCT_CONDITIONS),
    ageMonths: z.coerce.number().int().min(0).max(600).optional(),
    features: jsonField(z.array(z.string().trim().max(80)).max(15)).optional(),
    originalPrice: z.coerce.number().min(0).max(10000000).optional(),
    sellingPrice: z.coerce.number().min(1).max(10000000),
    coordinates: jsonField(coords),
    locality: z.string().trim().max(80).optional(),
    city: z.string().trim().min(2).max(80),
    publish: boolField.optional(),
    aiRecommendedPrice: jsonField(z.object({ min: z.number(), max: z.number(), suggested: z.number(), method: z.string().optional() })).optional(),
    aiRecommendation: jsonField(z.object({
      action: z.enum(['reuse', 'recycle', 'repair', 'donate']),
      reason: z.string().max(1000).optional(),
      confidence: z.number().optional(),
      userOverrode: z.boolean().optional(),
    })).optional(),
    keepImages: jsonField(z.array(z.string())).optional(),
  }),
  listQuery: z.object({
    ...pagination,
    q: z.string().trim().max(100).optional(),
    category: z.string().optional(),
    condition: z.string().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    city: z.string().optional(),
    lng: z.coerce.number().optional(),
    lat: z.coerce.number().optional(),
    radiusKm: z.coerce.number().min(1).max(200).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'nearest']).optional(),
  }),
  status: z.object({ status: z.enum(Object.values(PRODUCT_STATUS)), reason: z.string().max(300).optional() }),
};

const order = {
  create: z.object({
    productId: objectId,
    offeredPrice: z.coerce.number().min(1).optional(),
    message: z.string().trim().max(500).optional(),
    paymentMethod: z.enum(['cash', 'upi', 'razorpay']).optional(),
  }),
  status: z.object({
    status: z.enum(Object.values(ORDER_STATUS)),
    note: z.string().trim().max(300).optional(),
    agreedPrice: z.coerce.number().min(1).optional(),
    handoverNote: z.string().trim().max(300).optional(),
  }),
  listQuery: z.object({ ...pagination, as: z.enum(['buyer', 'seller']).optional(), status: z.string().optional() }),
  verifyPayment: z.object({ razorpayOrderId: z.string(), razorpayPaymentId: z.string(), razorpaySignature: z.string() }),
};

const ai = {
  recommend: z.object({
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(3000).optional(),
    category: z.string().optional(),
    condition: z.enum(PRODUCT_CONDITIONS).optional(),
    ageMonths: z.coerce.number().min(0).max(600).optional(),
    isWorking: boolField.optional(),
  }),
  price: z.object({
    category: z.string().min(2),
    brand: z.string().optional(),
    ageMonths: z.coerce.number().min(0).max(600).optional(),
    condition: z.enum(PRODUCT_CONDITIONS),
    originalPrice: z.coerce.number().min(0).optional(),
    title: z.string().optional(),
  }),
  describe: z.object({
    title: z.string().trim().min(2).max(120),
    category: z.string().optional(),
    brand: z.string().optional(),
    condition: z.enum(PRODUCT_CONDITIONS).optional(),
    ageMonths: z.coerce.number().optional(),
    features: z.array(z.string()).max(15).optional(),
    notes: z.string().max(1000).optional(),
  }),
  chat: z.object({
    message: z.string().trim().min(1).max(800),
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(12).optional(),
  }),
};

const misc = {
  review: z.object({
    bookingId: objectId.optional(),
    orderId: objectId.optional(),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(600).optional(),
  }),
  message: z.object({ productId: objectId, recipientId: objectId, body: z.string().trim().min(1).max(1000) }),
  complaint: z.object({
    category: z.enum(['booking', 'order', 'listing', 'payment', 'account', 'other']).default('other'),
    subject: z.string().trim().min(4).max(120),
    description: z.string().trim().min(10).max(2000),
    relatedId: z.string().max(60).optional(),
  }),
  contact: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    subject: z.string().trim().min(3).max(120),
    message: z.string().trim().min(10).max(2000),
  }),
};

const admin = {
  verifyCollector: z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(300).optional() }),
  scrapRate: z.object({
    category: objectId,
    city: z.string().trim().max(60).optional(),
    pricePerKg: z.coerce.number().min(0).max(100000),
    resalePricePerKg: z.coerce.number().min(0).max(100000).optional(),
    unit: z.enum(['kg', 'piece']).optional(),
  }),
  scrapRateUpdate: z.object({
    pricePerKg: z.coerce.number().min(0).max(100000),
    resalePricePerKg: z.coerce.number().min(0).max(100000).optional(),
  }),
  wasteCategory: z.object({
    name: z.string().trim().min(2).max(60),
    materialType: z.enum(MATERIAL_TYPES),
    description: z.string().max(400).optional(),
    recyclable: z.boolean().optional(),
    recyclingInfo: z.string().max(600).optional(),
    handlingTips: z.string().max(600).optional(),
    icon: z.string().max(40).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().optional(),
  }),
  productCategory: z.object({
    name: z.string().trim().min(2).max(60),
    icon: z.string().max(40).optional(),
    description: z.string().max(300).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().optional(),
  }),
  userUpdate: z.object({ isActive: z.boolean().optional(), role: z.enum(Object.values(ROLES)).optional() }),
  assign: z.object({ collectorUserId: objectId }),
  complaint: z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']), adminResponse: z.string().trim().max(2000).optional() }),
  reward: z.object({ userId: objectId, points: z.coerce.number().int().min(-10000).max(10000).refine((v) => v !== 0, 'Points cannot be 0'), reason: z.string().trim().min(3).max(200) }),
  settings: z.object({
    listingRequiresApproval: z.boolean().optional(),
    matchingRadiusKm: z.coerce.number().min(1).max(100).optional(),
    maxCandidateCollectors: z.coerce.number().int().min(1).max(20).optional(),
    rewardPointsPerKg: z.coerce.number().min(0).max(100).optional(),
    rewardPointsPerProductSale: z.coerce.number().min(0).max(1000).optional(),
    rewardPointsPerProductPurchase: z.coerce.number().min(0).max(1000).optional(),
  }),
  listQuery: z.object({ ...pagination, q: z.string().max(100).optional(), status: z.string().optional(), role: z.string().optional(), type: z.string().optional() }),
};

module.exports = { idParam, objectId, auth, user, collector, waste, product, order, ai, misc, admin };
