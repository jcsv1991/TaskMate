// Express 4 does not catch rejected promises from async handlers on its own.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
