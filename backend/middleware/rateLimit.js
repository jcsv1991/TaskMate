const rateLimit = require('express-rate-limit');

const make = (config, { windowMs, max, msg }) => {
  if (!config.rateLimit.enabled) return (_req, _res, next) => next();
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg },
  });
};

module.exports = {
  // Generous limit for the whole API.
  api: (config) =>
    make(config, {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      msg: 'Too many requests, please slow down and try again shortly',
    }),
  // Strict limit on credential endpoints to slow down password guessing.
  auth: (config) =>
    make(config, {
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.authMax,
      msg: 'Too many attempts, please wait a few minutes and try again',
    }),
  // Each demo click creates a seeded workspace, so cap it per hour.
  demo: (config) =>
    make(config, {
      windowMs: 60 * 60 * 1000,
      max: config.rateLimit.demoMax,
      msg: 'Demo limit reached for now, please try again in an hour',
    }),
};
