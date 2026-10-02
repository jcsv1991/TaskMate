const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { unauthorized } = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Authenticate a request from either `x-auth-token: <jwt>` (what the original
 * client sends) or the standard `Authorization: Bearer <jwt>` header.
 *
 * `req.user` is the user's id (string), as before. We also confirm the account
 * still exists, so a token for a deleted account (or an expired demo workspace)
 * stops working immediately instead of silently creating orphaned data.
 */
const auth = (config) =>
  asyncHandler(async (req, _res, next) => {
    let token = req.header('x-auth-token');
    if (!token) {
      const header = req.header('Authorization');
      if (header && header.startsWith('Bearer ')) token = header.slice(7).trim();
    }
    if (!token) throw unauthorized('No token, authorization denied');

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      throw unauthorized(err.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Token is not valid');
    }

    if (!decoded.userId || !mongoose.isValidObjectId(decoded.userId)) throw unauthorized('Token is not valid');
    const exists = await User.exists({ _id: decoded.userId });
    if (!exists) throw unauthorized('Account no longer exists');

    req.user = String(decoded.userId);
    next();
  });

module.exports = auth;
