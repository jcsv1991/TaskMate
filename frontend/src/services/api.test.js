import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_KEY } from '../config';
import { fakeApi } from '../test/fakeApi';
import { server } from '../test/server';
import { localDateKey } from '../utils/format';
import { setUnauthorizedHandler } from './api';
import { auth, clients, downloadCsv, health, invoices, tasks } from './endpoints';

describe('request interceptor', () => {
  it('sends the bearer token when signed in', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    await auth.me();
    expect(fakeApi.lastCall('GET', '/auth/me').headers.authorization).toBe(`Bearer ${fakeApi.token}`);
  });

  it('sends no Authorization header when signed out', async () => {
    await health();
    expect(fakeApi.lastCall('GET', '/health').headers.authorization).toBeUndefined();
  });

  it('tells the server the viewer’s own calendar day', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    await auth.me();
    expect(fakeApi.lastCall('GET', '/auth/me').headers['x-client-today']).toBe(localDateKey());
  });
});

describe('401 handling', () => {
  const unauthorised = () => server.use(http.get('*/api/tasks', () => HttpResponse.json({ msg: 'Token is not valid' }, { status: 401 })));

  beforeEach(() => setUnauthorizedHandler(null));

  it('calls the handler when a signed-in request is rejected', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    window.localStorage.setItem(TOKEN_KEY, 'stale');
    unauthorised();
    await expect(tasks.list()).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not treat a wrong password as an expired session', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    window.localStorage.setItem(TOKEN_KEY, 'stale');
    server.use(http.post('*/api/auth/login', () => HttpResponse.json({ msg: 'Invalid credentials' }, { status: 401 })));
    await expect(auth.login({ email: 'a@b.co', password: 'x' })).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('stays quiet when there was no token to expire', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    unauthorised();
    await expect(tasks.list()).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not log out on other errors', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    server.use(http.get('*/api/tasks', () => HttpResponse.json({ msg: 'nope' }, { status: 500 })));
    await expect(tasks.list()).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('endpoints', () => {
  beforeEach(() => window.localStorage.setItem(TOKEN_KEY, fakeApi.token));

  it('turns paging headers into numbers', async () => {
    for (let i = 0; i < 5; i += 1) fakeApi.addTask({ title: `Task ${i}` });
    const res = await tasks.list({ limit: 2, page: 2 });
    expect(res.items).toHaveLength(2);
    expect(res).toMatchObject({ total: 5, page: 2, perPage: 2, totalPages: 3 });
    expect(res.totalAmount).toBeUndefined();
  });

  it('exposes the invoice total from X-Total-Amount', async () => {
    const c = fakeApi.addClient();
    fakeApi.addInvoice({ clientId: c._id, amount: 120.5 });
    fakeApi.addInvoice({ clientId: c._id, amount: 80 });
    expect((await invoices.list({})).totalAmount).toBe(200.5);
  });

  it('falls back sensibly when paging headers are missing', async () => {
    server.use(http.get('*/api/clients', () => HttpResponse.json([{ _id: 'x' }, { _id: 'y' }])));
    expect(await clients.list({})).toMatchObject({ total: 2, page: 1, perPage: 2, totalPages: 1 });
  });

  it('unwraps the client from create/update responses and passes cascade only when asked', async () => {
    const created = await clients.create({ name: 'Zed', email: 'zed@example.com' });
    expect(created).toMatchObject({ name: 'Zed' });
    const updated = await clients.update(created._id, { name: 'Zed Z' });
    expect(updated.name).toBe('Zed Z');
    await clients.remove(created._id);
    expect(fakeApi.lastCall('DELETE', `/clients/${created._id}`).search).toBe('');
    const other = fakeApi.addClient();
    await clients.remove(other._id, { cascade: true });
    expect(fakeApi.lastCall('DELETE', `/clients/${other._id}`).search).toBe('?cascade=true');
  });

  it('uses PATCH for partial updates', async () => {
    const t = fakeApi.addTask();
    await tasks.update(t._id, { completed: true });
    expect(fakeApi.lastCall('PATCH', `/tasks/${t._id}`).body).toEqual({ completed: true });
  });
});

describe('downloadCsv', () => {
  it('downloads through an authenticated request and uses the server’s filename', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const name = await downloadCsv('invoices');
    expect(name).toBe('taskmate-invoices-2026-10-02.csv');
    expect(fakeApi.lastCall('GET', '/export/invoices.csv').headers.authorization).toBe(`Bearer ${fakeApi.token}`);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull(); // the temporary link is cleaned up
  });

  it('falls back to a default filename', async () => {
    window.localStorage.setItem(TOKEN_KEY, fakeApi.token);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    server.use(http.get('*/api/export/tasks.csv', () => new HttpResponse('a,b', { headers: { 'Content-Type': 'text/csv' } })));
    expect(await downloadCsv('tasks')).toBe('taskmate-tasks.csv');
  });
});
