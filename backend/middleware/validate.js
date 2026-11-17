const ApiError = require('../utils/ApiError');

/**
 * validate({ body, query, params }) with zod schemas.
 * Parsed (coerced, stripped) values replace the originals.
 */
function validate(schemas) {
  return (req, res, next) => {
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
        return next(ApiError.badRequest('Validation failed', details));
      }
      if (part === 'query') {
        // req.query is a getter in Express 5; assign keys for compatibility.
        Object.keys(req.query).forEach((k) => delete req.query[k]);
        Object.assign(req.query, result.data);
      } else {
        req[part] = result.data;
      }
    }
    return next();
  };
}

module.exports = validate;
