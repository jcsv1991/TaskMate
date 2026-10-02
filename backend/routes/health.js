const express = require('express');
const mongoose = require('mongoose');
const pkg = require('../package.json');

const router = express.Router();

// GET /api/health  - used by Render's health check and by the UI's "waking up" banner.
router.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'degraded',
    db: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
    version: pkg.version,
  });
});

module.exports = router;
