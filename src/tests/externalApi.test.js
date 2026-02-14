// src/tests/externalApi.test.js

beforeEach(() => {
  jest.resetModules();

  // env.js requires these or it will throw
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'info';
  process.env.PORT = '3001';
  process.env.EXTERNAL_API_KEY = 'testkey';
  process.env.EXTERNAL_API_BASE_URL = 'http://example.com';
});

test('getFMDisplayAll returns response data', async () => {
  const fakeData = [{ id: 1 }];
  const fakeClient = { get: jest.fn().mockResolvedValue({ data: fakeData }) };

  // Mock cache modules too (externalApi requires them at module load)
  jest.doMock('../clients/httpClientCacheWaypoint', () => ({
    getGeoFixesCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheAirports', () => ({
    getGeoAirportsCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheNavaids', () => ({
    getGeoNavaidsCheckCache: jest.fn(),
  }));

  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue(fakeClient),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getFMDisplayAll();

  expect(fakeClient.get).toHaveBeenCalledWith('/flight-manager/displayAll');
  expect(res).toEqual(fakeData);
});

test('getGeoAirway returns response data', async () => {
  const fakeData = [{ airway: 'A1' }];
  const fakeClient = { get: jest.fn().mockResolvedValue({ data: fakeData }) };

  jest.doMock('../clients/httpClientCacheWaypoint', () => ({
    getGeoFixesCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheAirports', () => ({
    getGeoAirportsCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheNavaids', () => ({
    getGeoNavaidsCheckCache: jest.fn(),
  }));

  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue(fakeClient),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getGeoAirway();

  expect(fakeClient.get).toHaveBeenCalledWith('/geopoints/list/airways');
  expect(res).toEqual(fakeData);
});

test('getGeoFixes calls cache layer and returns response.data', async () => {
  const fakeData = ['AGELA (16.61,75.47)'];

  const getGeoFixesCheckCache = jest.fn().mockResolvedValue({ data: fakeData });

  // Mock cache modules
  jest.doMock('../clients/httpClientCacheWaypoint', () => ({
    getGeoFixesCheckCache,
  }));
  jest.doMock('../clients/httpClientCacheAirports', () => ({
    getGeoAirportsCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheNavaids', () => ({
    getGeoNavaidsCheckCache: jest.fn(),
  }));

  // externalApi still creates a Client via httpClient at module load
  // so mock it even though this test doesn't call Client.get()
  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue({ get: jest.fn() }),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getGeoFixes();

  expect(getGeoFixesCheckCache).toHaveBeenCalledWith({ forcedRefresh: false });
  expect(res).toEqual(fakeData);
});

test('getGeoAirports calls cache layer and returns response.data', async () => {
  const fakeData = ['VABB (19.09,72.87)'];

  const getGeoAirportsCheckCache = jest.fn().mockResolvedValue({ data: fakeData });

  jest.doMock('../clients/httpClientCacheWaypoint', () => ({
    getGeoFixesCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheAirports', () => ({
    getGeoAirportsCheckCache,
  }));
  jest.doMock('../clients/httpClientCacheNavaids', () => ({
    getGeoNavaidsCheckCache: jest.fn(),
  }));

  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue({ get: jest.fn() }),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getGeoAirports();

  expect(getGeoAirportsCheckCache).toHaveBeenCalledWith({ forcedRefresh: false });
  expect(res).toEqual(fakeData);
});

test('getGeoNavaids calls cache layer and returns response.data', async () => {
  const fakeData = ['VKL (2.72,101.74)'];

  const getGeoNavaidsCheckCache = jest.fn().mockResolvedValue({ data: fakeData });

  jest.doMock('../clients/httpClientCacheWaypoint', () => ({
    getGeoFixesCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheAirports', () => ({
    getGeoAirportsCheckCache: jest.fn(),
  }));
  jest.doMock('../clients/httpClientCacheNavaids', () => ({
    getGeoNavaidsCheckCache,
  }));

  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue({ get: jest.fn() }),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getGeoNavaids();

  expect(getGeoNavaidsCheckCache).toHaveBeenCalledWith({ forcedRefresh: false });
  expect(res).toEqual(fakeData);
});
