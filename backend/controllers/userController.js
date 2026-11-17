const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { storeImages } = require('../services/storageService');
const { userImpact } = require('../services/impactService');
const { buildSession } = require('./authController');

exports.getProfile = async (req, res) => {
  res.json({ success: true, user: await buildSession(req.user) });
};

exports.updateProfile = async (req, res) => {
  const { name, phone } = req.body;
  if (name) req.user.name = name;
  if (phone) req.user.phone = phone;
  if (req.file) {
    const [img] = await storeImages([req.file], 'avatars');
    req.user.profileImage = img.url;
  }
  await req.user.save();
  res.json({ success: true, user: await buildSession(req.user) });
};

exports.listAddresses = async (req, res) => {
  res.json({ success: true, addresses: req.user.addresses });
};

function toAddressDoc(body) {
  const { coordinates, ...rest } = body;
  return { ...rest, ...(coordinates ? { location: { type: 'Point', coordinates } } : {}) };
}

exports.addAddress = async (req, res) => {
  if (req.user.addresses.length >= 10) throw ApiError.badRequest('You can save up to 10 addresses');
  const doc = toAddressDoc(req.body);
  if (doc.isDefault || req.user.addresses.length === 0) {
    req.user.addresses.forEach((a) => { a.isDefault = false; });
    doc.isDefault = true;
  }
  req.user.addresses.push(doc);
  await req.user.save();
  res.status(201).json({ success: true, addresses: req.user.addresses });
};

exports.updateAddress = async (req, res) => {
  const addr = req.user.addresses.id(req.params.addressId);
  if (!addr) throw ApiError.notFound('Address not found');
  const doc = toAddressDoc(req.body);
  if (doc.isDefault) req.user.addresses.forEach((a) => { a.isDefault = false; });
  addr.set(doc);
  await req.user.save();
  res.json({ success: true, addresses: req.user.addresses });
};

exports.deleteAddress = async (req, res) => {
  const addr = req.user.addresses.id(req.params.addressId);
  if (!addr) throw ApiError.notFound('Address not found');
  addr.deleteOne();
  if (!req.user.addresses.some((a) => a.isDefault) && req.user.addresses[0]) req.user.addresses[0].isDefault = true;
  await req.user.save();
  res.json({ success: true, addresses: req.user.addresses });
};

exports.impact = async (req, res) => {
  res.json({ success: true, impact: await userImpact(req.user._id) });
};

exports.publicProfile = async (req, res) => {
  const user = await User.findById(req.params.id).select('name profileImage sellerRating role createdAt');
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, user });
};
