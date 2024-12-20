const request = require('supertest');
const app = require('../server');
let token;
let clientId;
let invoiceId;

beforeAll(async () => {
  const uniqueEmail = `testuser${Date.now()}@example.com`;
  await request(app)
    .post('/api/auth/signup')
    .send({ email: uniqueEmail, password: 'test1234' });

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: uniqueEmail, password: 'test1234' });

  token = loginResponse.body.token;

  const clientResponse = await request(app)
    .post('/api/clients')
    .set('x-auth-token', token)
    .send({ name: 'Invoice Client', email: 'invoice@example.com', phone: '1112223333' });

  clientId = clientResponse.body.client._id;
});

describe('Invoices Routes', () => {
  test('POST /api/invoices - create an invoice', async () => {
    const response = await request(app)
      .post('/api/invoices')
      .set('x-auth-token', token)
      .send({ clientId, amount: 1000, dueDate: '2025-02-01' });
    expect(response.statusCode).toBe(200);
    invoiceId = response.body._id;
    expect(invoiceId).toBeDefined();
  });

  test('GET /api/invoices - fetch all invoices', async () => {
    const response = await request(app)
      .get('/api/invoices')
      .set('x-auth-token', token);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('PUT /api/invoices/:id - update invoice status', async () => {
    const response = await request(app)
      .put(`/api/invoices/${invoiceId}`)
      .set('x-auth-token', token)
      .send({ status: 'paid' });
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('paid');
  });
});
