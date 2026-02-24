const { createhttpClient } = require('./httpClient');
const { getGeoFixesCheckCache } = require('./httpClientCacheWaypoint');
const { getGeoAirportsCheckCache } = require('./httpClientCacheAirports');
const { getGeoNavaidsCheckCache } = require('./httpClientCacheNavaids');
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

async function getGeoAirports() {
    const response = await getGeoAirportsCheckCache({ forcedRefresh: false });
    return response.data;
}

async function getGeoNavaids() {
    const response = await getGeoNavaidsCheckCache({ forcedRefresh: false });
    return response.data;
}

async function getAirwayWaypoints(airway) {
    const response = await Client.get(`/geopoints/search/airways/${airway}`);
    return response.data;
}

module.exports = {
    getFMDisplayAll,
    getGeoAirway,
    getGeoFixes,
    getGeoAirports,
    getGeoNavaids,
    getAirwayWaypoints
};