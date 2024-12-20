const request = require('supertest');
const app = require('../server');
let token;
let taskId;

beforeAll(async () => {
  const uniqueEmail = `testuser${Date.now()}@example.com`;
  await request(app)
    .post('/api/auth/signup')
    .send({ email: uniqueEmail, password: 'test1234' });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: uniqueEmail, password: 'test1234' });
  
  token = loginResponse.body.token;
});

describe('Tasks Routes', () => {
  test('POST /api/tasks - create a task', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('x-auth-token', token)
      .send({ title: 'Test Task', description: 'Test Description', dueDate: '2025-01-01' });
    expect(response.statusCode).toBe(201);
    taskId = response.body._id;
    expect(taskId).toBeDefined();
  });

  test('GET /api/tasks - fetch all tasks', async () => {
    const response = await request(app)
      .get('/api/tasks')
      .set('x-auth-token', token);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('PATCH /api/tasks/:id/completed - mark task completed', async () => {
    const response = await request(app)
      .patch(`/api/tasks/${taskId}/completed`)
      .set('x-auth-token', token);
    expect(response.statusCode).toBe(200);
    expect(response.body.completed).toBe(true);
  });
});
