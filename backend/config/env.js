require('dotenv').config();

const required = ['JWT_SECRET'];
for (const key of required) {
  if (!process.env[key] && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.warn(`[config] Missing ${key}. Copy backend/.env.example to backend/.env.`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/recircle_ai',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiServiceKey: process.env.AI_SERVICE_KEY || 'dev-internal-key',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 20000,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'ReCircle AI <no-reply@recircle.local>',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  publicApiUrl: process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`,
};

env.cloudinaryEnabled = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
env.smtpEnabled = Boolean(env.smtp.host && env.smtp.user);
env.razorpayEnabled = Boolean(env.razorpay.keyId && env.razorpay.keySecret);

module.exports = env;
