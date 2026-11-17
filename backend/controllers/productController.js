const mongoose = require('mongoose');
const {
  Product, ProductCategory, Favourite, User, Order,
} = require('../models');
const { PRODUCT_STATUS: P, ROLES, ORDER_STATUS: O } = require('../config/constants');
const { productMachine } = require('../utils/stateMachines');
const ApiError = require('../utils/ApiError');
const { getPagination, paginated } = require('../utils/pagination');
const { sanitizeText } = require('../utils/privacy');
const { storeImages, deleteImage } = require('../services/storageService');
const { getSettings } = require('../services/settingsService');
const { emitToRole } = require('../sockets');

const PUBLIC_STATUSES = [P.AVAILABLE, P.RESERVED, P.SOLD];
const EDITABLE = [P.DRAFT, P.AVAILABLE, P.PENDING_APPROVAL, P.REJECTED];

// Store listing location rounded to ~100 m so a seller's exact home is not published.
const fuzz = ([lng, lat]) => [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.categories = async (req, res) => {
  const categories = await ProductCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([{ $match: { status: P.AVAILABLE } }, { $group: { _id: '$category', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json({ success: true, categories: categories.map((c) => ({ ...c, count: map[c.slug] || 0 })) });
};

exports.list = async (req, res) => {
  const q = req.query;
  const pg = getPagination(q, { defaultLimit: 12, maxLimit: 60 });
  const filter = { status: P.AVAILABLE };
  if (q.category) filter.category = { $in: q.category.split(',') };
  if (q.condition) filter.condition = { $in: q.condition.split(',') };
  if (q.minPrice != null || q.maxPrice != null) {
    filter.sellingPrice = {};
    if (q.minPrice != null) filter.sellingPrice.$gte = q.minPrice;
    if (q.maxPrice != null) filter.sellingPrice.$lte = q.maxPrice;
  }
  if (q.city) filter['locationLabel.city'] = new RegExp(`^${escapeRegex(q.city)}$`, 'i');
  if (q.q) filter.$text = { $search: q.q };

  const geo = q.lng != null && q.lat != null;
  if (geo) {
    filter.location = { $geoWithin: { $centerSphere: [[q.lng, q.lat], (q.radiusKm || 25) / 6378.1] } };
  }

  const sorts = {
    newest: { createdAt: -1 },
    price_asc: { sellingPrice: 1 },
    price_desc: { sellingPrice: -1 },
    popular: { views: -1, favouritesCount: -1 },
  };
  let sort = sorts[q.sort] || sorts.newest;
  const projection = {};
  if (q.q && !q.sort) {
    sort = { score: { $meta: 'textScore' } };
    projection.score = { $meta: 'textScore' };
  }

  const [items, total] = await Promise.all([
    Product.find(filter, projection).sort(sort).skip(pg.skip).limit(pg.limit)
      .select('-statusHistory').populate('sellerId', 'name profileImage sellerRating').lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pg) });
};

async function loadProduct(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Product not found');
  const p = await Product.findById(id);
  if (!p) throw ApiError.notFound('Product not found');
  return p;
}

const isOwner = (p, user) => user && String(p.sellerId._id || p.sellerId) === String(user._id);

exports.get = async (req, res) => {
  const product = await Product.findById(req.params.id).populate('sellerId', 'name profileImage sellerRating createdAt');
  if (!product) throw ApiError.notFound('Product not found');
  const owner = isOwner(product, req.user);
  const admin = req.user?.role === ROLES.ADMIN;
  if (!PUBLIC_STATUSES.includes(product.status) && !owner && !admin) throw ApiError.notFound('Product not found');

  if (!owner) {
    await Product.updateOne({ _id: product._id }, { $inc: { views: 1 } });
    if (req.user) {
      await User.updateOne({ _id: req.user._id }, { $pull: { recentlyViewed: product._id } });
      await User.updateOne({ _id: req.user._id }, { $push: { recentlyViewed: { $each: [product._id], $position: 0, $slice: 20 } } });
    }
  }

  let isFavourite = false;
  let myActiveOrder = null;
  if (req.user) {
    isFavourite = Boolean(await Favourite.exists({ user: req.user._id, product: product._id }));
    myActiveOrder = await Order.findOne({ product: product._id, buyer: req.user._id, status: { $in: [O.REQUESTED, O.ACCEPTED] } }).select('_id status orderRef');
  }
  const similar = await Product.find({ _id: { $ne: product._id }, category: product.category, status: P.AVAILABLE })
    .limit(4).select('title images sellingPrice condition locationLabel').lean();

  res.json({ success: true, product, isOwner: owner, isFavourite, myActiveOrder, similar });
};

async function initialStatus(publish) {
  if (!publish) return P.DRAFT;
  const settings = await getSettings();
  return settings.listingRequiresApproval ? P.PENDING_APPROVAL : P.AVAILABLE;
}

exports.create = async (req, res) => {
  const b = req.body;
  if (!req.files?.length) throw ApiError.badRequest('Upload at least one product image');
  const category = await ProductCategory.findOne({ slug: b.category, isActive: true });
  if (!category) throw ApiError.badRequest('Unknown product category');

  const images = await storeImages(req.files, 'products');
  const status = await initialStatus(b.publish);
  const product = await Product.create({
    sellerId: req.user._id,
    title: sanitizeText(b.title),
    description: sanitizeText(b.description),
    category: b.category,
    images,
    brand: b.brand,
    condition: b.condition,
    ageMonths: b.ageMonths,
    features: b.features,
    originalPrice: b.originalPrice,
    sellingPrice: b.sellingPrice,
    AIRecommendedPrice: b.aiRecommendedPrice,
    aiRecommendation: b.aiRecommendation,
    location: { type: 'Point', coordinates: fuzz(b.coordinates) },
    locationLabel: { locality: b.locality, city: b.city },
    status,
  });
  if (status === P.PENDING_APPROVAL) emitToRole('admin', 'admin.alert', { type: 'listing.pending', productId: product._id });
  res.status(201).json({ success: true, product });
};

exports.update = async (req, res) => {
  const product = await loadProduct(req.params.id);
  if (!isOwner(product, req.user)) throw ApiError.forbidden('You can only edit your own listings');
  if (!EDITABLE.includes(product.status)) throw ApiError.conflict(`A ${product.status.toLowerCase()} listing cannot be edited`);

  const b = req.body;
  if (b.category) {
    const ok = await ProductCategory.exists({ slug: b.category, isActive: true });
    if (!ok) throw ApiError.badRequest('Unknown product category');
  }

  // Images: keep the ones the client lists, delete the rest, append new uploads.
  const keep = b.keepImages || product.images.map((i) => i.url);
  const removed = product.images.filter((i) => !keep.includes(i.url));
  const kept = product.images.filter((i) => keep.includes(i.url));
  const added = req.files?.length ? await storeImages(req.files, 'products') : [];
  const images = [...kept, ...added];
  if (!images.length) throw ApiError.badRequest('A listing needs at least one image');
  if (images.length > 6) throw ApiError.badRequest('A listing can have at most 6 images');

  ['category', 'brand', 'condition', 'ageMonths', 'features', 'originalPrice', 'sellingPrice'].forEach((k) => {
    if (b[k] !== undefined) product[k] = b[k];
  });
  if (b.title) product.title = sanitizeText(b.title);
  if (b.description) product.description = sanitizeText(b.description);
  if (b.aiRecommendedPrice) product.AIRecommendedPrice = b.aiRecommendedPrice;
  if (b.aiRecommendation) product.aiRecommendation = b.aiRecommendation;
  if (b.coordinates) product.location = { type: 'Point', coordinates: fuzz(b.coordinates) };
  if (b.city) product.locationLabel = { locality: b.locality, city: b.city };
  product.images = images;

  if (b.publish === true && [P.DRAFT, P.REJECTED].includes(product.status)) product.status = await initialStatus(true);
  if (b.publish === false && product.status === P.AVAILABLE) product.status = P.DRAFT;
  // Edits to an approved listing re-enter review when approval is required.
  if (product.status === P.AVAILABLE && (await getSettings()).listingRequiresApproval && (b.title || b.description || added.length)) {
    product.status = P.PENDING_APPROVAL;
  }

  await product.save();
  removed.forEach((i) => deleteImage(i.publicId));
  res.json({ success: true, product });
};

exports.remove = async (req, res) => {
  const product = await loadProduct(req.params.id);
  const actor = req.user.role === ROLES.ADMIN ? 'admin' : isOwner(product, req.user) ? 'seller' : null;
  if (!actor) throw ApiError.forbidden('You can only delete your own listings');
  if (!productMachine.canTransition(product.status, P.REMOVED, actor)) {
    throw ApiError.conflict(`A ${product.status.toLowerCase()} listing cannot be removed${product.status === P.RESERVED ? ' — cancel the accepted order first' : ''}`);
  }
  product.status = P.REMOVED;
  await product.save();
  res.json({ success: true, message: 'Listing removed' });
};

exports.myListings = async (req, res) => {
  const pg = getPagination(req.query, { defaultLimit: 20 });
  const filter = { sellerId: req.user._id, status: { $ne: P.REMOVED } };
  if (req.query.status) filter.status = { $in: req.query.status.split(',') };
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Product.countDocuments(filter),
  ]);
  const ids = items.map((i) => i._id);
  const reqCounts = await Order.aggregate([
    { $match: { product: { $in: ids }, status: O.REQUESTED } },
    { $group: { _id: '$product', n: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(reqCounts.map((r) => [String(r._id), r.n]));
  res.json({ success: true, ...paginated(items.map((i) => ({ ...i, pendingRequests: map[String(i._id)] || 0 })), total, pg) });
};

exports.recommended = async (req, res) => {
  const favs = await Favourite.find({ user: req.user._id }).populate('product', 'category').limit(20).lean();
  const viewed = await Product.find({ _id: { $in: req.user.recentlyViewed || [] } }).select('category').lean();
  const cats = [...new Set([...favs.map((f) => f.product?.category), ...viewed.map((v) => v.category)].filter(Boolean))];
  const filter = { status: P.AVAILABLE, sellerId: { $ne: req.user._id } };
  if (cats.length) filter.category = { $in: cats };
  const items = await Product.find(filter).sort({ views: -1, createdAt: -1 }).limit(8).select('title images sellingPrice condition locationLabel category').lean();
  res.json({ success: true, items, basedOn: cats });
};

exports.recentlyViewed = async (req, res) => {
  const ids = req.user.recentlyViewed || [];
  const docs = await Product.find({ _id: { $in: ids }, status: { $in: PUBLIC_STATUSES } }).select('title images sellingPrice condition status locationLabel').lean();
  const order = new Map(ids.map((id, i) => [String(id), i]));
  docs.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
  res.json({ success: true, items: docs });
};

exports.mapPoints = async (req, res) => {
  const { lng, lat, radiusKm = 25 } = req.query;
  if (lng == null || lat == null) throw ApiError.badRequest('lng and lat are required');
  const items = await Product.find({
    status: P.AVAILABLE,
    location: { $geoWithin: { $centerSphere: [[Number(lng), Number(lat)], Number(radiusKm) / 6378.1] } },
  }).limit(200).select('title sellingPrice location images condition locationLabel').lean();
  res.json({ success: true, items });
};
