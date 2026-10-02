const request = require('supertest');
const createApp = require('../../app');
const { toDateKey, addDays } = require('../../utils/dates');

const buildApp = (overrides = {}) => createApp(overrides);

let counter = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}${Date.now()}_${counter++}@example.com`;

/** Today and relative dates, as YYYY-MM-DD strings. */
const today = () => toDateKey(new Date());
const rel = (days) => addDays(today(), days);

async function signup(app, overrides = {}) {
  const email = overrides.email || uniqueEmail();
  const password = overrides.password || 'password123';
  const res = await request(app).post('/api/auth/signup').send({ email, password, ...overrides });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token = res.body.token;
  return { token, email: email.toLowerCase(), password, user: res.body.user, id: res.body.user._id, h: { Authorization: `Bearer ${token}` } };
}

/** Tiny API helper bound to a user so tests read like the requirement. */
function api(app, session) {
  const call = (method) => (url) => request(app)[method](url).set(session.h);
  return { get: call('get'), post: call('post'), put: call('put'), patch: call('patch'), delete: call('delete') };
}

async function createClient(a, body = {}) {
  const res = await a.post('/api/clients').send({ name: 'Acme Co', email: 'acme@example.com', phone: '555-0100', ...body });
  if (res.status !== 201) throw new Error(`createClient failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.client;
}

async function createTask(a, body = {}) {
  const res = await a.post('/api/tasks').send({ title: 'A task', ...body });
  if (res.status !== 201) throw new Error(`createTask failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function createInvoice(a, clientId, body = {}) {
  const res = await a.post('/api/invoices').send({ clientId, amount: 100, dueDate: rel(10), ...body });
  if (res.status !== 201) throw new Error(`createInvoice failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

module.exports = { buildApp, signup, api, createClient, createTask, createInvoice, uniqueEmail, today, rel, request };
