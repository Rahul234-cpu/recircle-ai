const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

let cloudinary = null;
if (env.cloudinaryEnabled) {
  // eslint-disable-next-line global-require
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function uploadToCloudinary(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `recircle/${folder}`, resource_type: 'image', transformation: [{ width: 1600, crop: 'limit' }] },
      (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })),
    );
    stream.end(file.buffer);
  });
}

async function saveLocally(file, folder) {
  const dir = path.join(UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype] || '.img'}`;
  await fs.writeFile(path.join(dir, name), file.buffer);
  return { url: `${env.publicApiUrl}/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}` };
}

/** Store uploaded multer files; returns [{url, publicId}]. */
async function storeImages(files = [], folder = 'misc') {
  const store = env.cloudinaryEnabled ? uploadToCloudinary : saveLocally;
  return Promise.all(files.map((f) => store(f, folder)));
}

async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      await fs.unlink(path.join(UPLOAD_DIR, publicId.slice(6)));
    } else if (cloudinary) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch {
    /* best-effort cleanup */
  }
}

module.exports = { storeImages, deleteImage, UPLOAD_DIR, mode: env.cloudinaryEnabled ? 'cloudinary' : 'local' };
