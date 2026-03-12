const request = require('supertest');
jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

const app = require('../app');
const UserModel = require('../models/user.model');

describe('API smoke tests', () => {
  it('GET /api/v1/health should return service health status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data.database');
  });

  it('GET /api/v1/investments/stocks should return available stocks', async () => {
    const response = await request(app).get('/api/v1/investments/stocks');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('GET /api/v1/savings/overview should require auth', async () => {
    const response = await request(app).get('/api/v1/savings/overview');

    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  });

  it('GET /api/v1/ledger/history should require auth', async () => {
    const response = await request(app).get('/api/v1/ledger/history');

    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  });

  it('POST /api/v1/auth/register should fail validation for empty payload', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('User model should apply opening balance and enforce 10-digit account number', () => {
    const validUser = new UserModel({
      firstName: 'Policy',
      lastName: 'Check',
      userName: 'policycheckuser',
      email: 'policy.check@example.com',
      password: 'hashed-password',
      accountNumber: '1234567890'
    });

    expect(validUser.balance).toBe(99999);

    const invalidUser = new UserModel({
      firstName: 'Invalid',
      lastName: 'Account',
      userName: 'invalidaccountuser',
      email: 'invalid.account@example.com',
      password: 'hashed-password',
      accountNumber: '12345'
    });

    const validationError = invalidUser.validateSync();
    expect(validationError).toBeDefined();
    expect(validationError.errors.accountNumber).toBeDefined();
  });
});
