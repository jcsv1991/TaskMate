/**
 * Validate req.body / req.query / req.params with a zod schema. The parsed
 * (trimmed, coerced, defaulted) value replaces the raw input, so handlers only
 * ever see data that has passed validation. Because unknown keys are stripped
 * and every field is a primitive, an input like ?status[$ne]=x is rejected
 * instead of reaching MongoDB (NoSQL operator injection).
 */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  // req.query is a getter in newer Express versions, so store parsed values separately.
  req.valid = req.valid || {};
  req.valid[source] = result.data;
  return next();
};

module.exports = validate;
