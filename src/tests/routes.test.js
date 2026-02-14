// tests/routes.test.js
const request = require('supertest');

// Mock externalApi used by controller.js
jest.mock('../clients/externalApi', () => ({
  getFMDisplayAll: jest.fn(),
  getGeoAirway: jest.fn(),
  getGeoFixes: jest.fn(),
  getGeoAirports: jest.fn(),
  getGeoNavaids: jest.fn(),
}));

const externalApi = require('../clients/externalApi');
const app = require('../app');
const controller = require('../routes/controller');

describe('Routes (src/app.js + src/routes/routes.js)', () => {
  beforeAll(async () => {
    // Mock geo datasets
    externalApi.getGeoAirports.mockResolvedValue([
      'VABB (19.09,72.87)',
      'WSSS (1.36,103.99)',
    ]);

    externalApi.getGeoNavaids.mockResolvedValue([
      // include VKL duplicates
      'VKL (2.72,101.74)',
      'VKL (51.66,5.71)',
      'ARAMA (1.61,103.12)',
    ]);

    externalApi.getGeoFixes.mockResolvedValue([
      'AGELA (16.61,75.47)',
      // GURAS duplicates
      'GURAS (14,80.83)',
      'GURAS (27.41,85.23)',
      'LAGOG (8.59,92)',
      'GUNIP (4.5,99.53)',
    ]);

    // Initialize maps once (like startup)
    await controller.initializeMaps();
  });

  test('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Flight Plan Server is healthy' });
  });

  test('GET /api/flights returns summary list', async () => {
    externalApi.getFMDisplayAll.mockResolvedValue([
      {
        _id: 'id-1',
        aircraftIdentification: 'SIA425',
        departure: { departureAerodrome: 'VABB' },
        arrival: { destinationAerodrome: 'WSSS' },
      },
    ]);

    const res = await request(app).get('/api/flights');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: 'id-1', callsign: 'SIA425', dep: 'VABB', arr: 'WSSS' },
    ]);
  });

  test('GET /api/flightDetails?id=... returns enriched route with best waypoints', async () => {
    externalApi.getFMDisplayAll.mockResolvedValue([
      {
        _id: 'id-2',
        aircraftIdentification: 'SIA425',
        departure: { departureAerodrome: 'VABB' },
        arrival: { destinationAerodrome: 'WSSS' },
        filedRoute: {
          routeText: 'AGELA N571 GURAS N571 LAGOG N571 GUNIP R467 VKL A464 ARAMA',
          routeElement: [
            { position: { designatedPoint: 'AGELA' }, airway: 'N571' },
            { position: { designatedPoint: 'GURAS' }, airway: 'N571' },
            { position: { designatedPoint: 'LAGOG' }, airway: 'N571' },
            { position: { designatedPoint: 'GUNIP' }, airway: 'R467' },
            { position: { designatedPoint: 'VKL' }, airway: 'A464' },
            { position: { designatedPoint: 'ARAMA' } },
          ],
        },
      },
    ]);

    const res = await request(app).get('/api/flightDetails?id=id-2');
    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({
      callsign: 'SIA425',
      dep: 'VABB',
      arr: 'WSSS',
    });

    // VKL should resolve to the nearer candidate, not Netherlands
    const vkl = res.body.waypoints.find(w => w.name === 'VKL');
    expect(vkl).toMatchObject({ lat: 2.72, lng: 101.74 });

    // Should include dep and arr in final waypoints list
    expect(res.body.waypoints[0].name).toBe('VABB');
    expect(res.body.waypoints[res.body.waypoints.length - 1].name).toBe('WSSS');

    // legs should be created
    expect(res.body.legs.length).toBeGreaterThan(0);
  });

  test('GET /api/waypoint?waypoint=AGELA returns lat/lon', async () => {
    // controller uses getGeoFixes fresh for this endpoint
    externalApi.getGeoFixes.mockResolvedValue([
      'AGELA (16.61,75.47)',
      'OTHER (1,2)',
    ]);

    const res = await request(app).get('/api/waypoint?waypoint=AGELA');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      waypoint: 'AGELA',
      latitude: 16.61,
      longitude: 75.47,
    });
  });
});
