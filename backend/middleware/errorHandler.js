const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { stripMongoOperators } = require('../utils/privacy');

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = stripMongoOperators(req.body);
  if (req.params) req.params = stripMongoOperators(req.params);
  next();
}

function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let { details } = err;

  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field === 'email' ? 'An account with this email already exists' : `Duplicate value for ${field}`;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    if (!env.isTest) console.error('[error]', err);
    if (env.isProd) message = 'Internal server error';
  }

  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
    ...(!env.isProd && status >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { errorHandler, notFound, sanitizeInput };
