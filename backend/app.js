const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { loadConfig } = require('./config/env');
const limiter = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const healthRoute = require('./routes/health');
const pkg = require('./package.json');

const EXPOSED_HEADERS = ['X-Total-Count', 'X-Page', 'X-Per-Page', 'X-Total-Pages', 'X-Total-Amount', 'Content-Disposition'];

/**
 * Build the Express app. It does not connect to MongoDB or open a port, which
 * keeps it trivially testable with supertest (see server.js for the entry point).
 */
function createApp(overrides = {}) {
  const config = { ...loadConfig(), ...overrides };
  const app = express();

  // Render (and most hosts) put one reverse proxy in front of the app. Needed
  // for correct client IPs, which the rate limiter keys on.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowAll = config.corsOrigins.includes('*');
  app.use(
    cors({
      origin: allowAll
        ? '*'
        : (origin, callback) => {
            // No Origin header = curl, server-to-server, same-origin: always fine.
            if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
            return callback(new Error(`Not allowed by CORS: ${origin}`));
          },
      exposedHeaders: EXPOSED_HEADERS,
      maxAge: 86400,
    })
  );

  app.use(express.json({ limit: '100kb' }));

  if (!config.isTest) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - start}ms`));
      next();
    });
  }

  app.get('/', (_req, res) => {
    res.json({ name: 'TaskMate API', version: pkg.version, health: '/api/health' });
  });

  app.use('/api', healthRoute);
  // Original health-check path, kept so existing monitors keep working.
  app.get('/api/test/health', (_req, res) => res.json({ status: 'OK' }));

  app.use('/api', limiter.api(config));
  app.use('/api/auth', require('./routes/auth')(config));
  app.use('/api/clients', require('./routes/clients')(config));
  app.use('/api/tasks', require('./routes/tasks')(config));
  app.use('/api/invoices', require('./routes/invoices')(config));
  app.use('/api/dashboard', require('./routes/dashboard')(config));
  app.use('/api/export', require('./routes/exports')(config));

  app.use(notFoundHandler);
  app.use(errorHandler(config));

  app.locals.config = config;
  return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
