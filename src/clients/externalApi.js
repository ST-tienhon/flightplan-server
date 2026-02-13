const { createhttpClient } = require('./httpClient');
const { getGeoFixesCheckCache } = require('./httpClientCacheWaypoint');
const env = require('../config/env');

const Client = createhttpClient({
    baseURL: env.EXTERNAL_API_BASE_URL,
    headers: { 'apikey': `${env.EXTERNAL_API_KEY}` }
});

async function getFMDisplayAll() {
    const response = await Client.get('/flight-manager/displayAll');
    return response.data;
}

async function getGeoAirway() {
    const response = await Client.get('/geopoints/list/airways');
    return response.data;
}

async function getGeoFixes() {
    const response = await getGeoFixesCheckCache({ forcedRefresh: false });
    return response.data;
}

module.exports = {
    getFMDisplayAll,
    getGeoAirway,
    getGeoFixes
};