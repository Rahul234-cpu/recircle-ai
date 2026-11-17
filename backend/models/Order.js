const mongoose = require('mongoose');
const { ORDER_STATUS } = require('../config/constants');

const orderSchema = new mongoose.Schema(
  {
    orderRef: { type: String, unique: true, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offeredPrice: { type: Number, required: true, min: 1 },
    agreedPrice: { type: Number, min: 1 },
    message: { type: String, maxlength: 500 },
    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.REQUESTED, index: true },
    statusHistory: [
      {
        _id: false,
        status: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    paymentMethod: { type: String, enum: ['cash', 'upi', 'razorpay'], default: 'cash' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    handoverNote: { type: String, maxlength: 300 },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    buyerRated: { type: Boolean, default: false },
    completedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Order', orderSchema);
