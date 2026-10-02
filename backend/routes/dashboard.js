const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { resolveToday } = require('../utils/dates');
const makeAuth = require('../middleware/auth');
const { buildSummary } = require('../services/summary');

module.exports = (config) => {
  const router = express.Router();
  router.use(makeAuth(config));

  // GET /api/dashboard/summary
  router.get(
    '/summary',
    asyncHandler(async (req, res) => {
      res.json(await buildSummary(req.user, resolveToday(req)));
    })
  );

  return router;
};
