const request = require('supertest');
const app = require('../../src/app');
const { makeToken } = require('../helpers/managerAuth');
const { paginateM } = require('../../src/utils/paginateM');
const Staff = require('../../src/db/models/Staff');

describe('Manager Module M0: Foundation', () => {
  let managerToken;
  let receptionistToken;

  beforeAll(async () => {
    const manager = await makeToken('manager');
    managerToken = manager.token;

    const receptionist = await makeToken('receptionist');
    receptionistToken = receptionist.token;
  });

  describe('GET /api/v1/manager/password-reset-requests', () => {
    test('returns 200 with manager token', async () => {
      const res = await request(app)
        .get('/api/v1/manager/password-reset-requests')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    test('returns 403 with receptionist token', async () => {
      const res = await request(app)
        .get('/api/v1/manager/password-reset-requests')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/manager/password-reset-requests');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/manager/nope', () => {
    test('returns 404 in unified error format', async () => {
      const res = await request(app)
        .get('/api/v1/manager/nope')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Receptionist path validation remains active', () => {
    test('bad request to /api/v1/rooms still returns 400', async () => {
      const res = await request(app)
        .get('/api/v1/rooms?status=invalid_status_value')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('paginateM utility', () => {
    test('caps limit to 100 when limit=500 and calculates total_pages correctly', async () => {
      // Mock mongoose model
      const mockDocs = [{ id: '1' }, { id: '2' }];
      const mockModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockDocs),
              }),
            }),
          }),
        }),
        countDocuments: jest.fn().mockResolvedValue(250),
      };

      const result = await paginateM(mockModel, {}, { page: 1, limit: 500 });

      expect(result.meta.limit).toBe(100);
      expect(result.meta.page).toBe(1);
      expect(result.meta.total).toBe(250);
      expect(result.meta.total_pages).toBe(3); // Math.ceil(250 / 100) = 3
      expect(result.data).toEqual(mockDocs);
    });
  });
});
