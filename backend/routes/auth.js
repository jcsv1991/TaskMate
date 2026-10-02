const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Client = require('../models/Client');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const asyncHandler = require('../utils/asyncHandler');
const escapeRegex = require('../utils/escapeRegex');
const { HttpError, badRequest, conflict } = require('../utils/httpError');
const { resolveToday } = require('../utils/dates');
const validate = require('../middleware/validate');
const makeAuth = require('../middleware/auth');
const limiter = require('../middleware/rateLimit');
const schemas = require('../schemas/auth');
const { createDemoWorkspace } = require('../services/demoSeed');

// Compared against when an email is unknown so "no such user" and "wrong
// password" take the same time and cannot be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

module.exports = (config) => {
  const router = express.Router();
  const auth = makeAuth(config);
  const strict = limiter.auth(config);

  const signToken = (user) => jwt.sign({ userId: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  // POST /api/auth/signup
  router.post(
    '/signup',
    strict,
    validate(schemas.signup),
    asyncHandler(async (req, res) => {
      const { email, password, name } = req.valid.body;
      const existing = await User.findOne({ email });
      if (existing) throw conflict('User already exists');

      const user = await User.create({ email, password: await bcrypt.hash(password, 10), name: name || '' });
      // `msg` keeps the original response contract; token + user let the UI sign in straight away.
      res.status(201).json({ msg: 'User created successfully', token: signToken(user), user: user.toJSON() });
    })
  );

  // POST /api/auth/login
  router.post(
    '/login',
    strict,
    validate(schemas.login),
    asyncHandler(async (req, res) => {
      const { email, password } = req.valid.body;
      const normalised = email.toLowerCase();

      let user = await User.findOne({ email: normalised });
      // Accounts created before emails were normalised may be stored with capitals.
      if (!user) user = await User.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, 'i') });

      const hash = user ? user.password : DUMMY_HASH;
      const ok = await bcrypt.compare(password, hash);
      if (!user || !ok) throw badRequest('Invalid credentials');

      res.json({ token: signToken(user), user: user.toJSON() });
    })
  );

  // POST /api/auth/demo  - one-click sample workspace
  router.post(
    '/demo',
    limiter.demo(config),
    asyncHandler(async (req, res) => {
      if (!config.demoEnabled) throw new HttpError(403, 'Demo mode is disabled on this server');
      const user = await createDemoWorkspace({ todayKey: resolveToday(req), ttlHours: config.demoTtlHours });
      res.status(201).json({ token: signToken(user), user: user.toJSON(), demo: true });
    })
  );

  // GET /api/auth/me
  router.get(
    '/me',
    auth,
    asyncHandler(async (req, res) => {
      const user = await User.findById(req.user);
      res.json({ user: user.toJSON() });
    })
  );

  // PATCH /api/auth/me
  router.patch(
    '/me',
    auth,
    validate(schemas.updateProfile),
    asyncHandler(async (req, res) => {
      const user = await User.findByIdAndUpdate(req.user, { $set: { name: req.valid.body.name } }, { new: true });
      res.json({ user: user.toJSON() });
    })
  );

  // DELETE /api/auth/me  - delete the account and everything in it
  router.delete(
    '/me',
    auth,
    asyncHandler(async (req, res) => {
      await Promise.all([
        Task.deleteMany({ userId: req.user }),
        Invoice.deleteMany({ userId: req.user }),
        Client.deleteMany({ userId: req.user }),
        Counter.deleteMany({ _id: `invoice:${req.user}` }),
      ]);
      await User.deleteOne({ _id: req.user });
      res.json({ msg: 'Account and all data deleted' });
    })
  );

  return router;
};
