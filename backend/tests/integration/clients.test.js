const { buildApp, signup, api, createClient, createTask, createInvoice, request, rel } = require('../helpers/factory');
const Task = require('../../models/Task');
const Invoice = require('../../models/Invoice');

const app = buildApp();
let A;
let B;

beforeEach(async () => {
  A = api(app, await signup(app));
  B = api(app, await signup(app));
});

describe('POST /api/clients', () => {
  test('creates a client owned by the caller', async () => {
    const res = await A.post('/api/clients').send({ name: '  Globex ', email: 'Billing@Globex.COM', phone: '555-1234', company: 'Globex Corp', notes: 'VIP' });
    expect(res.status).toBe(201);
    expect(res.body.msg).toBe('Client added successfully');
    expect(res.body.client).toMatchObject({ name: 'Globex', email: 'billing@globex.com', phone: '555-1234', company: 'Globex Corp', notes: 'VIP' });
    expect(res.body.client).not.toHaveProperty('userId');
  });

  test('phone, company and notes are optional', async () => {
    const res = await A.post('/api/clients').send({ name: 'Minimal', email: 'm@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.client.phone).toBe('');
  });

  test.each([
    ['no name', { email: 'a@b.co' }],
    ['blank name', { name: '   ', email: 'a@b.co' }],
    ['no email', { name: 'X' }],
    ['bad email', { name: 'X', email: 'nope' }],
    ['name too long', { name: 'x'.repeat(101), email: 'a@b.co' }],
    ['notes too long', { name: 'X', email: 'a@b.co', notes: 'n'.repeat(2001) }],
  ])('rejects %s', async (_label, body) => {
    const res = await A.post('/api/clients').send(body);
    expect(res.status).toBe(400);
  });

  test('cannot assign ownership through the body', async () => {
    const other = await signup(app);
    const res = await A.post('/api/clients').send({ name: 'Sneaky', email: 'a@b.co', userId: other.id });
    expect(res.status).toBe(201);
    const mine = await A.get('/api/clients');
    expect(mine.body.map((c) => c.name)).toContain('Sneaky');
    expect((await B.get('/api/clients')).body).toHaveLength(0);
  });
});

describe('GET /api/clients', () => {
  beforeEach(async () => {
    await createClient(A, { name: 'Alpha Studio', email: 'alpha@x.com', company: 'Alpha Inc' });
    await createClient(A, { name: 'Beta Labs', email: 'hello@beta.io', company: 'Beta' });
    await createClient(A, { name: 'Gamma (Ltd.)', email: 'gamma@x.com', company: 'Gamma' });
  });

  test('lists only my clients, alphabetically, with pagination headers', async () => {
    await createClient(B, { name: 'Not Mine' });
    const res = await A.get('/api/clients');
    expect(res.status).toBe(200);
    expect(res.body.map((c) => c.name)).toEqual(['Alpha Studio', 'Beta Labs', 'Gamma (Ltd.)']);
    expect(res.headers['x-total-count']).toBe('3');
    expect(res.headers['x-page']).toBe('1');
  });

  test('searches name, email and company, case-insensitively', async () => {
    expect((await A.get('/api/clients?search=alpha')).body).toHaveLength(1);
    expect((await A.get('/api/clients?search=BETA.IO')).body.map((c) => c.name)).toEqual(['Beta Labs']);
    expect((await A.get('/api/clients?search=Gamma')).body).toHaveLength(1);
    expect((await A.get('/api/clients?search=zzz')).body).toHaveLength(0);
  });

  test('search treats regex characters literally instead of crashing or over-matching', async () => {
    const paren = await A.get('/api/clients?search=' + encodeURIComponent('(Ltd.)'));
    expect(paren.status).toBe(200);
    expect(paren.body.map((c) => c.name)).toEqual(['Gamma (Ltd.)']);
    const wildcard = await A.get('/api/clients?search=' + encodeURIComponent('.*'));
    expect(wildcard.body).toHaveLength(0);
    const broken = await A.get('/api/clients?search=' + encodeURIComponent('[unclosed'));
    expect(broken.status).toBe(200);
  });

  test('sorts and paginates', async () => {
    const desc = await A.get('/api/clients?order=desc');
    expect(desc.body.map((c) => c.name)).toEqual(['Gamma (Ltd.)', 'Beta Labs', 'Alpha Studio']);
    const p2 = await A.get('/api/clients?limit=2&page=2');
    expect(p2.body.map((c) => c.name)).toEqual(['Gamma (Ltd.)']);
    expect(p2.headers['x-total-pages']).toBe('2');
    const byCreated = await A.get('/api/clients?sortBy=createdAt&order=desc');
    expect(byCreated.body[0].name).toBe('Gamma (Ltd.)');
  });

  test('rejects bad paging params', async () => {
    expect((await A.get('/api/clients?limit=101')).status).toBe(400);
    expect((await A.get('/api/clients?page=0')).status).toBe(400);
    expect((await A.get('/api/clients?page=abc')).status).toBe(400);
    expect((await A.get('/api/clients?sortBy=password')).status).toBe(400);
  });

  test('operator injection through the query string is rejected', async () => {
    const res = await request(app).get('/api/clients?search[$ne]=x').set((await signup(app)).h);
    expect(res.status).toBe(400);
  });

  test('each client carries summary stats', async () => {
    const [alpha] = (await A.get('/api/clients?search=alpha')).body;
    await createTask(A, { title: 'Open one', clientId: alpha._id });
    const done = await createTask(A, { title: 'Done one', clientId: alpha._id });
    await A.patch(`/api/tasks/${done._id}/completed`);
    await createInvoice(A, alpha._id, { amount: 250, dueDate: rel(5) });
    await createInvoice(A, alpha._id, { amount: 100, dueDate: rel(-5) });
    const paid = await createInvoice(A, alpha._id, { amount: 40 });
    await A.put(`/api/invoices/${paid._id}`).send({ status: 'paid' });

    const res = await A.get('/api/clients?search=alpha');
    expect(res.body[0].stats).toEqual({ openTasks: 1, invoiceCount: 3, outstandingAmount: 350, overdueAmount: 100, paidAmount: 40 });
  });

  test('stats are zero for a brand new client', async () => {
    const res = await A.get('/api/clients?search=beta');
    expect(res.body[0].stats).toEqual({ openTasks: 0, invoiceCount: 0, outstandingAmount: 0, overdueAmount: 0, paidAmount: 0 });
  });
});

describe('GET /api/clients/:id', () => {
  test('returns the client with its tasks, invoices and stats', async () => {
    const client = await createClient(A);
    await createTask(A, { title: 'Linked', clientId: client._id });
    await createTask(A, { title: 'Unlinked' });
    await createInvoice(A, client._id, { amount: 500 });

    const res = await A.get(`/api/clients/${client._id}`);
    expect(res.status).toBe(200);
    expect(res.body.client._id).toBe(client._id);
    expect(res.body.tasks.map((t) => t.title)).toEqual(['Linked']);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0]).toMatchObject({ amount: 500, effectiveStatus: 'unpaid' });
    expect(res.body.stats.outstandingAmount).toBe(500);
  });

  test('404 for unknown ids, 400 for malformed ones', async () => {
    expect((await A.get('/api/clients/507f1f77bcf86cd799439011')).status).toBe(404);
    const bad = await A.get('/api/clients/not-an-id');
    expect(bad.status).toBe(400);
    expect(bad.body.msg).toBe('Invalid id');
  });

  test('another user cannot read it (404, not 403, so ids are not revealed)', async () => {
    const client = await createClient(A);
    expect((await B.get(`/api/clients/${client._id}`)).status).toBe(404);
  });
});

describe('PUT/PATCH /api/clients/:id', () => {
  test('partially updates fields', async () => {
    const client = await createClient(A, { name: 'Old', phone: '111' });
    const res = await A.put(`/api/clients/${client._id}`).send({ phone: '222' });
    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({ name: 'Old', phone: '222' });
    const patched = await A.patch(`/api/clients/${client._id}`).send({ name: 'New', notes: 'hello' });
    expect(patched.body.client).toMatchObject({ name: 'New', notes: 'hello', phone: '222' });
  });

  test('can clear optional fields', async () => {
    const client = await createClient(A, { phone: '111' });
    const res = await A.put(`/api/clients/${client._id}`).send({ phone: '' });
    expect(res.body.client.phone).toBe('');
  });

  test('validates input and rejects empty updates', async () => {
    const client = await createClient(A);
    expect((await A.put(`/api/clients/${client._id}`).send({ email: 'bad' })).status).toBe(400);
    expect((await A.put(`/api/clients/${client._id}`).send({})).status).toBe(400);
    expect((await A.put(`/api/clients/${client._id}`).send({ name: '' })).status).toBe(400);
  });

  test('404 for unknown; other users cannot update (and the data is untouched)', async () => {
    const client = await createClient(A, { name: 'Mine' });
    expect((await A.put('/api/clients/507f1f77bcf86cd799439011').send({ name: 'x' })).status).toBe(404);
    expect((await B.put(`/api/clients/${client._id}`).send({ name: 'Hacked' })).status).toBe(404);
    expect((await A.get(`/api/clients/${client._id}`)).body.client.name).toBe('Mine');
  });
});

describe('DELETE /api/clients/:id', () => {
  test('deletes a client with no invoices and unlinks its tasks', async () => {
    const client = await createClient(A);
    const task = await createTask(A, { clientId: client._id });

    const res = await A.delete(`/api/clients/${client._id}`);
    expect(res.status).toBe(200);
    expect((await A.get(`/api/clients/${client._id}`)).status).toBe(404);
    const after = await A.get(`/api/tasks/${task._id}`);
    expect(after.body.clientId).toBeNull();
    expect(after.body.client).toBeNull();
  });

  test('refuses to silently destroy invoices: 409 with the count', async () => {
    const client = await createClient(A);
    await createInvoice(A, client._id);
    await createInvoice(A, client._id);

    const res = await A.delete(`/api/clients/${client._id}`);
    expect(res.status).toBe(409);
    expect(res.body.details).toEqual({ invoiceCount: 2 });
    expect(res.body.msg).toMatch(/2 invoices/);
    expect((await A.get(`/api/clients/${client._id}`)).status).toBe(200);
  });

  test('singular wording for one invoice', async () => {
    const client = await createClient(A);
    await createInvoice(A, client._id);
    expect((await A.delete(`/api/clients/${client._id}`)).body.msg).toMatch(/1 invoice\./);
  });

  test('?cascade=true deletes the invoices as well and unlinks tasks', async () => {
    const client = await createClient(A);
    const keeper = await createClient(A, { name: 'Keeper' });
    await createInvoice(A, client._id);
    await createInvoice(A, keeper._id);
    const task = await createTask(A, { clientId: client._id });

    const res = await A.delete(`/api/clients/${client._id}?cascade=true`);
    expect(res.status).toBe(200);
    expect(await Invoice.countDocuments({ clientId: client._id })).toBe(0);
    expect(await Invoice.countDocuments({ clientId: keeper._id })).toBe(1);
    expect((await Task.findById(task._id).lean()).clientId).toBeNull();
  });

  test('another user cannot delete it; unknown ids 404; bad cascade value 400', async () => {
    const client = await createClient(A);
    expect((await B.delete(`/api/clients/${client._id}?cascade=true`)).status).toBe(404);
    expect((await A.get(`/api/clients/${client._id}`)).status).toBe(200);
    expect((await A.delete('/api/clients/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await A.delete(`/api/clients/${client._id}?cascade=maybe`)).status).toBe(400);
  });
});
