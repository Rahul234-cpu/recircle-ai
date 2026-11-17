const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Magic-number check so a renamed .exe cannot pass as image/png.
function looksLikeImage(buf) {
  if (!buf || buf.length < 12) return false;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  return jpg || png || webp;
}

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPEG, PNG or WebP images are allowed'));
    }
    return cb(null, true);
  },
});

function verifyImageContents(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  for (const f of files) {
    if (!looksLikeImage(f.buffer)) return next(ApiError.badRequest(`${f.originalname} is not a valid image file`));
  }
  return next();
}

function wrap(mw) {
  return (req, res, next) => mw(req, res, (err) => {
    if (!err) return verifyImageContents(req, res, next);
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller'
        : err.code === 'LIMIT_FILE_COUNT' ? 'You can upload at most 6 images' : err.message;
      return next(ApiError.badRequest(msg));
    }
    return next(err);
  });
}

module.exports = {
  uploadImages: (field = 'images', max = 6) => wrap(multerInstance.array(field, max)),
  uploadSingle: (field = 'image') => wrap(multerInstance.single(field)),
  looksLikeImage,
};
