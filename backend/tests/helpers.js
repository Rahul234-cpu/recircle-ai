const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const models = require('../models');
const { signToken } = require('../middleware/auth');

let mongod;

async function startDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(models).map((m) => m.syncIndexes && m.syncIndexes()));
}

async function stopDB() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDB() {
  await Promise.all(Object.values(models).map((m) => m.deleteMany && m.deleteMany({})));
  require('../services/settingsService').clearCache();
}

async function createUser(overrides = {}) {
  const u = new models.User({
    name: 'Test User',
    email: `u${Date.now()}${Math.random().toString(16).slice(2, 6)}@test.dev`,
    phone: '9876543210',
    role: 'customer',
    ...overrides,
  });
  await u.setPassword(overrides.password || 'Passw0rd!');
  await u.save();
  return { user: u, token: signToken(u) };
}

const HOME = [77.6412, 12.9719];

async function createCollector(overrides = {}) {
  const { user, token } = await createUser({ role: 'collector', name: 'Collector', ...overrides.user });
  const profile = await models.Collector.create({
    userId: user._id,
    businessName: 'Test Kabadi',
    idProofType: 'aadhaar',
    idProofLast4: '1234',
    serviceAreas: [{ name: 'Indiranagar', pincode: '560038' }],
    location: { type: 'Point', coordinates: overrides.coords || [77.645, 12.97] },
    serviceRadiusKm: 10,
    availability: { days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], timeSlots: ['10:00-12:00', '14:00-16:00'], dailyCapacity: 5 },
    verificationStatus: overrides.verificationStatus || 'approved',
  });
  return { user, token, profile };
}

async function seedWaste() {
  const paper = await models.WasteCategory.create({ name: 'Newspaper', slug: 'newspaper', materialType: 'paper' });
  const metal = await models.WasteCategory.create({ name: 'Iron', slug: 'iron', materialType: 'metal' });
  await models.ScrapRate.create({ category: paper._id, pricePerKg: 14, resalePricePerKg: 18 });
  await models.ScrapRate.create({ category: metal._id, pricePerKg: 28, resalePricePerKg: 34 });
  return { paper, metal };
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

// Smallest valid PNG (1×1)
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

module.exports = {
  startDB, stopDB, clearDB, createUser, createCollector, seedWaste, tomorrowISO, api, auth, HOME, PNG_1PX, models,
};
