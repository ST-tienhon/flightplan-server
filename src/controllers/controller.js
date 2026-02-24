const { getFMDisplayAll, getGeoAirway, getGeoFixes, getGeoAirports, getGeoNavaids, getAirwayWaypoints } = require('../clients/externalApi');
const logger = require('../util/logger');
const { parseAirports, parseFixes, parseNavaids, pickBestWaypoints, retrieveSummary, retrieveRoutes, findByWaypoint,
    findByID, parseRouteElements, enrichWaypointsWithCoordinates, enrichRouteWithAirportsDep, enrichRouteWithAirportsArr
} = require('../util/helper');

// Module-level maps for caching lookup data
let airportMap = {};
let navaidsMap = {};
let fixesMap = {};
let airwayCache = {};

// Initialize/refresh all maps on startup or on-demand
async function initializeMaps() {
    try {
        const airports = await getGeoAirports();
        const navaids = await getGeoNavaids();
        const fixes = await getGeoFixes();

        airportMap = parseAirports(airports);
        navaidsMap = parseNavaids(navaids);
        fixesMap = parseFixes(fixes);
        airwayCache = await buildAirwayCache();

        logger.info('Maps initialized:', {
            airports: Object.keys(airportMap).length,
            navaids: Object.keys(navaidsMap).length,
            fixes: Object.keys(fixesMap).length,
            airwayCache: airwayCache.airwayToWaypoints.size
        });
    } catch (error) {
        logger.error('Error initializing maps:', error.message);
    }
}

function extractWaypoints(seqArray) {
    if (!Array.isArray(seqArray) || seqArray.length === 0) return [];

    const str = seqArray[0];

    // Extract content inside brackets
    const match = str.match(/\[(.*)\]/);
    if (!match) return [];

    return match[1]
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
}

async function buildAirwayWaypoints(airwayCodes, concurrency = 2) {
    const airwayToWaypoints = new Map();

    let idx = 0;
    let completed = 0;
    let success = 0;
    let failed = 0;
    let inFlight = 0;

    const startTime = Date.now();
    const total = airwayCodes.length;

    function logProgress() {
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rate = (completed / elapsedSec).toFixed(1);
        console.log(
            `[AirwayBuild] ${completed}/${total} | ok=${success} fail=${failed} | ` +
            `inFlight=${inFlight} | ${rate}/sec | ${elapsedSec.toFixed(1)}s`
        );
    }

    async function worker(workerId) {
        while (true) {
            const i = idx++;
            if (i >= total) break;

            const code = airwayCodes[i];
            inFlight++;

            try {
                const raw = await getAirwayWaypoints(code);
                const seq = extractWaypoints(raw, code);
                if (seq.length >= 2) {
                    airwayToWaypoints.set(code, seq);
                    success++;
                }
            } catch (e) {
                failed++;
                console.warn(`Worker ${workerId} failed ${code}:`, e.message);
            }

            completed++;
            inFlight--;

            // Log every 200 completions
            if (completed % 10 === 0 || completed === total) {
                logProgress();
            }
        }
    }

    console.log(`Starting airway build: total=${total}, concurrency=${concurrency}`);

    const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
    await Promise.all(workers);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
        `Airway build done. Success=${success}, Failed=${failed}, ` +
        `Time=${totalTime}s, AvgRate=${(total / totalTime).toFixed(1)}/sec`
    );
    return airwayToWaypoints;
}

async function buildAirwayCache() {
    const airwayCodes = await getGeoAirway();
    const airwayToWaypoints = await buildAirwayWaypoints(airwayCodes);

    // console.log('buildAirwayCache - airwayCodes:', airwayCodes.length, new Date());
    // // Fetch waypoints per airway (you can parallelize with a limit if needed)
    // for (const code of airwayCodes) {
    //     const result = await getAirwayWaypoints(code);
    //     const seq = extractWaypoints(result);
    //     if (Array.isArray(seq) && seq.length >= 2) airwayToWaypoints.set(code, seq);
    //     if (airwayToWaypoints.size % 100 === 0) console.log('buildAirwayCache - airwayCodes:', airwayToWaypoints.size, new Date());
    // }

    // console.log('buildAirwayCache - airwayCodes:', airwayToWaypoints.size);
    // Build waypointById map using your DB
    // Option 1 (best): preload all fixes/navaids once
    const all = [].concat(Object.values(fixesMap)).concat(Object.values(navaidsMap));
    const waypointById = new Map(all.map((n) => [n.id, n]));

    return { airwayToWaypoints, waypointById };
}

const displayAllFlights = async (req, res) => {
    try {
        // Open the flight plan logic here
        const flightPlan = await getFMDisplayAll();

        if (!flightPlan) {
            return res.status(404).json({ error: 'Flight plan not found' });
        }

        res.json({ success: true, data: flightPlan });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const displayAllSummary = async (req, res) => {
    try {
        // Open the flight plan logic here
        const flightPlan = await getFMDisplayAll();

        const result = retrieveSummary(flightPlan);

        if (!result) {
            return res.status(404).json({ error: 'Flight plan summary not found' });
        }

        res.json({ data: result });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const displayAirRoutes = async (req, res) => {
    try {

        const flightPlan = await getFMDisplayAll();

        if (!flightPlan) {
            return res.status(404).json({ error: 'Flight plan not found' });
        }

        const result = retrieveRoutes(flightPlan);

        if (!result) {
            return res.status(404).json({ error: `Air routes not found` });
        }

        res.json({ success: true, data: result });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const displayFlightPlanByID = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(404).json({ error: 'ID required' });
        }

        const allFlightPlan = await getFMDisplayAll();

        if (!allFlightPlan) {
            return res.status(404).json({ error: 'Flight plans not found' });
        }

        const flightPlan = findByID(allFlightPlan, id);
        console.log('Flight plan found by ID:', flightPlan ? flightPlan._id : 'None');
        if (!flightPlan) {
            return res.status(404).json({ error: `Flight plan by ID ${id} not found` });
        }

        if (!flightPlan.filedRoute || !flightPlan.filedRoute.routeElement) {
            return res.status(200).json({
                callsign: flightPlan.aircraftIdentification,
                dep: flightPlan.departure?.departureAerodrome,
                arr: flightPlan.arrival?.destinationAerodrome,
                routeText: null,
                waypoints: null,
                legs: null
            });
        }
        const routeElements = parseRouteElements(flightPlan.filedRoute.routeElement);
        if (!routeElements) {
            return res.status(404).json({ error: 'Route elements not found' });
        }
        const routeWaypoints = enrichWaypointsWithCoordinates(routeElements.waypoints, fixesMap, navaidsMap);
        if (routeWaypoints.length === 0) {
            return res.status(404).json({ error: 'No waypoints found in route' });
        }
        const routeWithDeparture = enrichRouteWithAirportsDep(flightPlan.departure?.departureAerodrome, routeWaypoints, airportMap);
        if (routeWithDeparture.length === 0) {
            return res.status(404).json({ error: 'No departure airport found' });
        }
        const routeWithArrival = enrichRouteWithAirportsArr(flightPlan.arrival?.destinationAerodrome, routeWithDeparture, airportMap);
        if (routeWithArrival.length === 0) {
            return res.status(404).json({ error: 'No arrival airport found' });
        }
        const bestWaypoints = pickBestWaypoints(routeWithArrival);
        if (bestWaypoints.length === 0) {
            return res.status(404).json({ error: 'No valid waypoints found after enrichment' });
        }

        res.json({
            callsign: flightPlan.aircraftIdentification,
            dep: flightPlan.departure?.departureAerodrome,
            arr: flightPlan.arrival?.destinationAerodrome,
            routeText: flightPlan.filedRoute?.routeText,
            waypoints: bestWaypoints,
            legs: routeElements.legs
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const displayAirways = async (req, res) => {
    try {
        const { id } = req.params;

        // Get air way
        const airWay = await getGeoAirway();

        if (!airWay) {
            return res.status(404).json({ error: 'Airway not found' });
        }

        res.json({ data: airWay });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const displayFixes = async (req, res) => {
    try {
        const { waypoint } = req.query;

        const waypointList = await getGeoFixes();

        if (!waypointList || waypointList.length === 0) {
            return res.status(404).json({ error: 'Waypoint list not found' });
        }
        const result = findByWaypoint(waypointList, waypoint);

        if (!result) {
            return res.status(404).json({ error: `Lat lon not found` });
        }

        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const computeRoute = async (req, res) => {
    try {
        await initializeMaps(); // Refresh maps with latest data

        res.json({ data: "Backend updated with latest data" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateData = async (req, res) => {
    try {
        await initializeMaps(); // Refresh maps with latest data

        res.json({ data: "Backend updated with latest data" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { initializeMaps, displayAllFlights, displayAllSummary, displayAirRoutes, displayAirways, displayFlightPlanByID, displayFixes, computeRoute, updateData };