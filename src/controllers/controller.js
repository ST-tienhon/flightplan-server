const { getFMDisplayAll, getGeoAirway, getGeoFixes, getGeoAirports, getGeoNavaids } = require('../clients/externalApi');
const logger = require('../util/logger');
const { parseAirports, parseFixes, parseNavaids, pickBestWaypoints, retrieveSummary, retrieveRoutes, findByWaypoint,
    findByID, parseRouteElements, enrichWaypointsWithCoordinates, enrichRouteWithAirportsDep, enrichRouteWithAirportsArr
} = require('../util/helper');

// Module-level maps for caching lookup data
let airportMap = {};
let navaidsMap = {};
let fixesMap = {};

// Initialize/refresh all maps on startup or on-demand
async function initializeMaps() {
    try {
        const airports = await getGeoAirports();
        const navaids = await getGeoNavaids();
        const fixes = await getGeoFixes();

        airportMap = parseAirports(airports);
        navaidsMap = parseNavaids(navaids);
        fixesMap = parseFixes(fixes);

        logger.info('Maps initialized:', {
            airports: Object.keys(airportMap).length,
            navaids: Object.keys(navaidsMap).length,
            fixes: Object.keys(fixesMap).length
        });
    } catch (error) {
        logger.error('Error initializing maps:', error.message);
    }
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

const updateData = async (req, res) => {
    try {
        await initializeMaps(); // Refresh maps with latest data

        res.json({ data: "Backend updated with latest data" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { initializeMaps, displayAllFlights, displayAllSummary, displayAirRoutes, displayAirways, displayFlightPlanByID, displayFixes, updateData };