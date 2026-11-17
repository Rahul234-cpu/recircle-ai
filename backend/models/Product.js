const mongoose = require('mongoose');
const { PRODUCT_STATUS, PRODUCT_CONDITIONS } = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 4, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 3000 },
    category: { type: String, required: true, trim: true, index: true }, // ProductCategory.slug
    images: {
      type: [{ url: String, publicId: String }],
      validate: [(v) => v.length >= 1 && v.length <= 6, 'A listing needs 1–6 images'],
    },
    brand: { type: String, trim: true, maxlength: 60 },
    condition: { type: String, enum: PRODUCT_CONDITIONS, required: true },
    ageMonths: { type: Number, min: 0, max: 600 },
    features: [{ type: String, maxlength: 80 }],
    originalPrice: { type: Number, min: 0 },
    sellingPrice: { type: Number, required: true, min: 1 },
    AIRecommendedPrice: {
      min: Number,
      max: Number,
      suggested: Number,
      method: String,
    },
    aiRecommendation: {
      action: { type: String, enum: ['reuse', 'recycle', 'repair', 'donate'] },
      reason: String,
      confidence: Number,
      userOverrode: Boolean,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    locationLabel: { locality: String, city: String },
    status: { type: String, enum: Object.values(PRODUCT_STATUS), default: PRODUCT_STATUS.DRAFT, index: true },
    rejectionReason: String,
    views: { type: Number, default: 0 },
    favouritesCount: { type: Number, default: 0 },
    soldAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.index({ location: '2dsphere' });
productSchema.index({ title: 'text', description: 'text', brand: 'text' }, { weights: { title: 5, brand: 3, description: 1 } });
productSchema.index({ status: 1, category: 1, sellingPrice: 1 });

module.exports = mongoose.model('Product', productSchema);
