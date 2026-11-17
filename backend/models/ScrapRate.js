const mongoose = require('mongoose');

// Rates are versioned: updating a rate deactivates the old document and inserts a new one,
// so historical bookings keep the rate that applied at the time.
const scrapRateSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteCategory', required: true },
    city: { type: String, default: 'All', trim: true },
    pricePerKg: { type: Number, required: true, min: 0 },
    // Reference wholesale price used only to estimate collector margin.
    resalePricePerKg: { type: Number, min: 0 },
    unit: { type: String, enum: ['kg', 'piece'], default: 'kg' },
    isActive: { type: Boolean, default: true },
    effectiveFrom: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

scrapRateSchema.index({ category: 1, city: 1, isActive: 1 });

module.exports = mongoose.model('ScrapRate', scrapRateSchema);
