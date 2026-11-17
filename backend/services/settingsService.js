const { PlatformSetting } = require('../models');
const { DEFAULT_SETTINGS } = require('../config/constants');

let cache = null;
let cacheAt = 0;
const TTL = 30 * 1000;

async function getSettings() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  const docs = await PlatformSetting.find().lean();
  const merged = { ...DEFAULT_SETTINGS };
  docs.forEach((d) => { if (d.key in DEFAULT_SETTINGS) merged[d.key] = d.value; });
  cache = merged;
  cacheAt = Date.now();
  return merged;
}

async function updateSettings(patch, adminId) {
  const keys = Object.keys(patch).filter((k) => k in DEFAULT_SETTINGS);
  await Promise.all(keys.map((key) => PlatformSetting.findOneAndUpdate(
    { key },
    { value: patch[key], updatedBy: adminId },
    { upsert: true, new: true },
  )));
  cache = null;
  return getSettings();
}

function clearCache() { cache = null; }

module.exports = { getSettings, updateSettings, clearCache };
