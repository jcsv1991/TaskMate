require('dotenv').config();

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Read and validate configuration. Called when the app is created (not at
 * import time) so tests can change process.env first.
 */
function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isTest = nodeEnv === 'test';

  const jwtSecret = env.JWT_SECRET || (isTest ? 'test-secret-do-not-use-in-production' : undefined);
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required. Copy backend/.env.example to backend/.env and set it.');
  }
  if (nodeEnv === 'production' && jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be at least 16 characters in production.');
  }

  return {
    nodeEnv,
    isTest,
    isProduction: nodeEnv === 'production',
    port: int(env.PORT, 5000),
    mongoUri: env.MONGO_URI,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1d',
    // Comma separated list of allowed browser origins. "*" (default) allows any
    // origin, which is safe here because auth uses a header token, not cookies.
    corsOrigins: (env.CORS_ORIGIN || '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    demoEnabled: bool(env.DEMO_ENABLED, true),
    // How long a generated demo workspace lives before MongoDB's TTL monitor removes it.
    demoTtlHours: int(env.DEMO_TTL_HOURS, 24),
    rateLimit: {
      enabled: bool(env.RATE_LIMIT_ENABLED, !isTest),
      windowMs: int(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      max: int(env.RATE_LIMIT_MAX, 600),
      authMax: int(env.RATE_LIMIT_AUTH_MAX, 30),
      demoMax: int(env.RATE_LIMIT_DEMO_MAX, 10),
    },
  };
}

module.exports = { loadConfig };
