const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40, default: 'Home' },
  line1: { type: String, trim: true, required: true, maxlength: 200 },
  locality: { type: String, trim: true, maxlength: 80 },
  city: { type: String, trim: true, required: true, maxlength: 80 },
  state: { type: String, trim: true, maxlength: 80 },
  pincode: { type: String, trim: true, match: /^\d{6}$/ },
  location: pointSchema,
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
    phone: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    profileImage: { type: String },
    addresses: [addressSchema],
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    ecoPoints: { type: Number, default: 0, min: 0 },
    sellerRating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    customerRating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    lastLoginAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.pointSchema = pointSchema;
module.exports.addressSchema = addressSchema;
