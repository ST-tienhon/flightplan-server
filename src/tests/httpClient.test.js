const axios = require('axios');
jest.mock('axios');

const { createhttpClient } = require('../clients/httpClient');

describe('createhttpClient', () => {
  test('creates axios instance with provided config', () => {
    const fakeInstance = {};
    axios.create.mockReturnValue(fakeInstance);

    const client = createhttpClient({ baseURL: 'http://api', headers: { apikey: 'k' } });

    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'http://api',
      setTimeout: 5000,
      headers: expect.objectContaining({
        'content-type': 'application/json',
        apikey: 'k'
      })
    }));
    expect(client).toBe(fakeInstance);
  });
});