import { http, HttpResponse } from 'msw';
import { localDateKey } from '../utils/format';

/**
 * A small in-memory stand-in for the TaskMate API, served through MSW.
 *
 * It follows the real contract (arrays + paging headers, `{ msg, errors }`
 * errors, 409 on deleting a client that still has invoices) closely enough that
 * the pages can be exercised end to end without mocking their own modules.
 */

const DAY = 24 * 60 * 60 * 1000;
export const VALID_EMAIL = 'ada@example.com';
export const VALID_PASSWORD = 'correct-horse-1';

/** ISO string (UTC midnight) for `n` days from the user's today. */
export const daysFromToday = (n) => {
  const [y, m, d] = localDateKey().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString();
};

const json = (body, init) => HttpResponse.json(body, init);
const fail = (status, msg, extra = {}) => json({ msg, ...extra }, { status });

export function createFakeApi() {
  let db;
  let calls;
  let failures;

  const reset = () => {
    db = { seq: 0, token: 'test-token', user: { _id: 'u1', email: VALID_EMAIL, name: 'Ada Lovelace', isDemo: false }, clients: [], tasks: [], invoices: [] };
    calls = [];
    failures = new Map();
  };
  reset();

  const id = (prefix) => `${prefix}${++db.seq}`;

  // ---- seeding helpers used by tests ------------------------------------
  const addClient = (data = {}) => {
    const client = { _id: id('c'), name: 'Acme Co', email: 'hello@acme.test', phone: '', company: '', notes: '', createdAt: new Date().toISOString(), ...data };
    db.clients.push(client);
    return client;
  };
  const addTask = (data = {}) => {
    const task = { _id: id('t'), title: 'A task', description: '', priority: 'medium', completed: false, completedAt: null, dueDate: null, clientId: null, createdAt: new Date().toISOString(), ...data };
    db.tasks.push(task);
    return task;
  };
  const addInvoice = (data = {}) => {
    const number = `INV-${String(db.invoices.length + 1).padStart(4, '0')}`;
    const invoice = { _id: id('i'), number, amount: 100, status: 'unpaid', dueDate: daysFromToday(14), description: '', paidAt: null, clientId: null, createdAt: new Date().toISOString(), ...data };
    db.invoices.push(invoice);
    return invoice;
  };

  // ---- shared logic -----------------------------------------------------
  const todayKey = (request) => request.headers.get('x-client-today') || localDateKey();
  const dayKey = (iso) => iso.slice(0, 10);
  const clientRef = (clientId) => {
    const c = db.clients.find((x) => x._id === clientId);
    return c ? { _id: c._id, name: c.name, email: c.email, company: c.company } : null;
  };
  const taskOut = (t, today) => ({ ...t, client: clientRef(t.clientId), overdue: !t.completed && !!t.dueDate && dayKey(t.dueDate) < today });
  const effective = (inv, today) => (inv.status === 'paid' ? 'paid' : dayKey(inv.dueDate) < today ? 'overdue' : 'unpaid');
  const invoiceOut = (inv, today) => ({ ...inv, client: clientRef(inv.clientId), effectiveStatus: effective(inv, today), overdue: effective(inv, today) === 'overdue' });

  const stats = (clientId, today) => {
    const ts = db.tasks.filter((t) => t.clientId === clientId);
    const is = db.invoices.filter((i) => i.clientId === clientId);
    const sum = (list) => Math.round(list.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    return {
      openTasks: ts.filter((t) => !t.completed).length,
      invoiceCount: is.length,
      outstandingAmount: sum(is.filter((i) => effective(i, today) !== 'paid')),
      overdueAmount: sum(is.filter((i) => effective(i, today) === 'overdue')),
      paidAmount: sum(is.filter((i) => i.status === 'paid')),
    };
  };

  const paged = (items, url, extraHeaders = {}) => {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Number(url.searchParams.get('limit')) || 20;
    const slice = items.slice((page - 1) * limit, page * limit);
    return json(slice, {
      headers: {
        'X-Total-Count': String(items.length),
        'X-Page': String(page),
        'X-Per-Page': String(limit),
        'X-Total-Pages': String(Math.max(1, Math.ceil(items.length / limit))),
        ...extraHeaders,
      },
    });
  };

  const cmp = (key, order) => (a, b) => {
    const av = a[key];
    const bv = b[key];
    // Missing values always sort last, like the real API.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const r = av < bv ? -1 : av > bv ? 1 : 0;
    return order === 'desc' ? -r : r;
  };

  /** Every request passes through here: records the call, enforces auth and injected failures. */
  const guard = (handler, { auth = true } = {}) => async (info) => {
    const { request } = info;
    const url = new URL(request.url);
    const body = ['POST', 'PATCH', 'PUT'].includes(request.method) ? await request.clone().json().catch(() => ({})) : undefined;
    calls.push({ method: request.method, path: url.pathname.replace(/^.*\/api/, ''), search: url.search, body, headers: Object.fromEntries(request.headers) });

    const key = `${request.method} ${url.pathname.replace(/^.*\/api/, '')}`;
    const injected = failures.get(key);
    if (injected) {
      if (injected.times !== undefined && --injected.times <= 0) failures.delete(key);
      return injected.network ? HttpResponse.error() : fail(injected.status, injected.msg, injected.extra);
    }
    if (auth && request.headers.get('authorization') !== `Bearer ${db.token}`) return fail(401, 'No token, authorization denied');
    return handler({ ...info, url, body, today: todayKey(request) });
  };

  const handlers = [
    http.get('*/api/health', guard(() => json({ status: 'ok' }), { auth: false })),

    // ---- auth
    http.post(
      '*/api/auth/login',
      guard(({ body }) => {
        if (body.email === db.user.email && body.password === VALID_PASSWORD) return json({ token: db.token, user: db.user });
        return fail(400, 'Invalid credentials');
      }, { auth: false })
    ),
    http.post(
      '*/api/auth/signup',
      guard(({ body }) => {
        if (body.email === db.user.email) return fail(409, 'An account with that email already exists');
        if (!body.password || body.password.length < 8) return fail(400, 'Validation failed', { errors: [{ path: 'password', message: 'Password must be at least 8 characters' }] });
        db.user = { _id: 'u2', email: body.email, name: body.name || '', isDemo: false };
        return json({ msg: 'User created successfully', token: db.token, user: db.user }, { status: 201 });
      }, { auth: false })
    ),
    http.post(
      '*/api/auth/demo',
      guard(() => {
        db.user = { _id: 'demo', email: 'demo@taskmate.invalid', name: 'Demo User', isDemo: true };
        addClient({ name: 'Northwind Studio', email: 'hello@northwind.test' });
        addTask({ title: 'Send revised mockups', dueDate: daysFromToday(1), clientId: db.clients[0]._id });
        return json({ token: db.token, user: db.user, demo: true }, { status: 201 });
      }, { auth: false })
    ),
    http.get('*/api/auth/me', guard(() => json({ user: db.user }))),
    http.delete('*/api/auth/me', guard(() => json({ msg: 'Account and all data deleted' }))),

    // ---- dashboard
    http.get(
      '*/api/dashboard/summary',
      guard(({ today }) => {
        const open = db.tasks.filter((t) => !t.completed);
        const week = dayKey(daysFromToday(7));
        const due = (t) => (t.dueDate ? dayKey(t.dueDate) : null);
        const unpaid = db.invoices.filter((i) => effective(i, today) !== 'paid');
        const overdue = db.invoices.filter((i) => effective(i, today) === 'overdue');
        const total = (list) => list.reduce((s, i) => s + i.amount, 0);
        const paid = db.invoices.filter((i) => i.status === 'paid');
        const month = today.slice(0, 7);
        return json({
          today,
          tasks: {
            total: db.tasks.length,
            open: open.length,
            completed: db.tasks.length - open.length,
            overdue: open.filter((t) => due(t) && due(t) < today).length,
            dueToday: open.filter((t) => due(t) === today).length,
            dueThisWeek: open.filter((t) => due(t) && due(t) >= today && due(t) <= week).length,
          },
          clients: { total: db.clients.length },
          invoices: {
            total: db.invoices.length,
            outstandingAmount: total(unpaid),
            overdueAmount: total(overdue),
            overdueCount: overdue.length,
            paidAmount: total(paid),
            paidThisMonth: total(paid.filter((i) => (i.paidAt || i.dueDate).slice(0, 7) === month)),
          },
          revenueByMonth: [{ month: month, paid: total(paid), outstanding: total(unpaid) }],
          focusTasks: open
            .filter((t) => due(t) && due(t) <= week)
            .sort(cmp('dueDate', 'asc'))
            .map((t) => ({ _id: t._id, title: t.title, dueDate: t.dueDate, priority: t.priority, overdue: due(t) < today, clientName: (clientRef(t.clientId) || {}).name || null })),
          overdueInvoices: overdue.map((i) => ({
            _id: i._id,
            number: i.number,
            amount: i.amount,
            dueDate: i.dueDate,
            clientName: (clientRef(i.clientId) || {}).name || 'Unknown client',
            daysOverdue: Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayKey(i.dueDate)}T00:00:00Z`)) / DAY),
          })),
          topClients: db.clients.map((c) => {
            const mine = db.invoices.filter((i) => i.clientId === c._id);
            return { clientId: c._id, name: c.name, billed: total(mine), outstanding: total(mine.filter((i) => effective(i, today) !== 'paid')) };
          }).filter((c) => c.billed > 0).sort((a, b) => b.billed - a.billed),
        });
      })
    ),

    // ---- tasks
    http.get(
      '*/api/tasks',
      guard(({ url, today }) => {
        const q = url.searchParams;
        let list = [...db.tasks];
        if (q.get('completed')) list = list.filter((t) => String(t.completed) === q.get('completed'));
        if (q.get('priority')) list = list.filter((t) => t.priority === q.get('priority'));
        if (q.get('clientId')) list = list.filter((t) => t.clientId === q.get('clientId'));
        if (q.get('search')) {
          const s = q.get('search').toLowerCase();
          list = list.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(s));
        }
        list.sort(cmp(q.get('sortBy') || 'dueDate', q.get('order') || 'asc'));
        return paged(list.map((t) => taskOut(t, today)), url);
      })
    ),
    http.get('*/api/tasks/:id', guard(({ params, today }) => {
      const t = db.tasks.find((x) => x._id === params.id);
      return t ? json(taskOut(t, today)) : fail(404, 'Task not found');
    })),
    http.post('*/api/tasks', guard(({ body, today }) => {
      if (!body.title) return fail(400, 'Validation failed', { errors: [{ path: 'title', message: 'Title is required' }] });
      const t = addTask({ title: body.title, description: body.description || '', priority: body.priority || 'medium', dueDate: body.dueDate ? `${body.dueDate}T00:00:00.000Z` : null, clientId: body.clientId || null });
      return json(taskOut(t, today), { status: 201 });
    })),
    http.patch('*/api/tasks/:id', guard(({ params, body, today }) => {
      const t = db.tasks.find((x) => x._id === params.id);
      if (!t) return fail(404, 'Task not found');
      const { dueDate, ...rest } = body;
      Object.assign(t, rest);
      if (dueDate !== undefined) t.dueDate = dueDate ? `${dueDate}T00:00:00.000Z` : null;
      if (body.completed !== undefined) t.completedAt = body.completed ? new Date().toISOString() : null;
      return json(taskOut(t, today));
    })),
    http.delete('*/api/tasks/:id', guard(({ params }) => {
      const i = db.tasks.findIndex((x) => x._id === params.id);
      if (i < 0) return fail(404, 'Task not found');
      db.tasks.splice(i, 1);
      return json({ msg: 'Task deleted successfully' });
    })),

    // ---- clients
    http.get('*/api/clients', guard(({ url, today }) => {
      const q = url.searchParams;
      let list = [...db.clients];
      if (q.get('search')) {
        const s = q.get('search').toLowerCase();
        list = list.filter((c) => `${c.name} ${c.email} ${c.company}`.toLowerCase().includes(s));
      }
      list.sort(cmp(q.get('sortBy') || 'name', q.get('order') || 'asc'));
      return paged(list.map((c) => ({ ...c, stats: stats(c._id, today) })), url);
    })),
    http.get('*/api/clients/:id', guard(({ params, today }) => {
      const client = db.clients.find((x) => x._id === params.id);
      if (!client) return fail(404, 'Client not found');
      return json({
        client,
        tasks: db.tasks.filter((t) => t.clientId === client._id).map((t) => taskOut(t, today)),
        invoices: db.invoices.filter((i) => i.clientId === client._id).map((i) => invoiceOut(i, today)),
        stats: stats(client._id, today),
      });
    })),
    http.post('*/api/clients', guard(({ body }) => {
      const errors = [];
      if (!body.name) errors.push({ path: 'name', message: 'Name is required' });
      if (String(body.email).endsWith('@blocked.test')) errors.push({ path: 'email', message: 'This email domain is not accepted' });
      if (errors.length) return fail(400, 'Validation failed', { errors });
      return json({ msg: 'Client added successfully', client: addClient(body) }, { status: 201 });
    })),
    http.patch('*/api/clients/:id', guard(({ params, body }) => {
      const c = db.clients.find((x) => x._id === params.id);
      if (!c) return fail(404, 'Client not found');
      Object.assign(c, body);
      return json({ msg: 'Client updated successfully', client: c });
    })),
    http.delete('*/api/clients/:id', guard(({ params, url }) => {
      const c = db.clients.find((x) => x._id === params.id);
      if (!c) return fail(404, 'Client not found');
      const count = db.invoices.filter((i) => i.clientId === c._id).length;
      const cascade = url.searchParams.get('cascade') === 'true';
      if (count > 0 && !cascade) return fail(409, `This client has ${count} invoices.`, { details: { invoiceCount: count } });
      if (cascade) db.invoices = db.invoices.filter((i) => i.clientId !== c._id);
      db.tasks.forEach((t) => { if (t.clientId === c._id) t.clientId = null; });
      db.clients = db.clients.filter((x) => x._id !== c._id);
      return json({ msg: 'Client deleted successfully' });
    })),

    // ---- invoices
    http.get('*/api/invoices', guard(({ url, today }) => {
      const q = url.searchParams;
      let list = db.invoices.map((i) => invoiceOut(i, today));
      const status = q.get('status');
      if (status === 'outstanding') list = list.filter((i) => i.effectiveStatus !== 'paid');
      else if (status) list = list.filter((i) => i.effectiveStatus === status);
      if (q.get('clientId')) list = list.filter((i) => i.clientId === q.get('clientId'));
      if (q.get('search')) {
        const s = q.get('search').toLowerCase();
        list = list.filter((i) => `${i.number} ${i.description} ${(i.client || {}).name || ''}`.toLowerCase().includes(s));
      }
      list.sort(cmp(q.get('sortBy') || 'createdAt', q.get('order') || 'desc'));
      const totalAmount = Math.round(list.reduce((s, i) => s + i.amount, 0) * 100) / 100;
      return paged(list, url, { 'X-Total-Amount': String(totalAmount) });
    })),
    http.get('*/api/invoices/:id', guard(({ params, today }) => {
      const i = db.invoices.find((x) => x._id === params.id);
      return i ? json(invoiceOut(i, today)) : fail(404, 'Invoice not found');
    })),
    http.post('*/api/invoices', guard(({ body, today }) => {
      const errors = [];
      if (!(body.amount > 0)) errors.push({ path: 'amount', message: 'Amount must be greater than 0' });
      if (!db.clients.some((c) => c._id === body.clientId)) errors.push({ path: 'clientId', message: 'Client not found' });
      if (errors.length) return fail(400, 'Validation failed', { errors });
      const inv = addInvoice({ clientId: body.clientId, amount: body.amount, dueDate: `${body.dueDate}T00:00:00.000Z`, description: body.description || '' });
      return json(invoiceOut(inv, today), { status: 201 });
    })),
    http.patch('*/api/invoices/:id', guard(({ params, body, today }) => {
      const inv = db.invoices.find((x) => x._id === params.id);
      if (!inv) return fail(404, 'Invoice not found');
      const { dueDate, ...rest } = body;
      Object.assign(inv, rest);
      if (dueDate) inv.dueDate = `${dueDate}T00:00:00.000Z`;
      if (body.status) inv.paidAt = body.status === 'paid' ? new Date().toISOString() : null;
      return json(invoiceOut(inv, today));
    })),
    http.delete('*/api/invoices/:id', guard(({ params }) => {
      const i = db.invoices.findIndex((x) => x._id === params.id);
      if (i < 0) return fail(404, 'Invoice not found');
      db.invoices.splice(i, 1);
      return json({ msg: 'Invoice deleted successfully' });
    })),

    // ---- csv export
    http.get('*/api/export/:file', guard(() => new HttpResponse('Number,Client\r\nINV-0001,Acme\r\n', { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="taskmate-invoices-2026-10-02.csv"' } }))),
  ];

  return {
    handlers,
    reset,
    get db() {
      return db;
    },
    get token() {
      return db.token;
    },
    get calls() {
      return calls;
    },
    callsTo: (method, path) => calls.filter((c) => c.method === method && c.path === path),
    lastCall: (method, path) => calls.filter((c) => c.method === method && c.path === path).at(-1),
    addClient,
    addTask,
    addInvoice,
    /** Make `METHOD /path` fail: `{ status, msg }` for an HTTP error or `{ network: true }`; `times` limits how often. */
    failNext: (method, path, failure) => failures.set(`${method} ${path}`, { status: 500, msg: 'Server exploded', ...failure }),
  };
}

export const fakeApi = createFakeApi();
