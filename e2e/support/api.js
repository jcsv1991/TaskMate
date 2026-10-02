const { expect } = require('@playwright/test');

const API = `http://127.0.0.1:${process.env.E2E_API_PORT || '5055'}/api`;
const DAY = 24 * 60 * 60 * 1000;

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter += 1)}${Math.random().toString(36).slice(2, 6)}`;

// The browser under test runs in this zone (see playwright.config.js), which may be a different
// calendar day from the machine running the tests. All "today" maths must use it.
const TIMEZONE = 'America/Vancouver';

/** A calendar date `n` days from today in the browser's time zone, as YYYY-MM-DD. */
const dateIn = (n) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
};

/** Create a throw-away account through the API and return a small client for seeding it. */
async function createUser(request, { name = 'Test User' } = {}) {
  const email = `e2e-${unique()}@example.com`;
  const password = 'e2e-password-123';
  const res = await request.post(`${API}/auth/signup`, { data: { email, password, name } });
  expect(res.status(), await res.text()).toBe(201);
  const { token, user } = await res.json();
  const headers = { Authorization: `Bearer ${token}` };

  const send = async (method, path, data) => {
    const r = await request.fetch(`${API}${path}`, { method, headers, data });
    expect(r.ok(), `${method} ${path} -> ${r.status()} ${await r.text()}`).toBeTruthy();
    return r.json();
  };

  return {
    email,
    password,
    token,
    user,
    headers,
    api: {
      client: async (data = {}) => (await send('POST', '/clients', { name: `Client ${unique()}`, email: `c-${unique()}@example.com`, ...data })).client,
      // The API ignores `completed` on create (mass-assignment protection), so completing is a second call.
      task: async (data = {}) => {
        const { completed, ...rest } = data;
        const task = await send('POST', '/tasks', { title: `Task ${unique()}`, ...rest });
        return completed ? send('PATCH', `/tasks/${task._id}`, { completed: true }) : task;
      },
      invoice: (data) => send('POST', '/invoices', data),
      get: (path) => send('GET', path),
    },
  };
}

/** Make the browser start signed in as this user. */
async function signIn(page, user) {
  await page.addInitScript((token) => window.localStorage.setItem('taskmate_token', token), user.token);
}

module.exports = { API, TIMEZONE, createUser, signIn, dateIn, unique };
