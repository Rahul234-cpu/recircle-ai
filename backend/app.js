const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { globalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFound, sanitizeInput } = require('./middleware/errorHandler');
const storage = require('./services/storageService');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, cb) {
    if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use('/api', globalLimiter);

// Local image storage (demo mode when Cloudinary is not configured).
app.use('/uploads', express.static(storage.UPLOAD_DIR, { maxAge: '7d', fallthrough: true }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    services: {
      storage: storage.mode,
      email: env.smtpEnabled ? 'smtp' : 'console (demo)',
      payments: env.razorpayEnabled ? 'razorpay-test' : 'cash-on-handover (demo)',
    },
  });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
