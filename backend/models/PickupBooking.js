const mongoose = require('mongoose');
const { BOOKING_STATUS, TIME_SLOTS } = require('../config/constants');

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(BOOKING_STATUS), required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const pickupBookingSchema = new mongoose.Schema(
  {
    bookingRef: { type: String, unique: true, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // collector's user id
    collectorProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Collector' },
    wasteItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WasteItem' }],
    materialSummary: [{ name: String, slug: String, estimatedWeightKg: Number }],
    pickupAddress: {
      line1: { type: String, required: true },
      locality: String,
      city: { type: String, required: true },
      state: String,
      pincode: String,
      contactName: String,
      contactPhone: String,
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },
    preferredDate: { type: Date, required: true },
    preferredTimeSlot: { type: String, enum: TIME_SLOTS, required: true },
    estimatedWeight: { type: Number, required: true, min: 0 },
    verifiedWeight: { type: Number, min: 0 },
    estimatedPrice: { type: Number, required: true, min: 0 },
    finalPrice: { type: Number, min: 0 },
    status: { type: String, enum: Object.values(BOOKING_STATUS), default: BOOKING_STATUS.PENDING, index: true },
    statusHistory: [historySchema],
    candidateCollectors: [
      {
        collector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        distanceKm: Number,
        score: Number,
        notifiedAt: Date,
      },
    ],
    rejectedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'bank-transfer'], default: 'cash' },
    receipt: { number: String, issuedAt: Date },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    customerNotes: { type: String, maxlength: 500 },
    collectorNotes: { type: String, maxlength: 500 },
    cancellationReason: String,
    customerRated: { type: Boolean, default: false },
    collectorRated: { type: Boolean, default: false },
    completedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

pickupBookingSchema.index({ 'pickupAddress.location': '2dsphere' });
pickupBookingSchema.index({ 'candidateCollectors.collector': 1, status: 1 });
pickupBookingSchema.index({ collectorId: 1, preferredDate: 1, status: 1 });

module.exports = mongoose.model('PickupBooking', pickupBookingSchema);
