const { buildApp, signup, api, createClient, createInvoice, request, rel } = require('../helpers/factory');
const Invoice = require('../../models/Invoice');

const app = buildApp();
let A;
let B;
let sessionA;
let client;

beforeEach(async () => {
  sessionA = await signup(app);
  A = api(app, sessionA);
  B = api(app, await signup(app));
  client = await createClient(A, { name: 'Acme Corp' });
});

const numbers = (res) => res.body.map((i) => i.number);

describe('POST /api/invoices', () => {
  test('creates an invoice with a number, client and effective status', async () => {
    const res = await A.post('/api/invoices').send({ clientId: client._id, amount: 1250.5, dueDate: rel(14), description: 'Website build' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      number: 'INV-0001',
      amount: 1250.5,
      status: 'unpaid',
      effectiveStatus: 'unpaid',
      overdue: false,
      paidAt: null,
      description: 'Website build',
      clientId: client._id,
    });
    expect(res.body.client).toMatchObject({ _id: client._id, name: 'Acme Corp' });
    expect(res.body).not.toHaveProperty('userId');
  });

  test('numbers are sequential per user and independent between users', async () => {
    const one = await createInvoice(A, client._id);
    const two = await createInvoice(A, client._id);
    const bClient = await createClient(B);
    const bOne = await createInvoice(B, bClient._id);
    expect([one.number, two.number, bOne.number]).toEqual(['INV-0001', 'INV-0002', 'INV-0001']);
  });

  test('numbers are never reused after a deletion', async () => {
    const one = await createInvoice(A, client._id);
    await A.delete(`/api/invoices/${one._id}`);
    const next = await createInvoice(A, client._id);
    expect(next.number).toBe('INV-0002');
  });

  // FerretDB (used for quick local runs without a real mongod) does not make
  // findAndModify atomic, so this one is skipped there: MONGO_TEST_SKIP_CONCURRENCY=1
  const concurrency = process.env.MONGO_TEST_SKIP_CONCURRENCY ? test.skip : test;
  concurrency('concurrent creation still produces unique numbers', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => A.post('/api/invoices').send({ clientId: client._id, amount: 10, dueDate: rel(5) })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const nums = results.map((r) => r.body.number);
    expect(new Set(nums).size).toBe(8);
  });

  test('amounts are rounded to cents', async () => {
    const res = await A.post('/api/invoices').send({ clientId: client._id, amount: 19.999, dueDate: rel(5) });
    expect(res.body.amount).toBe(20);
  });

  test('an invoice created with a past due date is overdue straight away', async () => {
    const res = await A.post('/api/invoices').send({ clientId: client._id, amount: 50, dueDate: rel(-2) });
    expect(res.body).toMatchObject({ status: 'unpaid', effectiveStatus: 'overdue', overdue: true });
  });

  test('refuses someone else’s client and unknown clients', async () => {
    const theirs = await createClient(B);
    const res = await A.post('/api/invoices').send({ clientId: theirs._id, amount: 10, dueDate: rel(1) });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Client not found');
    expect((await A.post('/api/invoices').send({ clientId: '507f1f77bcf86cd799439011', amount: 10, dueDate: rel(1) })).status).toBe(400);
  });

  test.each([
    ['no client', { amount: 10, dueDate: '2026-01-01' }],
    ['malformed client', { clientId: 'x', amount: 10, dueDate: '2026-01-01' }],
    ['no amount', { dueDate: '2026-01-01' }],
    ['zero amount', { amount: 0, dueDate: '2026-01-01' }],
    ['negative amount', { amount: -10, dueDate: '2026-01-01' }],
    ['string amount', { amount: '10', dueDate: '2026-01-01' }],
    ['absurd amount', { amount: 1e12, dueDate: '2026-01-01' }],
    ['no due date', { amount: 10 }],
    ['bad due date', { amount: 10, dueDate: '2026-02-30' }],
    ['description too long', { amount: 10, dueDate: '2026-01-01', description: 'x'.repeat(501) }],
  ])('rejects %s', async (_label, body) => {
    const res = await A.post('/api/invoices').send({ clientId: client._id, ...body, ...(body.clientId === undefined && _label.startsWith('no client') ? { clientId: undefined } : {}) });
    expect(res.status).toBe(400);
  });

  test('status cannot be forced on creation', async () => {
    const res = await A.post('/api/invoices').send({ clientId: client._id, amount: 5, dueDate: rel(3), status: 'paid', number: 'HACK-1' });
    expect(res.body.status).toBe('unpaid');
    expect(res.body.number).toBe('INV-0001');
  });
});

describe('GET /api/invoices', () => {
  let other;
  beforeEach(async () => {
    other = await createClient(A, { name: 'Globex' });
    await createInvoice(A, client._id, { amount: 100, dueDate: rel(10), description: 'Logo design' }); // INV-0001 unpaid
    await createInvoice(A, client._id, { amount: 250, dueDate: rel(-5), description: 'Hosting' }); // INV-0002 overdue
    const paid = await createInvoice(A, other._id, { amount: 400, dueDate: rel(-20), description: 'SEO audit' }); // INV-0003
    await A.put(`/api/invoices/${paid._id}`).send({ status: 'paid' });
    await createInvoice(A, other._id, { amount: 75.25, dueDate: rel(0), description: 'Due today' }); // INV-0004 unpaid (not late yet)
    const bClient = await createClient(B);
    await createInvoice(B, bClient._id, { amount: 9999 });
  });

  test('lists only my invoices, newest first by default, with client details', async () => {
    const res = await A.get('/api/invoices');
    expect(res.status).toBe(200);
    expect(numbers(res)).toEqual(['INV-0004', 'INV-0003', 'INV-0002', 'INV-0001']);
    expect(res.body[0].client).toMatchObject({ name: 'Globex' });
    expect(res.headers['x-total-count']).toBe('4');
  });

  test('reports the total amount of everything that matches the filter, not just the page', async () => {
    expect((await A.get('/api/invoices')).headers['x-total-amount']).toBe('825.25');
    const page = await A.get('/api/invoices?limit=1');
    expect(page.body).toHaveLength(1);
    expect(page.headers['x-total-amount']).toBe('825.25');
    expect((await A.get('/api/invoices?status=paid')).headers['x-total-amount']).toBe('400');
    expect((await A.get('/api/invoices?status=overdue')).headers['x-total-amount']).toBe('250');
    expect((await A.get('/api/invoices?search=nothing-matches')).headers['x-total-amount']).toBe('0');
  });

  test('effective status filters', async () => {
    expect(numbers(await A.get('/api/invoices?status=paid'))).toEqual(['INV-0003']);
    expect(numbers(await A.get('/api/invoices?status=overdue'))).toEqual(['INV-0002']);
    expect(numbers(await A.get('/api/invoices?status=unpaid')).sort()).toEqual(['INV-0001', 'INV-0004']);
    // "outstanding" is unpaid + overdue, i.e. everything that is not paid yet.
    expect(numbers(await A.get('/api/invoices?status=outstanding')).sort()).toEqual(['INV-0001', 'INV-0002', 'INV-0004']);
    expect((await A.get('/api/invoices?status=outstanding')).headers['x-total-amount']).toBe('425.25');
    expect((await A.get('/api/invoices?status=archived')).status).toBe(400);
    expect(numbers(await A.get('/api/invoices?status='))).toHaveLength(4);
  });

  test('"overdue" does not depend on the stored status flag', async () => {
    const stored = await Invoice.findOne({ number: 'INV-0002', userId: sessionA.id }).lean();
    expect(stored.status).toBe('unpaid'); // nobody flipped it...
    const res = await A.get('/api/invoices?status=overdue'); // ...yet it is reported overdue
    expect(res.body[0]).toMatchObject({ number: 'INV-0002', status: 'unpaid', effectiveStatus: 'overdue' });
  });

  test('a manually stored "overdue" invoice with a future due date is reported as unpaid', async () => {
    const inv = await createInvoice(A, client._id, { dueDate: rel(30) });
    await Invoice.updateOne({ _id: inv._id }, { status: 'overdue' });
    const res = await A.get(`/api/invoices/${inv._id}`);
    expect(res.body.effectiveStatus).toBe('unpaid');
    expect(numbers(await A.get('/api/invoices?status=overdue'))).not.toContain(inv.number);
  });

  test('client filters: id and name', async () => {
    expect(numbers(await A.get(`/api/invoices?clientId=${other._id}`)).sort()).toEqual(['INV-0003', 'INV-0004']);
    expect(numbers(await A.get('/api/invoices?clientName=acme')).sort()).toEqual(['INV-0001', 'INV-0002']);
    expect((await A.get('/api/invoices?clientName=nobody')).body).toEqual([]);
  });

  test('search matches number, description and client name, literally', async () => {
    expect(numbers(await A.get('/api/invoices?search=inv-0002'))).toEqual(['INV-0002']);
    expect(numbers(await A.get('/api/invoices?search=seo'))).toEqual(['INV-0003']);
    expect(numbers(await A.get('/api/invoices?search=globex')).sort()).toEqual(['INV-0003', 'INV-0004']);
    expect((await A.get('/api/invoices?search=' + encodeURIComponent('.*'))).body).toEqual([]);
    expect((await A.get('/api/invoices?search=' + encodeURIComponent('(['))).status).toBe(200);
  });

  test('sorting by due date and amount, both directions', async () => {
    expect(numbers(await A.get('/api/invoices?sortBy=dueDate&order=asc'))).toEqual(['INV-0003', 'INV-0002', 'INV-0004', 'INV-0001']);
    expect(numbers(await A.get('/api/invoices?sortBy=dueDate&order=desc'))).toEqual(['INV-0001', 'INV-0004', 'INV-0002', 'INV-0003']);
    expect(numbers(await A.get('/api/invoices?sortBy=amount&order=desc'))).toEqual(['INV-0003', 'INV-0002', 'INV-0001', 'INV-0004']);
    expect((await A.get('/api/invoices?sortBy=userId')).status).toBe(400);
  });

  test('pagination', async () => {
    const p1 = await A.get('/api/invoices?sortBy=dueDate&limit=3&page=1');
    const p2 = await A.get('/api/invoices?sortBy=dueDate&limit=3&page=2');
    expect(numbers(p1)).toEqual(['INV-0003', 'INV-0002', 'INV-0004']);
    expect(numbers(p2)).toEqual(['INV-0001']);
    expect(p2.headers['x-total-pages']).toBe('2');
  });

  test('operator injection is rejected', async () => {
    expect((await request(app).get('/api/invoices?status[$ne]=paid').set(sessionA.h)).status).toBe(400);
  });
});

describe('GET /api/invoices/:id', () => {
  test('returns one invoice (the old client downloaded the whole list to find one)', async () => {
    const inv = await createInvoice(A, client._id, { amount: 321 });
    const res = await A.get(`/api/invoices/${inv._id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ _id: inv._id, amount: 321, client: { name: 'Acme Corp' } });
  });

  test('404 for strangers and unknown, 400 for malformed', async () => {
    const inv = await createInvoice(A, client._id);
    expect((await B.get(`/api/invoices/${inv._id}`)).status).toBe(404);
    expect((await A.get('/api/invoices/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await A.get('/api/invoices/abc')).status).toBe(400);
  });
});

describe('updating invoices', () => {
  test('marking paid stamps paidAt; reverting clears it', async () => {
    const inv = await createInvoice(A, client._id, { dueDate: rel(-10) });
    expect(inv.effectiveStatus).toBe('overdue');

    const paid = await A.put(`/api/invoices/${inv._id}`).send({ status: 'paid' });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ status: 'paid', effectiveStatus: 'paid', overdue: false });
    expect(new Date(paid.body.paidAt).getTime()).toBeGreaterThan(Date.now() - 5000);

    const again = await A.patch(`/api/invoices/${inv._id}`).send({ status: 'paid' });
    expect(again.body.paidAt).toBe(paid.body.paidAt); // not re-stamped

    const reverted = await A.put(`/api/invoices/${inv._id}`).send({ status: 'unpaid' });
    expect(reverted.body).toMatchObject({ status: 'unpaid', paidAt: null, effectiveStatus: 'overdue' });
  });

  test('partial updates leave other fields alone', async () => {
    const inv = await createInvoice(A, client._id, { amount: 100, description: 'keep' });
    const res = await A.put(`/api/invoices/${inv._id}`).send({ amount: 175.5 });
    expect(res.body).toMatchObject({ amount: 175.5, description: 'keep', number: inv.number });
  });

  test('can move an invoice to another of my clients, not to a stranger’s', async () => {
    const inv = await createInvoice(A, client._id);
    const other = await createClient(A, { name: 'Other' });
    const moved = await A.put(`/api/invoices/${inv._id}`).send({ clientId: other._id });
    expect(moved.body.client.name).toBe('Other');
    const theirs = await createClient(B);
    expect((await A.put(`/api/invoices/${inv._id}`).send({ clientId: theirs._id })).status).toBe(400);
  });

  test('can change the due date', async () => {
    const inv = await createInvoice(A, client._id, { dueDate: rel(-3) });
    const res = await A.put(`/api/invoices/${inv._id}`).send({ dueDate: rel(10) });
    expect(res.body.effectiveStatus).toBe('unpaid');
  });

  test('validation and ownership', async () => {
    const inv = await createInvoice(A, client._id);
    expect((await A.put(`/api/invoices/${inv._id}`).send({})).status).toBe(400);
    expect((await A.put(`/api/invoices/${inv._id}`).send({ amount: -1 })).status).toBe(400);
    expect((await A.put(`/api/invoices/${inv._id}`).send({ status: 'void' })).status).toBe(400);
    expect((await B.put(`/api/invoices/${inv._id}`).send({ status: 'paid' })).status).toBe(404);
    expect((await A.get(`/api/invoices/${inv._id}`)).body.status).toBe('unpaid');
    expect((await A.put('/api/invoices/507f1f77bcf86cd799439011').send({ amount: 5 })).status).toBe(404);
  });

  test('number and owner cannot be changed through the body', async () => {
    const inv = await createInvoice(A, client._id);
    const stranger = await signup(app);
    await A.put(`/api/invoices/${inv._id}`).send({ amount: 5, number: 'INV-9999', userId: stranger.id });
    const stored = await Invoice.findById(inv._id).lean();
    expect(stored.number).toBe(inv.number);
    expect(String(stored.userId)).toBe(sessionA.id);
  });
});

describe('DELETE /api/invoices/:id', () => {
  test('deletes my invoice and keeps both response keys the old client could read', async () => {
    const inv = await createInvoice(A, client._id);
    expect((await B.delete(`/api/invoices/${inv._id}`)).status).toBe(404);
    const res = await A.delete(`/api/invoices/${inv._id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Invoice deleted successfully', msg: 'Invoice deleted successfully' });
    expect((await A.delete(`/api/invoices/${inv._id}`)).status).toBe(404);
  });
});
