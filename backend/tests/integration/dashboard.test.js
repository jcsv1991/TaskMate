const { buildApp, signup, api, createClient, createTask, createInvoice, request, rel, today } = require('../helpers/factory');
const Invoice = require('../../models/Invoice');
const { addDays } = require('../../utils/dates');

const app = buildApp();
let A;
let B;
let sessionA;

beforeEach(async () => {
  sessionA = await signup(app);
  A = api(app, sessionA);
  B = api(app, await signup(app));
});

const summary = async (a = A) => (await a.get('/api/dashboard/summary')).body;

describe('GET /api/dashboard/summary', () => {
  test('requires authentication', async () => {
    expect((await request(app).get('/api/dashboard/summary')).status).toBe(401);
  });

  test('a new workspace is all zeros, never NaN or null where a number is expected', async () => {
    const s = await summary();
    expect(s.today).toBe(today());
    expect(s.tasks).toEqual({ total: 0, open: 0, completed: 0, overdue: 0, dueToday: 0, dueThisWeek: 0, completionRate: null });
    expect(s.clients).toEqual({ total: 0 });
    expect(s.invoices).toEqual({ total: 0, outstandingAmount: 0, overdueAmount: 0, overdueCount: 0, paidAmount: 0, paidThisMonth: 0 });
    expect(s.revenueByMonth).toHaveLength(6);
    s.revenueByMonth.forEach((m) => expect(m).toMatchObject({ paid: 0, outstanding: 0 }));
    expect(s.focusTasks).toEqual([]);
    expect(s.overdueInvoices).toEqual([]);
    expect(s.topClients).toEqual([]);
  });

  test('task counters', async () => {
    await createTask(A, { title: 'overdue', dueDate: rel(-2) });
    await createTask(A, { title: 'today', dueDate: rel(0) });
    await createTask(A, { title: 'in 7 days', dueDate: rel(7) });
    await createTask(A, { title: 'in 8 days', dueDate: rel(8) });
    await createTask(A, { title: 'undated' });
    const done = await createTask(A, { title: 'done', dueDate: rel(-9) });
    await A.patch(`/api/tasks/${done._id}/completed`);
    await createTask(B, { title: 'not mine', dueDate: rel(-1) });

    const { tasks } = await summary();
    expect(tasks).toEqual({ total: 6, open: 5, completed: 1, overdue: 1, dueToday: 1, dueThisWeek: 2, completionRate: 0.17 });
  });

  test('focus list: open tasks due within a week, overdue first, with client names', async () => {
    const client = await createClient(A, { name: 'Initech' });
    await createTask(A, { title: 'later', dueDate: rel(5), priority: 'low' });
    await createTask(A, { title: 'late one', dueDate: rel(-4), priority: 'high', clientId: client._id });
    await createTask(A, { title: 'far away', dueDate: rel(30) });
    await createTask(A, { title: 'no date' });
    const finished = await createTask(A, { title: 'finished', dueDate: rel(1) });
    await A.patch(`/api/tasks/${finished._id}/completed`);

    const { focusTasks } = await summary();
    expect(focusTasks.map((t) => t.title)).toEqual(['late one', 'later']);
    expect(focusTasks[0]).toMatchObject({ overdue: true, priority: 'high', clientName: 'Initech' });
    expect(focusTasks[1]).toMatchObject({ overdue: false, clientName: null });
  });

  test('focus list is capped at 8', async () => {
    for (let i = 0; i < 12; i += 1) await createTask(A, { title: `t${i}`, dueDate: rel(i % 7) });
    expect((await summary()).focusTasks).toHaveLength(8);
  });

  test('invoice money maths', async () => {
    const c = await createClient(A, { name: 'Acme' });
    await createInvoice(A, c._id, { amount: 1000, dueDate: rel(10) }); // outstanding
    await createInvoice(A, c._id, { amount: 500.5, dueDate: rel(-3) }); // overdue
    await createInvoice(A, c._id, { amount: 250, dueDate: rel(-40) }); // overdue (old)
    const paid = await createInvoice(A, c._id, { amount: 800, dueDate: rel(-1) });
    await A.put(`/api/invoices/${paid._id}`).send({ status: 'paid' });

    const { invoices } = await summary();
    expect(invoices).toEqual({
      total: 4,
      outstandingAmount: 1750.5,
      overdueAmount: 750.5,
      overdueCount: 2,
      paidAmount: 800,
      paidThisMonth: 800,
    });
  });

  test('overdue invoices list: oldest first, with days overdue and client name', async () => {
    const c = await createClient(A, { name: 'Slow Payer' });
    await createInvoice(A, c._id, { amount: 10, dueDate: rel(-3) });
    await createInvoice(A, c._id, { amount: 20, dueDate: rel(-40) });
    await createInvoice(A, c._id, { amount: 30, dueDate: rel(4) });
    const { overdueInvoices } = await summary();
    expect(overdueInvoices.map((i) => [i.amount, i.daysOverdue, i.clientName])).toEqual([
      [20, 40, 'Slow Payer'],
      [10, 3, 'Slow Payer'],
    ]);
    expect(overdueInvoices[0].number).toMatch(/^INV-\d{4}$/);
  });

  test('revenue by month covers six months and buckets paid money by when it was paid', async () => {
    const c = await createClient(A);
    const inv = await createInvoice(A, c._id, { amount: 300, dueDate: rel(-75) });
    // Paid two months ago.
    await Invoice.updateOne({ _id: inv._id }, { status: 'paid', paidAt: new Date(`${addDays(today(), -62)}T00:00:00Z`) });
    const { revenueByMonth } = await summary();

    expect(revenueByMonth).toHaveLength(6);
    expect(revenueByMonth[5].month).toBe(today().slice(0, 7));
    const months = revenueByMonth.map((m) => m.month);
    expect(new Set(months).size).toBe(6);
    expect([...months].sort()).toEqual(months);
    const paidMonth = addDays(today(), -62).slice(0, 7);
    expect(revenueByMonth.find((m) => m.month === paidMonth).paid).toBe(300);
    expect(revenueByMonth.reduce((sum, m) => sum + m.paid, 0)).toBe(300);
  });

  test('invoices paid before paidAt existed fall back to their due date', async () => {
    const c = await createClient(A);
    const inv = await createInvoice(A, c._id, { amount: 120, dueDate: rel(-35) });
    await Invoice.updateOne({ _id: inv._id }, { status: 'paid', paidAt: null });
    const { revenueByMonth, invoices } = await summary();
    expect(revenueByMonth.find((m) => m.month === addDays(today(), -35).slice(0, 7)).paid).toBe(120);
    expect(invoices.paidAmount).toBe(120);
  });

  test('unpaid money is shown in the month it falls due', async () => {
    const c = await createClient(A);
    await createInvoice(A, c._id, { amount: 90, dueDate: rel(0) });
    const { revenueByMonth } = await summary();
    expect(revenueByMonth[5].outstanding).toBe(90);
  });

  test('top clients ranked by amount billed', async () => {
    const big = await createClient(A, { name: 'Big' });
    const small = await createClient(A, { name: 'Small' });
    await createInvoice(A, big._id, { amount: 900 });
    await createInvoice(A, big._id, { amount: 100, dueDate: rel(-1) });
    await createInvoice(A, small._id, { amount: 50 });
    const paid = await createInvoice(A, small._id, { amount: 400 });
    await A.put(`/api/invoices/${paid._id}`).send({ status: 'paid' });

    const { topClients } = await summary();
    expect(topClients.map((c) => [c.name, c.billed, c.outstanding])).toEqual([
      ['Big', 1000, 1000],
      ['Small', 450, 50],
    ]);
  });

  test('top clients are limited to five', async () => {
    for (let i = 0; i < 7; i += 1) {
      const c = await createClient(A, { name: `Client ${i}` });
      await createInvoice(A, c._id, { amount: 100 + i });
    }
    const { topClients } = await summary();
    expect(topClients).toHaveLength(5);
    expect(topClients[0].name).toBe('Client 6');
  });

  test('never includes another user’s data', async () => {
    const bc = await createClient(B, { name: 'B only' });
    await createInvoice(B, bc._id, { amount: 5000, dueDate: rel(-9) });
    await createTask(B, { dueDate: rel(-1) });
    const s = await summary();
    expect(s.clients.total).toBe(0);
    expect(s.invoices.total).toBe(0);
    expect(s.tasks.total).toBe(0);
    const theirs = await summary(B);
    expect(theirs.invoices.overdueAmount).toBe(5000);
  });

  test('overdue maths follows the client’s calendar day', async () => {
    const c = await createClient(A);
    await createTask(A, { title: 'due today', dueDate: rel(0) });
    await createInvoice(A, c._id, { amount: 70, dueDate: rel(0) });
    const server = await summary();
    expect(server.tasks.overdue).toBe(0);
    expect(server.invoices.overdueCount).toBe(0);

    // For a user whose local date is already "tomorrow" (e.g. ahead of UTC), the same data is overdue.
    const ahead = await request(app).get('/api/dashboard/summary').set(sessionA.h).set('X-Client-Today', rel(1));
    expect(ahead.body.today).toBe(rel(1));
    expect(ahead.body.tasks.overdue).toBe(1);
    expect(ahead.body.invoices).toMatchObject({ overdueCount: 1, overdueAmount: 70 });
  });

  test('ignores an implausible X-Client-Today header', async () => {
    const res = await request(app).get('/api/dashboard/summary').set(sessionA.h).set('X-Client-Today', '1999-01-01');
    expect(res.body.today).toBe(today());
  });
});
