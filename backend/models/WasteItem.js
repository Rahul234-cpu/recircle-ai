const mongoose = require('mongoose');

const wasteItemSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'PickupBooking', index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'WasteCategory', required: true },
    images: [{ url: String, publicId: String }],
    description: { type: String, maxlength: 300 },
    aiAnalysis: { type: mongoose.Schema.Types.ObjectId, ref: 'AIAnalysis' },
    predictedMaterial: String,
    aiConfidence: Number,
    userOverrodeAI: { type: Boolean, default: false },
    estimatedWeightKg: { type: Number, required: true, min: 0.1, max: 2000 },
    ratePerKg: { type: Number, required: true, min: 0 }, // snapshot of admin rate at booking time
    estimatedPrice: { type: Number, required: true, min: 0 },
    verifiedWeightKg: { type: Number, min: 0 },
    finalRatePerKg: { type: Number, min: 0 },
    finalPrice: { type: Number, min: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WasteItem', wasteItemSchema);
