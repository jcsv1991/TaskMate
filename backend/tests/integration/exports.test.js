const { buildApp, signup, api, createClient, createTask, createInvoice, request, rel } = require('../helpers/factory');

const app = buildApp();
let A;
let sessionA;

beforeEach(async () => {
  sessionA = await signup(app);
  A = api(app, sessionA);
});

const csvLines = (text) => text.replace(/^\uFEFF/, '').trim().split('\r\n');

describe('CSV export', () => {
  test('requires authentication and rejects unknown resources', async () => {
    expect((await request(app).get('/api/export/invoices.csv')).status).toBe(401);
    expect((await A.get('/api/export/passwords.csv')).status).toBe(404);
    expect((await A.get('/api/export/__proto__')).status).toBe(404);
    expect((await A.get('/api/export/constructor')).status).toBe(404);
  });

  test('invoices.csv: attachment headers, BOM, header row and effective status', async () => {
    const acme = await createClient(A, { name: 'Acme' });
    const open = await createInvoice(A, acme._id, { amount: 1234.5, dueDate: rel(9), description: 'Design, build' });
    await createInvoice(A, acme._id, { amount: 99, dueDate: rel(-9) });
    const paid = await createInvoice(A, acme._id, { amount: 10, dueDate: rel(-1) });
    await A.put(`/api/invoices/${paid._id}`).send({ status: 'paid' });

    const res = await A.get('/api/export/invoices.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="taskmate-invoices-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.text.charCodeAt(0)).toBe(0xfeff);

    const lines = csvLines(res.text);
    expect(lines[0]).toBe('Number,Client,Description,Amount,Due date,Status,Paid on');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(`${open.number},Acme,"Design, build",1234.50,${rel(9)},unpaid,`);
    expect(lines[2]).toContain(',overdue,');
    expect(lines[3]).toMatch(new RegExp(`,paid,\\d{4}-\\d{2}-\\d{2}$`));
  });

  test('works with the .csv extension or without', async () => {
    expect((await A.get('/api/export/clients')).status).toBe(200);
    expect((await A.get('/api/export/clients.csv')).status).toBe(200);
    expect((await A.get('/api/export/clients.CSV')).status).toBe(200);
  });

  test('tasks.csv', async () => {
    const c = await createClient(A, { name: 'Initech' });
    await createTask(A, { title: 'Ship it', description: 'now', priority: 'high', dueDate: rel(2), clientId: c._id });
    const done = await createTask(A, { title: 'Done already' });
    await A.patch(`/api/tasks/${done._id}/completed`);
    const lines = csvLines((await A.get('/api/export/tasks.csv')).text);
    expect(lines[0]).toBe('Title,Description,Client,Priority,Due date,Status,Completed on');
    expect(lines[1]).toBe(`Ship it,now,Initech,high,${rel(2)},open,`);
    expect(lines[2]).toMatch(/^Done already,,,medium,,completed,\d{4}-\d{2}-\d{2}$/);
  });

  test('clients.csv', async () => {
    await createClient(A, { name: 'Zed', email: 'z@x.com', company: 'Zed Inc', phone: '1' });
    await createClient(A, { name: 'Abe', email: 'a@x.com' });
    const lines = csvLines((await A.get('/api/export/clients.csv')).text);
    expect(lines[0]).toBe('Name,Company,Email,Phone,Notes');
    expect(lines[1].startsWith('Abe,')).toBe(true); // sorted by name
    expect(lines[2]).toBe('Zed,Zed Inc,z@x.com,1,');
  });

  test('neutralises spreadsheet formula injection from user-controlled text', async () => {
    const evil = await createClient(A, { name: '=HYPERLINK("http://evil.example","click")', email: 'e@x.com', notes: '+cmd|calc' });
    await createInvoice(A, evil._id, { description: '@SUM(1+1)' });
    const clients = (await A.get('/api/export/clients.csv')).text;
    expect(clients).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(clients).toContain("'+cmd|calc");
    const invoices = (await A.get('/api/export/invoices.csv')).text;
    expect(invoices).toContain("'@SUM(1+1)");
    // no cell may begin with a formula trigger
    for (const line of csvLines(invoices).slice(1)) {
      expect(line.split(',').every((cell) => !/^[=+@]/.test(cell))).toBe(true);
    }
  });

  test('exports only my data', async () => {
    const other = api(app, await signup(app));
    await createClient(other, { name: 'Secret Client' });
    expect((await A.get('/api/export/clients.csv')).text).not.toContain('Secret Client');
  });

  test('an empty workspace still yields a valid file with just the header', async () => {
    const lines = csvLines((await A.get('/api/export/invoices.csv')).text);
    expect(lines).toEqual(['Number,Client,Description,Amount,Due date,Status,Paid on']);
  });
});
