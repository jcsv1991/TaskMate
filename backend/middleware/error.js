const { ZodError } = require('zod');
const { HttpError } = require('../utils/httpError');

const notFoundHandler = (req, res) => {
  res.status(404).json({ msg: `Route not found: ${req.method} ${req.originalUrl.split('?')[0]}` });
};

/**
 * One place that turns every failure into the same `{ msg, errors? }` shape.
 * Unknown errors are logged and returned as a generic 500 so internals (stack
 * traces, database messages) never leak to clients.
 */
const errorHandler = (config) => (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    const first = errors[0];
    const msg = first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Validation failed';
    return res.status(400).json({ msg, errors });
  }
  if (err instanceof HttpError) {
    const body = { msg: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ msg: 'Request body is not valid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ msg: 'Request body is too large' });
  if (err.name === 'CastError') return res.status(400).json({ msg: `Invalid ${err.path === '_id' ? 'id' : err.path || 'value'}` });
  if (err.name === 'ValidationError') return res.status(400).json({ msg: err.message });
  if (err.code === 11000) return res.status(409).json({ msg: 'That value is already in use' });
  if (err.message && err.message.startsWith('Not allowed by CORS')) return res.status(403).json({ msg: err.message });

  if (!config.isTest) console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ msg: 'Something went wrong on our side' });
};

module.exports = { notFoundHandler, errorHandler };
