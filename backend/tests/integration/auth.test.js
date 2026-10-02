const jwt = require('jsonwebtoken');
const { buildApp, signup, api, createClient, createTask, createInvoice, uniqueEmail, request, rel } = require('../helpers/factory');
const User = require('../../models/User');
const Client = require('../../models/Client');
const Task = require('../../models/Task');
const Invoice = require('../../models/Invoice');
const Counter = require('../../models/Counter');

const app = buildApp();
const SECRET = app.locals.config.jwtSecret;

describe('POST /api/auth/signup', () => {
  test('creates an account and returns a token, never the password', async () => {
    const email = uniqueEmail();
    const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123', name: 'Juan' });
    expect(res.status).toBe(201);
    expect(res.body.msg).toBe('User created successfully'); // original contract preserved
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email, name: 'Juan', isDemo: false });
    expect(JSON.stringify(res.body)).not.toMatch(/password123/);
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('stores a bcrypt hash, not the password', async () => {
    const { email } = await signup(app, { password: 'password123' });
    const stored = await User.findOne({ email }).lean();
    expect(stored.password).not.toBe('password123');
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  test('the issued token authenticates immediately', async () => {
    const { token } = await signup(app);
    const res = await request(app).get('/api/auth/me').set('x-auth-token', token);
    expect(res.status).toBe(200);
  });

  test('normalises email case and whitespace', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: '  Mixed.Case@Example.COM ', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('mixed.case@example.com');
  });

  test('rejects duplicates regardless of case', async () => {
    await signup(app, { email: 'dupe@example.com' });
    const res = await request(app).post('/api/auth/signup').send({ email: 'DUPE@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.msg).toBe('User already exists');
  });

  test.each([
    ['missing email', { password: 'password123' }, /email/i],
    ['invalid email', { email: 'nope', password: 'password123' }, /valid email/i],
    ['missing password', { email: 'a@b.co' }, /password/i],
    ['short password', { email: 'a@b.co', password: '1234567' }, /at least 8/i],
    ['too long password', { email: 'a@b.co', password: 'x'.repeat(73) }, /at most 72/i],
    ['non-string password', { email: 'a@b.co', password: 12345678 }, /password/i],
  ])('validation: %s', async (_name, body, pattern) => {
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(pattern);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('rejects NoSQL operator payloads', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: { $ne: null }, password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('returns a JWT for valid credentials', async () => {
    const { email, password } = await signup(app);
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.token, SECRET);
    expect(decoded.userId).toBe(res.body.user._id);
    expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
  });

  test('is case-insensitive for the email', async () => {
    const { email, password } = await signup(app, { email: 'casey@example.com' });
    const res = await request(app).post('/api/auth/login').send({ email: email.toUpperCase(), password });
    expect(res.status).toBe(200);
  });

  test('legacy accounts stored with capital letters and a 6 character password can still sign in', async () => {
    const bcrypt = require('bcryptjs');
    // Insert with the raw driver to bypass the model's new lowercase setter, like an old document.
    await User.collection.insertOne({ email: 'Legacy.User@Example.com', password: await bcrypt.hash('abc123', 10) });
    const res = await request(app).post('/api/auth/login').send({ email: 'legacy.user@example.com', password: 'abc123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('wrong password and unknown email give the same generic error', async () => {
    const { email } = await signup(app);
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'password123' });
    expect(wrong.status).toBe(400);
    expect(unknown.status).toBe(400);
    expect(wrong.body.msg).toBe('Invalid credentials');
    expect(unknown.body).toEqual(wrong.body);
  });

  test('requires both fields', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ email: 'a@b.co' })).status).toBe(400);
  });

  test('regex characters in the email are matched literally (no injection through the fallback lookup)', async () => {
    await signup(app, { email: 'victim@example.com' });
    const res = await request(app).post('/api/auth/login').send({ email: '.*', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Invalid credentials');
  });

  test('operator injection in login is rejected', async () => {
    await signup(app, { email: 'victim2@example.com' });
    const res = await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });
});

describe('token handling', () => {
  test('missing token -> 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/no token/i);
  });

  test('x-auth-token and Bearer are both accepted', async () => {
    const { token } = await signup(app);
    expect((await request(app).get('/api/tasks').set('x-auth-token', token)).status).toBe(200);
    expect((await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  test('garbage, wrong-secret and non-Bearer tokens are rejected', async () => {
    expect((await request(app).get('/api/tasks').set('x-auth-token', 'garbage')).status).toBe(401);
    const forged = jwt.sign({ userId: '507f1f77bcf86cd799439011' }, 'another-secret');
    expect((await request(app).get('/api/tasks').set('x-auth-token', forged)).status).toBe(401);
    const { token } = await signup(app);
    expect((await request(app).get('/api/tasks').set('Authorization', `Basic ${token}`)).status).toBe(401);
  });

  test('alg=none tokens are rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: '507f1f77bcf86cd799439011' })).toString('base64url');
    const res = await request(app).get('/api/tasks').set('x-auth-token', `${header}.${payload}.`);
    expect(res.status).toBe(401);
  });

  test('expired tokens say so', async () => {
    const { id } = await signup(app);
    const expired = jwt.sign({ userId: id }, SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/tasks').set('x-auth-token', expired);
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/expired/i);
  });

  test('a validly signed token with a malformed user id is rejected', async () => {
    const bad = jwt.sign({ userId: 'not-an-object-id' }, SECRET);
    expect((await request(app).get('/api/tasks').set('x-auth-token', bad)).status).toBe(401);
    const noId = jwt.sign({ foo: 'bar' }, SECRET);
    expect((await request(app).get('/api/tasks').set('x-auth-token', noId)).status).toBe(401);
  });

  test('a token for a deleted account stops working', async () => {
    const session = await signup(app);
    await User.deleteOne({ _id: session.id });
    const res = await request(app).get('/api/tasks').set(session.h);
    expect(res.status).toBe(401);
    expect(res.body.msg).toMatch(/no longer exists/i);
  });
});

describe('/api/auth/me', () => {
  test('GET returns the profile', async () => {
    const s = await signup(app, { name: 'Ada' });
    const res = await request(app).get('/api/auth/me').set(s.h);
    expect(res.body.user).toMatchObject({ email: s.email, name: 'Ada' });
  });

  test('PATCH updates the display name and validates it', async () => {
    const s = await signup(app);
    const ok = await request(app).patch('/api/auth/me').set(s.h).send({ name: '  Grace Hopper ' });
    expect(ok.body.user.name).toBe('Grace Hopper');
    const bad = await request(app).patch('/api/auth/me').set(s.h).send({ name: 'x'.repeat(81) });
    expect(bad.status).toBe(400);
  });

  test('DELETE removes the account and every record it owns, and nobody else’s', async () => {
    const a = await signup(app);
    const b = await signup(app);
    const A = api(app, a);
    const B = api(app, b);

    const clientA = await createClient(A);
    await createTask(A, { clientId: clientA._id });
    await createInvoice(A, clientA._id);
    const clientB = await createClient(B, { name: 'B Client' });
    await createTask(B);
    await createInvoice(B, clientB._id);

    const res = await request(app).delete('/api/auth/me').set(a.h);
    expect(res.status).toBe(200);

    expect(await User.countDocuments({ _id: a.id })).toBe(0);
    expect(await Client.countDocuments({ userId: a.id })).toBe(0);
    expect(await Task.countDocuments({ userId: a.id })).toBe(0);
    expect(await Invoice.countDocuments({ userId: a.id })).toBe(0);
    expect(await Counter.countDocuments({ _id: `invoice:${a.id}` })).toBe(0);

    expect(await Client.countDocuments({ userId: b.id })).toBe(1);
    expect(await Task.countDocuments({ userId: b.id })).toBe(1);
    expect(await Invoice.countDocuments({ userId: b.id })).toBe(1);
    expect((await request(app).get('/api/tasks').set(a.h)).status).toBe(401);
  });
});

describe('POST /api/auth/demo', () => {
  test('creates a sample workspace and signs the visitor in', async () => {
    const res = await request(app).post('/api/auth/demo');
    expect(res.status).toBe(201);
    expect(res.body.demo).toBe(true);
    expect(res.body.user.isDemo).toBe(true);
    expect(new Date(res.body.user.expiresAt).getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);

    const h = { Authorization: `Bearer ${res.body.token}` };
    const [clients, tasks, invoices] = await Promise.all([
      request(app).get('/api/clients').set(h),
      request(app).get('/api/tasks').set(h),
      request(app).get('/api/invoices').set(h),
    ]);
    expect(clients.body).toHaveLength(5);
    expect(tasks.body.length).toBeGreaterThanOrEqual(10);
    expect(invoices.body.length).toBeGreaterThanOrEqual(10);
  });

  test('sample data tells a story: overdue work, overdue invoices and paid revenue', async () => {
    const { body } = await request(app).post('/api/auth/demo');
    const summary = await request(app).get('/api/dashboard/summary').set({ Authorization: `Bearer ${body.token}` });
    expect(summary.body.tasks.overdue).toBeGreaterThanOrEqual(1);
    expect(summary.body.tasks.completed).toBeGreaterThanOrEqual(1);
    expect(summary.body.invoices.overdueCount).toBeGreaterThanOrEqual(1);
    expect(summary.body.invoices.paidAmount).toBeGreaterThan(0);
    expect(summary.body.revenueByMonth.filter((m) => m.paid > 0).length).toBeGreaterThanOrEqual(4);
  });

  test('every demo workspace is private and expiring', async () => {
    const [one, two] = await Promise.all([request(app).post('/api/auth/demo'), request(app).post('/api/auth/demo')]);
    expect(one.body.user._id).not.toBe(two.body.user._id);
    expect(one.body.user.email).not.toBe(two.body.user.email);

    const h1 = { Authorization: `Bearer ${one.body.token}` };
    const clientsOfTwo = (await request(app).get('/api/clients').set({ Authorization: `Bearer ${two.body.token}` })).body;
    const res = await request(app).get(`/api/clients/${clientsOfTwo[0]._id}`).set(h1);
    expect(res.status).toBe(404);

    // Every document of a demo workspace carries the TTL timestamp.
    const userId = one.body.user._id;
    for (const Model of [Client, Task, Invoice, Counter]) {
      const filter = Model === Counter ? { _id: `invoice:${userId}` } : { userId };
      const docs = await Model.find(filter).lean();
      expect(docs.length).toBeGreaterThan(0);
      expect(docs.every((d) => d.expiresAt instanceof Date)).toBe(true);
    }
  });

  test('invoice numbers in the demo workspace are sequential', async () => {
    const { body } = await request(app).post('/api/auth/demo');
    const list = await request(app).get('/api/invoices?sortBy=createdAt&limit=100').set({ Authorization: `Bearer ${body.token}` });
    const numbers = list.body.map((i) => i.number).sort();
    expect(numbers[0]).toBe('INV-0001');
    expect(numbers).toEqual(numbers.map((_, i) => `INV-${String(i + 1).padStart(4, '0')}`));
  });

  test('can be disabled by configuration', async () => {
    const res = await request(buildApp({ demoEnabled: false })).post('/api/auth/demo');
    expect(res.status).toBe(403);
    expect(res.body.msg).toMatch(/disabled/i);
  });

  test('uses the client’s local date so due dates line up with their calendar', async () => {
    const { today } = require('../helpers/factory');
    const res = await request(app).post('/api/auth/demo').set('X-Client-Today', today());
    const tasks = await request(app).get('/api/tasks?overdue=true').set({ Authorization: `Bearer ${res.body.token}` });
    expect(tasks.body.length).toBeGreaterThanOrEqual(1);
    tasks.body.forEach((t) => expect(t.dueDate.slice(0, 10) < rel(0)).toBe(true));
  });
});

describe('rate limiting', () => {
  const limited = (rateLimit) =>
    buildApp({ rateLimit: { enabled: true, windowMs: 60000, max: 1000, authMax: 3, demoMax: 2, ...rateLimit } });

  test('credential endpoints are throttled', async () => {
    const strict = limited();
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push((await request(strict).post('/api/auth/login').send({ email: 'x@y.co', password: 'nope' })).status);
    }
    expect(results.slice(0, 3)).toEqual([400, 400, 400]);
    expect(results.slice(3)).toEqual([429, 429]);
    const blocked = await request(strict).post('/api/auth/login').send({ email: 'x@y.co', password: 'nope' });
    expect(blocked.body.msg).toMatch(/too many attempts/i);
    expect(blocked.headers['ratelimit-limit']).toBe('3');
  });

  test('demo creation is throttled per hour', async () => {
    const strict = limited();
    expect((await request(strict).post('/api/auth/demo')).status).toBe(201);
    expect((await request(strict).post('/api/auth/demo')).status).toBe(201);
    const third = await request(strict).post('/api/auth/demo');
    expect(third.status).toBe(429);
    expect(third.body.msg).toMatch(/demo limit/i);
  });

  test('the general API limiter applies too', async () => {
    const strict = limited({ max: 2 });
    const { token } = await signup(buildApp());
    const h = { Authorization: `Bearer ${token}` };
    expect((await request(strict).get('/api/tasks').set(h)).status).toBe(200);
    expect((await request(strict).get('/api/tasks').set(h)).status).toBe(200);
    expect((await request(strict).get('/api/tasks').set(h)).status).toBe(429);
  });
});
