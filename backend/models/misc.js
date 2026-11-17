/**
 * Smaller collections grouped in one file:
 * Notification, Message, Favourite, Complaint, EcoReward, AIAnalysis, ProductCategory, PlatformSetting.
 */
const mongoose = require('mongoose');

const { ObjectId, Mixed } = mongoose.Schema.Types;

const Notification = mongoose.model(
  'Notification',
  new mongoose.Schema(
    {
      user: { type: ObjectId, ref: 'User', required: true, index: true },
      type: { type: String, required: true },
      title: { type: String, required: true, maxlength: 120 },
      message: { type: String, maxlength: 500 },
      link: String,
      data: Mixed,
      readAt: Date,
      isDemo: { type: Boolean, default: false },
    },
    { timestamps: true },
  ).index({ user: 1, readAt: 1, createdAt: -1 }),
);

const Message = mongoose.model(
  'Message',
  new mongoose.Schema(
    {
      conversationKey: { type: String, required: true, index: true },
      product: { type: ObjectId, ref: 'Product', required: true },
      sender: { type: ObjectId, ref: 'User', required: true },
      recipient: { type: ObjectId, ref: 'User', required: true, index: true },
      body: { type: String, required: true, maxlength: 1000 },
      wasMasked: { type: Boolean, default: false },
      readAt: Date,
    },
    { timestamps: true },
  ),
);

const favouriteSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    product: { type: ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true },
);
favouriteSchema.index({ user: 1, product: 1 }, { unique: true });
const Favourite = mongoose.model('Favourite', favouriteSchema);

const Complaint = mongoose.model(
  'Complaint',
  new mongoose.Schema(
    {
      complaintRef: { type: String, required: true, unique: true },
      user: { type: ObjectId, ref: 'User', required: true, index: true },
      category: { type: String, enum: ['booking', 'order', 'listing', 'payment', 'account', 'other'], default: 'other' },
      subject: { type: String, required: true, maxlength: 120 },
      description: { type: String, required: true, maxlength: 2000 },
      relatedId: String,
      status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
      adminResponse: { type: String, maxlength: 2000 },
      resolvedBy: { type: ObjectId, ref: 'User' },
      resolvedAt: Date,
    },
    { timestamps: true },
  ),
);

const EcoReward = mongoose.model(
  'EcoReward',
  new mongoose.Schema(
    {
      user: { type: ObjectId, ref: 'User', required: true, index: true },
      points: { type: Number, required: true },
      type: { type: String, enum: ['earn', 'redeem', 'adjust'], default: 'earn' },
      reason: { type: String, required: true },
      refType: { type: String, enum: ['booking', 'order', 'admin'] },
      refId: ObjectId,
      awardedBy: { type: ObjectId, ref: 'User' },
      isDemo: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
);

const AIAnalysis = mongoose.model(
  'AIAnalysis',
  new mongoose.Schema(
    {
      user: { type: ObjectId, ref: 'User', index: true },
      type: { type: String, enum: ['classify', 'recommend', 'price', 'describe', 'chat'], required: true, index: true },
      provider: String, // e.g. huggingface-clip, demo-heuristic, rules, llm, template, retrieval
      input: Mixed,
      output: Mixed,
      confidence: Number,
      latencyMs: Number,
      success: { type: Boolean, default: true },
      error: String,
      imageUrl: String,
    },
    { timestamps: true },
  ),
);

const ProductCategory = mongoose.model(
  'ProductCategory',
  new mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      slug: { type: String, required: true, unique: true, lowercase: true },
      icon: { type: String, default: 'Package' },
      description: String,
      isActive: { type: Boolean, default: true },
      sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);

const PlatformSetting = mongoose.model(
  'PlatformSetting',
  new mongoose.Schema(
    {
      key: { type: String, required: true, unique: true },
      value: Mixed,
      updatedBy: { type: ObjectId, ref: 'User' },
    },
    { timestamps: true },
  ),
);

module.exports = { Notification, Message, Favourite, Complaint, EcoReward, AIAnalysis, ProductCategory, PlatformSetting };
