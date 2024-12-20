const request = require('supertest');
const app = require('../server');
let token;

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

describe('Clients Routes', () => {
  let clientId;

  test('POST /api/clients - create a client', async () => {
    const response = await request(app)
      .post('/api/clients')
      .set('x-auth-token', token)
      .send({ name: 'Test Client', email: 'client@example.com', phone: '1234567890' });
    expect(response.statusCode).toBe(201);
    expect(response.body.client._id).toBeDefined();
    clientId = response.body.client._id;
  });

  test('GET /api/clients - fetch all clients', async () => {
    const response = await request(app)
      .get('/api/clients')
      .set('x-auth-token', token);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('PUT /api/clients/:id - update a client', async () => {
    const response = await request(app)
      .put(`/api/clients/${clientId}`)
      .set('x-auth-token', token)
      .send({ phone: '0987654321' });
    expect(response.statusCode).toBe(200);
    expect(response.body.client.phone).toBe('0987654321');
  });

  test('DELETE /api/clients/:id - delete a client', async () => {
    const response = await request(app)
      .delete(`/api/clients/${clientId}`)
      .set('x-auth-token', token);
    expect(response.statusCode).toBe(200);
  });
});
