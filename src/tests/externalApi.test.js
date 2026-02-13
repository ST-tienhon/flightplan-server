// src/tests/externalApi.test.js
beforeEach(() => {
  jest.resetModules();
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'info';
  process.env.PORT = '3001';
  process.env.EXTERNAL_API_KEY = 'testkey';
  process.env.EXTERNAL_API_BASE_URL = 'http://example.com';
});

test('getFMDisplayAll returns response data', async () => {
  const fakeData = [{ id: 1 }];
  const fakeClient = { get: jest.fn().mockResolvedValue({ data: fakeData }) };

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

  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue(fakeClient),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getGeoAirway();

  expect(fakeClient.get).toHaveBeenCalledWith('/geopoints/list/airways');
  expect(res).toEqual(fakeData);
});

test('getGeoFixes returns response data', async () => {
  const fakeData = [{ fix: 'F1' }];
  const fakeClient = { get: jest.fn().mockResolvedValue({ data: fakeData }) };

  jest.doMock('../clients/httpClient', () => ({
    createhttpClient: jest.fn().mockReturnValue(fakeClient),
  }));

  const externalApi = require('../clients/externalApi');
  const res = await externalApi.getGeoFixes();

  expect(fakeClient.get).toHaveBeenCalledWith('/geopoints/list/fixes');
  expect(res).toEqual(fakeData);
});