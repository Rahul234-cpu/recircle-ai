const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['collector', 'customer', 'seller'], required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupBooking' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 600, trim: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One review per reviewer per booking / order.
reviewSchema.index({ reviewer: 1, booking: 1 }, { unique: true, partialFilterExpression: { booking: { $exists: true } } });
reviewSchema.index({ reviewer: 1, order: 1 }, { unique: true, partialFilterExpression: { order: { $exists: true } } });

module.exports = mongoose.model('Review', reviewSchema);
