const { createhttpClient } = require('./httpClient');
const env = require('../config/env');

const Client = createhttpClient({
    baseURL: env.EXTERNAL_API_BASE_URL,
    headers: { 'apikey': `${env.EXTERNAL_API_KEY}` }
});
let cached = null
let cachedAt = 0
let inProgress = null

const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

async function getGeoAirpotsAPI() {
    const res = await Client.get('/geopoints/list/airports', {
        timeout: 20000
    });
    return res.data;
}

async function getGeoAirportsCheckCache({ forcedRefresh = false }) {
    const now = Date.now();
    const expired = !cached || (now - cachedAt) > TTL_MS
    if (!expired && !forcedRefresh) {
        return { data: cached };
    }
    if (!inProgress) {
        inProgress = (async () => {
            const data = await getGeoAirpotsAPI();
            cached = data;
            cachedAt = Date.now();
            return { data: cached };
        })().finally(() => {
            inProgress = null;
        });
    }
    return inProgress;
}

module.exports = {
    getGeoAirportsCheckCache
};