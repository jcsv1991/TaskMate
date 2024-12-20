const request = require('supertest');
const app = require('../server');

describe('Auth Routes', () => {
  test('POST /api/auth/signup with new email', async () => {
    const uniqueEmail = `testuser${Date.now()}@example.com`;
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ email: uniqueEmail, password: 'test1234' });
    expect(response.statusCode).toBe(200);
    expect(response.body.msg).toBe('User created successfully');
  });

  test('POST /api/auth/login with valid credentials', async () => {
    const uniqueEmail = `testuser${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/signup')
      .send({ email: uniqueEmail, password: 'test1234' });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail, password: 'test1234' });
    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.body.token).toBeDefined();
  });
});
