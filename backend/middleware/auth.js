const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Requires a valid JWT; loads the user and attaches it to req.user. */
async function protect(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw ApiError.unauthorized('Session expired or invalid. Please log in again.');
    }
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Attaches req.user if a valid token is present, otherwise continues anonymously. */
async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub);
    if (user && user.isActive) req.user = user;
  } catch {
    /* ignore invalid token for public routes */
  }
  return next();
}

/** Role guard: authorize('admin') or authorize('customer', 'buyer'). */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}

module.exports = { protect, optionalAuth, authorize, signToken };
