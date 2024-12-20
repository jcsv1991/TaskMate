const request = require('supertest');
const app = require('../server');

describe('Auth Routes', () => {
  test('POST /api/auth/login with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({email:'nonexistent@test.com', password:'wrongpass'});
    expect(response.statusCode).toBe(400);
  });
});
