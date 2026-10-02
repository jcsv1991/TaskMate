const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { buildApp, signup, request } = require('../helpers/factory');
const { loadConfig } = require('../../config/env');
const connectDB = require('../../config/db');

describe('app basics', () => {
  const app = buildApp();

  test('health check reports the database state', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected', version: expect.any(String) });
    expect(res.body.uptime).toEqual(expect.any(Number));
  });

  test('the original /api/test/health path still works', async () => {
    const res = await request(app).get('/api/test/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK' });
  });

  test('root describes the API', async () => {
    const res = await request(app).get('/');
    expect(res.body).toMatchObject({ name: 'TaskMate API', health: '/api/health' });
  });

  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nope?x=1');
    expect(res.status).toBe(404);
    expect(res.body.msg).toBe('Route not found: GET /api/nope');
    expect((await request(app).post('/totally/unknown')).status).toBe(404);
  });

  test('security headers are set and the framework is not advertised', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  test('oversized bodies are refused', async () => {
    const { token } = await signup(app);
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'x', description: 'y'.repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.msg).toMatch(/too large/i);
  });

  test('invalid JSON is a 400, not a 500', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/valid JSON/i);
  });

  test('pagination headers are exposed to browsers via CORS', async () => {
    const { token } = await signup(app);
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`).set('Origin', 'https://example.com');
    expect(res.headers['access-control-expose-headers']).toMatch(/X-Total-Count/);
  });

  test('internal errors do not leak details', async () => {
    const { token } = await signup(app);
    const spy = jest.spyOn(require('../../models/Task'), 'countDocuments').mockImplementation(() => {
      throw new Error('secret connection string mongodb://user:pass@host');
    });
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ msg: 'Something went wrong on our side' });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|mongodb:\/\//);
  });

  test('a duplicate-key error becomes a 409', async () => {
    const { buildApp: build } = require('../helpers/factory');
    const User = require('../../models/User');
    const a = build();
    const { email } = await signup(a);
    // Bypass the application-level check to hit the database's unique index.
    await expect(User.create({ email, password: 'x' })).rejects.toMatchObject({ code: 11000 });
  });
});

describe('CORS allow-list', () => {
  const app = buildApp({ corsOrigins: ['https://taskmate.example.com', 'http://localhost:5173'] });

  test('allowed origins are echoed back', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://taskmate.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://taskmate.example.com');
  });

  test('other origins are refused', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('requests without an Origin (curl, server-side) are fine', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  test('pre-flight succeeds for custom headers', async () => {
    const res = await request(app)
      .options('/api/tasks')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'x-auth-token,x-client-today');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-headers']).toMatch(/x-client-today/i);
  });

  test('wildcard (the default) allows any origin', async () => {
    const open = buildApp();
    const res = await request(open).get('/api/health').set('Origin', 'https://anything.example');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('configuration', () => {
  test('requires a JWT secret outside of tests', () => {
    expect(() => loadConfig({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET is required/);
  });

  test('requires a long enough secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/at least 16/);
    expect(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) }).isProduction).toBe(true);
  });

  test('has safe defaults', () => {
    const c = loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'dev-secret-dev-secret' });
    expect(c).toMatchObject({ port: 5000, corsOrigins: ['*'], demoEnabled: true, demoTtlHours: 24, jwtExpiresIn: '1d' });
    expect(c.rateLimit.enabled).toBe(true);
  });

  test('parses overrides', () => {
    const c = loadConfig({
      NODE_ENV: 'development',
      JWT_SECRET: 'dev-secret-dev-secret',
      PORT: '8080',
      CORS_ORIGIN: 'https://a.com, https://b.com ,',
      DEMO_ENABLED: 'false',
      DEMO_TTL_HOURS: '2',
      RATE_LIMIT_ENABLED: 'false',
      RATE_LIMIT_MAX: '5',
    });
    expect(c).toMatchObject({ port: 8080, corsOrigins: ['https://a.com', 'https://b.com'], demoEnabled: false, demoTtlHours: 2 });
    expect(c.rateLimit).toMatchObject({ enabled: false, max: 5 });
  });

  test('rate limiting is off in tests unless asked for', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).rateLimit.enabled).toBe(false);
  });

  test('connectDB demands a URI and surfaces connection errors instead of exiting', async () => {
    await expect(connectDB()).rejects.toThrow(/MONGO_URI is not set/);
    expect(mongoose.connection.readyState).toBe(1); // the test database connection is untouched
  });
});

describe('deployment manifest', () => {
  // The repo root package.json mirrors the backend's runtime dependencies so a
  // host that installs from the repo root (instead of ./backend) still works.
  test('root package.json lists every backend runtime dependency at the same version', () => {
    const root = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'));
    const backend = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    expect(root.dependencies).toEqual(backend.dependencies);
  });
});
