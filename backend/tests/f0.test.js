const request = require('supertest');
const app = require('../src/app');

describe('Feature 0: Foundation & Error Handling', () => {
  test('GET /health returns 200 with ok: true', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('GET /non-existent-route returns unified 404 error shape', async () => {
    const res = await request(app).get('/api/v1/unmapped-endpoint-path');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found',
    });
  });

  test('POST with invalid JSON body returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "invalid_json": ');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/v1/auth/login with missing required fields triggers OpenAPI validator 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({}); // missing username and password

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
