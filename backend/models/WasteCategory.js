const mongoose = require('mongoose');
const { MATERIAL_TYPES } = require('../config/constants');

const wasteCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    materialType: { type: String, enum: MATERIAL_TYPES, required: true },
    description: { type: String, maxlength: 400 },
    recyclable: { type: Boolean, default: true },
    recyclingInfo: { type: String, maxlength: 600 },
    handlingTips: { type: String, maxlength: 600 },
    icon: { type: String, default: 'Recycle' }, // lucide icon name
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WasteCategory', wasteCategorySchema);
