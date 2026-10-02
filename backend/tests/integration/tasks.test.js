const { buildApp, signup, api, createClient, createTask, request, rel } = require('../helpers/factory');
const Task = require('../../models/Task');

const app = buildApp();
let A;
let B;
let sessionA;

beforeEach(async () => {
  sessionA = await signup(app);
  A = api(app, sessionA);
  B = api(app, await signup(app));
});

const titles = (res) => res.body.map((t) => t.title);

describe('POST /api/tasks', () => {
  test('creates a task with sensible defaults', async () => {
    const res = await A.post('/api/tasks').send({ title: '  Write proposal ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write proposal', description: '', completed: false, completedAt: null, priority: 'medium', dueDate: null, clientId: null, client: null, overdue: false });
    expect(res.body).not.toHaveProperty('userId');
  });

  test('stores due dates as calendar dates (midnight UTC), whatever the input format', async () => {
    const date = await A.post('/api/tasks').send({ title: 'a', dueDate: '2026-12-24' });
    expect(date.body.dueDate).toBe('2026-12-24T00:00:00.000Z');
    const iso = await A.post('/api/tasks').send({ title: 'b', dueDate: '2026-12-24T23:59:00-08:00' });
    expect(iso.body.dueDate).toBe('2026-12-24T00:00:00.000Z');
  });

  test('links to one of my clients and returns its name', async () => {
    const client = await createClient(A, { name: 'Initech' });
    const res = await A.post('/api/tasks').send({ title: 'TPS report', clientId: client._id, priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(client._id);
    expect(res.body.client).toMatchObject({ _id: client._id, name: 'Initech' });
    expect(res.body.priority).toBe('high');
  });

  test('refuses to link to somebody else’s client', async () => {
    const theirs = await createClient(B, { name: 'Theirs' });
    const res = await A.post('/api/tasks').send({ title: 'x', clientId: theirs._id });
    expect(res.status).toBe(400);
    expect(res.body.msg).toBe('Client not found');
  });

  test('empty clientId / dueDate from an HTML form mean "none"', async () => {
    const res = await A.post('/api/tasks').send({ title: 'x', clientId: '', dueDate: '' });
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBeNull();
    expect(res.body.dueDate).toBeNull();
  });

  test.each([
    ['missing title', {}],
    ['blank title', { title: '  ' }],
    ['title too long', { title: 'x'.repeat(121) }],
    ['impossible date', { title: 'x', dueDate: '2026-02-31' }],
    ['garbage date', { title: 'x', dueDate: 'next friday' }],
    ['unknown priority', { title: 'x', priority: 'asap' }],
    ['malformed client id', { title: 'x', clientId: '123' }],
    ['description too long', { title: 'x', description: 'd'.repeat(2001) }],
    ['non-string title', { title: { $gt: '' } }],
  ])('rejects %s', async (_label, body) => {
    const res = await A.post('/api/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.msg).toEqual(expect.any(String));
  });

  test('mass assignment: userId, completed and _id in the body are ignored', async () => {
    const res = await A.post('/api/tasks').send({ title: 'x', userId: sessionA.id.replace(/.$/, '0'), completed: true, completedAt: '2020-01-01', _id: '507f1f77bcf86cd799439011' });
    expect(res.status).toBe(201);
    expect(res.body.completed).toBe(false);
    expect(res.body._id).not.toBe('507f1f77bcf86cd799439011');
    const stored = await Task.findById(res.body._id).lean();
    expect(String(stored.userId)).toBe(sessionA.id);
  });

  test('malformed JSON gives a clean 400', async () => {
    const res = await request(app).post('/api/tasks').set(sessionA.h).set('Content-Type', 'application/json').send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/not valid JSON/i);
  });
});

describe('GET /api/tasks filtering', () => {
  let acme;
  beforeEach(async () => {
    acme = await createClient(A, { name: 'Acme Corp' });
    const globex = await createClient(A, { name: 'Globex' });
    await createTask(A, { title: 'Overdue high', dueDate: rel(-3), priority: 'high', clientId: acme._id });
    await createTask(A, { title: 'Due today', dueDate: rel(0), priority: 'medium', description: 'Call about the invoice' });
    await createTask(A, { title: 'Next week', dueDate: rel(7), priority: 'low', clientId: globex._id });
    await createTask(A, { title: 'Someday' });
    const done = await createTask(A, { title: 'Finished', dueDate: rel(-10), priority: 'low', clientId: acme._id });
    await A.patch(`/api/tasks/${done._id}/completed`);
    await createTask(B, { title: 'Belongs to B' });
  });

  test('returns only my tasks', async () => {
    const res = await A.get('/api/tasks');
    expect(res.body).toHaveLength(5);
    expect(titles(res)).not.toContain('Belongs to B');
  });

  test('completed=true|false', async () => {
    expect(titles(await A.get('/api/tasks?completed=true'))).toEqual(['Finished']);
    expect(titles(await A.get('/api/tasks?completed=false'))).toHaveLength(4);
    expect(titles(await A.get('/api/tasks?completed='))).toHaveLength(5); // blank = no filter
  });

  test('priority', async () => {
    expect(titles(await A.get('/api/tasks?priority=high'))).toEqual(['Overdue high']);
    expect((await A.get('/api/tasks?priority=urgent')).status).toBe(400);
  });

  test('by client id and by client name (original filter)', async () => {
    expect(titles(await A.get(`/api/tasks?clientId=${acme._id}`)).sort()).toEqual(['Finished', 'Overdue high']);
    expect(titles(await A.get('/api/tasks?clientName=glob'))).toEqual(['Next week']);
    expect(await A.get('/api/tasks?clientName=nobody')).toHaveProperty('body', []);
  });

  test('free-text search across title and description, literal not regex', async () => {
    expect(titles(await A.get('/api/tasks?search=today'))).toEqual(['Due today']);
    expect(titles(await A.get('/api/tasks?search=INVOICE'))).toEqual(['Due today']);
    expect((await A.get('/api/tasks?search=' + encodeURIComponent('.*'))).body).toHaveLength(0);
    expect((await A.get('/api/tasks?search=' + encodeURIComponent('('))).status).toBe(200);
  });

  test('overdue=true means open tasks due before today', async () => {
    const res = await A.get('/api/tasks?overdue=true');
    expect(titles(res)).toEqual(['Overdue high']);
    expect(res.body[0].overdue).toBe(true);
  });

  test('"overdue" flag on every task agrees with the dates', async () => {
    const res = await A.get('/api/tasks');
    const byTitle = Object.fromEntries(res.body.map((t) => [t.title, t.overdue]));
    expect(byTitle).toEqual({ 'Overdue high': true, 'Due today': false, 'Next week': false, Someday: false, Finished: false });
  });

  test('dueAfter / dueBefore are inclusive and combine', async () => {
    expect(titles(await A.get(`/api/tasks?dueAfter=${rel(0)}&dueBefore=${rel(7)}`))).toEqual(['Due today', 'Next week']);
    expect(titles(await A.get(`/api/tasks?dueBefore=${rel(-3)}`))).toEqual(['Finished', 'Overdue high']);
    // a date range can never match tasks that have no due date
    expect(titles(await A.get(`/api/tasks?dueAfter=${rel(-100)}`))).not.toContain('Someday');
  });

  test('"today" follows the client’s calendar (X-Client-Today), not the server’s UTC clock', async () => {
    const tomorrowForClient = rel(1);
    const res = await request(app).get('/api/tasks?overdue=true').set(sessionA.h).set('X-Client-Today', tomorrowForClient);
    expect(titles(res).sort()).toEqual(['Due today', 'Overdue high']);
  });

  test('default order is due date ascending with undated tasks last', async () => {
    expect(titles(await A.get('/api/tasks'))).toEqual(['Finished', 'Overdue high', 'Due today', 'Next week', 'Someday']);
  });

  test('descending due date also keeps undated tasks last', async () => {
    expect(titles(await A.get('/api/tasks?sortBy=dueDate&order=desc'))).toEqual(['Next week', 'Due today', 'Overdue high', 'Finished', 'Someday']);
  });

  test('sort by title', async () => {
    expect(titles(await A.get('/api/tasks?sortBy=title&order=asc'))).toEqual(['Due today', 'Finished', 'Next week', 'Overdue high', 'Someday']);
    expect(titles(await A.get('/api/tasks?sortBy=title&order=desc'))[0]).toBe('Someday');
  });

  test('pagination walks dated and undated tasks without gaps or repeats', async () => {
    const seen = [];
    for (let page = 1; page <= 3; page += 1) {
      const res = await A.get(`/api/tasks?limit=2&page=${page}`);
      expect(res.headers['x-total-count']).toBe('5');
      expect(res.headers['x-total-pages']).toBe('3');
      seen.push(...titles(res));
    }
    expect(seen).toEqual(['Finished', 'Overdue high', 'Due today', 'Next week', 'Someday']);
    expect((await A.get('/api/tasks?limit=2&page=4')).body).toEqual([]);
  });

  test('pagination also works for the other sort fields', async () => {
    const p1 = titles(await A.get('/api/tasks?sortBy=title&limit=3&page=1'));
    const p2 = titles(await A.get('/api/tasks?sortBy=title&limit=3&page=2'));
    expect([...p1, ...p2]).toEqual(['Due today', 'Finished', 'Next week', 'Overdue high', 'Someday']);
  });

  test('operator injection via query string is rejected', async () => {
    expect((await request(app).get('/api/tasks?completed[$ne]=true').set(sessionA.h)).status).toBe(400);
    expect((await request(app).get('/api/tasks?clientId[$ne]=x').set(sessionA.h)).status).toBe(400);
  });

  test('a single page only contains undated tasks when the dated ones are exhausted', async () => {
    await Task.deleteMany({ userId: sessionA.id, dueDate: { $ne: null } });
    const res = await A.get('/api/tasks?limit=5');
    expect(titles(res)).toEqual(['Someday']);
    expect(res.headers['x-total-count']).toBe('1');
  });
});

describe('GET /api/tasks/:id', () => {
  test('returns a task, 404 for strangers and unknown ids, 400 for malformed ids', async () => {
    const task = await createTask(A);
    expect((await A.get(`/api/tasks/${task._id}`)).body.title).toBe('A task');
    expect((await B.get(`/api/tasks/${task._id}`)).status).toBe(404);
    expect((await A.get('/api/tasks/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await A.get('/api/tasks/xyz')).status).toBe(400);
  });
});

describe('updating tasks', () => {
  test('PUT accepts partial bodies, like the original client sent', async () => {
    const task = await createTask(A, { title: 'Keep me', description: 'desc', priority: 'high' });
    const res = await A.put(`/api/tasks/${task._id}`).send({ completed: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Keep me', description: 'desc', priority: 'high', completed: true });
  });

  test('completing stamps completedAt once; reopening clears it', async () => {
    const task = await createTask(A);
    const done = await A.patch(`/api/tasks/${task._id}`).send({ completed: true });
    expect(done.body.completedAt).toEqual(expect.any(String));
    const again = await A.patch(`/api/tasks/${task._id}`).send({ completed: true });
    expect(again.body.completedAt).toBe(done.body.completedAt);
    const reopened = await A.patch(`/api/tasks/${task._id}`).send({ completed: false });
    expect(reopened.body).toMatchObject({ completed: false, completedAt: null });
  });

  test('PATCH /:id/completed (original endpoint) marks done and is idempotent', async () => {
    const task = await createTask(A);
    const one = await A.patch(`/api/tasks/${task._id}/completed`);
    expect(one.status).toBe(200);
    expect(one.body.completed).toBe(true);
    const two = await A.patch(`/api/tasks/${task._id}/completed`);
    expect(two.body.completedAt).toBe(one.body.completedAt);
    expect((await B.patch(`/api/tasks/${task._id}/completed`)).status).toBe(404);
    expect((await A.patch('/api/tasks/507f1f77bcf86cd799439011/completed')).status).toBe(404);
  });

  test('can edit every field, relink and unlink a client, and clear the due date', async () => {
    const c1 = await createClient(A, { name: 'One' });
    const task = await createTask(A, { title: 'T', dueDate: rel(3), clientId: c1._id });
    const res = await A.put(`/api/tasks/${task._id}`).send({ title: 'Renamed', description: 'new', priority: 'low', dueDate: '', clientId: '' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Renamed', description: 'new', priority: 'low', dueDate: null, clientId: null, client: null });
  });

  test('validation and ownership', async () => {
    const task = await createTask(A);
    const theirs = await createClient(B);
    expect((await A.put(`/api/tasks/${task._id}`).send({})).status).toBe(400);
    expect((await A.put(`/api/tasks/${task._id}`).send({ title: '' })).status).toBe(400);
    expect((await A.put(`/api/tasks/${task._id}`).send({ completed: 'yes' })).status).toBe(400);
    expect((await A.put(`/api/tasks/${task._id}`).send({ clientId: theirs._id })).status).toBe(400);
    expect((await B.put(`/api/tasks/${task._id}`).send({ title: 'Hacked' })).status).toBe(404);
    expect((await A.get(`/api/tasks/${task._id}`)).body.title).toBe('A task');
    expect((await A.put('/api/tasks/507f1f77bcf86cd799439011').send({ title: 'x' })).status).toBe(404);
  });

  test('cannot reassign a task to another user through the body', async () => {
    const task = await createTask(A);
    await A.put(`/api/tasks/${task._id}`).send({ title: 'still mine', userId: (await signup(app)).id });
    expect(String((await Task.findById(task._id).lean()).userId)).toBe(sessionA.id);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('deletes my task; strangers and unknown ids get 404', async () => {
    const task = await createTask(A);
    expect((await B.delete(`/api/tasks/${task._id}`)).status).toBe(404);
    expect(await Task.countDocuments({ _id: task._id })).toBe(1);
    const res = await A.delete(`/api/tasks/${task._id}`);
    expect(res.status).toBe(200);
    expect(res.body.msg).toBe('Task deleted successfully');
    expect(await Task.countDocuments({ _id: task._id })).toBe(0);
    expect((await A.delete(`/api/tasks/${task._id}`)).status).toBe(404);
  });
});
