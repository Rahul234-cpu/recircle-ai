const mongoose = require('mongoose');

/**
 * Two separate flows share this ledger, distinguished by `type`:
 *  - scrap_collection: collector (buyerId) pays the customer (sellerId) for verified waste.
 *  - marketplace_sale: buyer pays seller for a second-hand product.
 */
const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, unique: true, required: true },
    type: { type: String, enum: ['scrap_collection', 'marketplace_sale'], required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupBooking' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'bank-transfer', 'razorpay'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'paid' },
    gatewayRef: String,
    lineItems: [
      {
        _id: false,
        name: String,
        weightKg: Number,
        ratePerKg: Number,
        amount: Number,
      },
    ],
    receiptNumber: String,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

transactionSchema.pre('validate', function requireRef(next) {
  if (!this.bookingId && !this.orderId) return next(new Error('Transaction needs bookingId or orderId'));
  return next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
