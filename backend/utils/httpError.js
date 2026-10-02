/**
 * Error with an HTTP status code. Thrown from route handlers and turned into a
 * consistent `{ msg }` JSON response by the central error handler.
 */
class HttpError extends Error {
  constructor(status, msg, details) {
    super(msg);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const unauthorized = (msg = 'Not authorized') => new HttpError(401, msg);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const conflict = (msg, details) => new HttpError(409, msg, details);

module.exports = { HttpError, badRequest, unauthorized, notFound, conflict };
