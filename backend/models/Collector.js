const mongoose = require('mongoose');
const { TIME_SLOTS, WEEKDAYS } = require('../config/constants');

const collectorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 250 },
    vehicleType: { type: String, enum: ['cycle-cart', 'auto', 'mini-truck', 'two-wheeler', 'other'], default: 'cycle-cart' },
    idProofType: { type: String, enum: ['aadhaar', 'pan', 'voter-id', 'driving-licence', 'other'], required: true },
    // Only the last 4 characters are stored to minimise sensitive data.
    idProofLast4: { type: String, required: true, match: /^[A-Za-z0-9]{4}$/ },
    idProofImage: { type: String },
    serviceAreas: [
      {
        name: { type: String, trim: true, required: true },
        pincode: { type: String, trim: true, match: /^\d{6}$/ },
      },
    ],
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    serviceRadiusKm: { type: Number, default: 8, min: 1, max: 50 },
    availability: {
      days: [{ type: String, enum: WEEKDAYS }],
      timeSlots: [{ type: String, enum: TIME_SLOTS }],
      dailyCapacity: { type: Number, default: 6, min: 1, max: 50 },
    },
    isAvailable: { type: Boolean, default: true },
    acceptedMaterials: [{ type: String }], // waste category slugs; empty = all
    verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    verificationNote: String,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    completedCollections: { type: Number, default: 0 },
    totalKgCollected: { type: Number, default: 0 },
    totalPaidToCustomers: { type: Number, default: 0 },
    estimatedMargin: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

collectorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Collector', collectorSchema);
