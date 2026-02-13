process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';
process.env.PORT = '3001';
process.env.EXTERNAL_API_KEY = 'testkey';
process.env.EXTERNAL_API_BASE_URL = 'http://example.com';

const request = require('supertest');
const app = require('../app');

jest.mock('../clients/externalApi', () => ({
  getFMDisplayAll: jest.fn(),
  getGeoAirway: jest.fn(),
  getGeoFixes: jest.fn(),
}));

const externalApi = require('../clients/externalApi');

describe('Routes', () => {
  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ message: 'Flight Plan Server is healthy' });
  });

  test('GET /api/displayAll returns data', async () => {
    externalApi.getFMDisplayAll.mockResolvedValue([{ aircraftIdentification: 'ABC123', filedRoute: { routeText: 'R1' } }]);
    const res = await request(app).get('/api/displayAll');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toEqual([{ aircraftIdentification: 'ABC123', filedRoute: { routeText: 'R1' } }]);
  });

  test('GET /api/display returns 404 when callsign missing', async () => {
    const res = await request(app).get('/api/display');
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/display?callsign=ABC123 returns flightplan', async () => {
    externalApi.getFMDisplayAll.mockResolvedValue({ '0': { aircraftIdentification: 'ABC123' } });
    const res = await request(app).get('/api/display').query({ callsign: 'ABC123' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('GET /api/airways returns data', async () => {
    externalApi.getGeoAirway.mockResolvedValue([{ id: 1 }]);
    const res = await request(app).get('/api/airways');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});