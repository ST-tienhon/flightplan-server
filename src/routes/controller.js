const { getFMDisplayAll, getGeoAirway, getGeoFixes, getGeoAirports, getGeoNavaids } = require('../clients/externalApi');
const logger = require('../util/logger');

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

// Parse functions for each map type
function parseAirports(airportList) {
    const map = {};
    airportList?.forEach(item => {
        // Adjust regex based on your airport data format
        const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
        if (match) {
            const [, code, lat, lng] = match;
            map[code] = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }
    });
    return map;
}

function parseNavaids(navaidsist) {
    const map = {};
    navaidsist?.forEach(item => {
        // Adjust based on your navaid data format
        const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
        if (match) {
            const [, code, lat, lng] = match;
            map[code] = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }
    });
    return map;
}

function parseFixes(fixesList) {
    const map = {};
    fixesList?.forEach(item => {
        const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
        if (match) {
            const [, name, lat, lng] = match;
            map[name] = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }
    });
    return map;
}

// Lookup functions
function getCoordinates(type, identifier) {
    const maps = { airport: airportMap, navaid: navaidsMap, fix: fixesMap };
    return maps[type]?.[identifier] || null;
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

function retrieveSummary(flightPlans) {
    const results = flightPlans.map(({ aircraftIdentification, departure, arrival }) => ({
        callsign: aircraftIdentification,
        dep: departure?.departureAerodrome,
        arr: arrival?.destinationAerodrome
    }))
    return results;
}

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

function retrieveRoutes(flightPlans) {
    const results = flightPlans
        .map(plan => plan.filedRoute?.routeText)
        .filter(Boolean);
    return results;
}

const displayFlightPlanByCallsign = async (req, res) => {
    try {
        const { callsign } = req.query;

        if (!callsign) {
            return res.status(404).json({ error: 'Callsign required' });
        }

        const allFlightPlan = await getFMDisplayAll();

        if (!allFlightPlan) {
            return res.status(404).json({ error: 'Flight plans not found' });
        }

        const flightPlan = findByCallsign(allFlightPlan, callsign.toUpperCase());

        if (!flightPlan) {
            return res.status(404).json({ error: `Flight plan by callsign ${callsign} not found` });
        }

        const routeElements = parseRouteElements(flightPlan.filedRoute?.routeElement);

        const routeWaypoints = enrichWaypointsWithCoordinates(routeElements.waypoints);
        const routeWithDeparture = enrichRouteWithAirportsDep(flightPlan.departure?.departureAerodrome, routeWaypoints);
        const routeWithArrival = enrichRouteWithAirportsArr(flightPlan.arrival?.destinationAerodrome, routeWithDeparture);

        res.json({
            callsign: flightPlan.aircraftIdentification,
            departure: flightPlan.departure?.departureAerodrome,
            arrival: flightPlan.arrival?.destinationAerodrome,
            routeText: flightPlan.filedRoute?.routeText,
            waypoints: routeWithArrival,
            legs: routeElements.legs
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

function findByCallsign(flightPlans, callsign) {
    return Object.values(flightPlans).find(
        plan => plan.aircraftIdentification === callsign);
}

function parseRouteElements(routeElement) {
    // Extract waypoints (designatedPoints only)
    const waypoints = routeElement
        .filter(element => element.position?.designatedPoint)
        .map(element => element.position.designatedPoint);

    // Build legs (from -> to with airway)
    const legs = [];
    for (let i = 0; i < routeElement.length - 1; i++) {
        const current = routeElement[i];
        const next = routeElement[i + 1];

        // Get current and next designated points
        const fromPoint = current.position?.designatedPoint;
        const toPoint = next.position?.designatedPoint;

        // Only create leg if we have both from and to points
        if (fromPoint && toPoint) {
            legs.push({
                from: fromPoint,
                to: toPoint,
                airway: current.airway || null
            });
        }
    }

    return { waypoints, legs };
}

function enrichWaypointsWithCoordinates(waypoints) {
  return waypoints
    .map(waypoint => {
      // Try fixes first, then navaids
      const coordinates = fixesMap[waypoint] || navaidsMap[waypoint];
      if (coordinates) {
        return { name: waypoint, ...coordinates };
      }
      return null;
    })
    .filter(Boolean);
}

function enrichRouteWithAirportsDep(departure, routeWaypoints) {
  const enriched = [...routeWaypoints];
  
  if (departure && airportMap[departure]) {
    enriched.unshift({
      name: departure,
    //   type: 'airport',
      ...airportMap[departure]
    });
  } else {
    enriched.unshift({
      name: departure,
    //   type: 'airport',
      lat: null,
      lng: null
    });
  }
  
  return enriched;
}

function enrichRouteWithAirportsArr(arrival, routeWaypoints) {
  const enriched = [...routeWaypoints];
  
  if (arrival && airportMap[arrival]) {
    enriched.push({
      name: arrival,
    //   type: 'airport',
      ...airportMap[arrival]
    });
  } else {
    enriched.push({
      name: arrival,
    //   type: 'airport',
      lat: null,
      lng: null
    });
  }
  
  return enriched;
}

// function enrichWaypointsWithCoordinates(waypoints, waypointList) {
//     // Parse waypointList into a map for quick lookup
//     // Format: "KNEW (30.04,-90.03)" -> { KNEW: { lat: 30.04, lng: -90.03 } }
//     const waypointMap = {};
//     waypointList.forEach(item => {
//         const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
//         if (match) {
//             const [, name, lat, lng] = match;
//             waypointMap[name] = {
//                 lat: parseFloat(lat),
//                 lng: parseFloat(lng)
//             };
//         }
//     });

//     // Enrich waypoints with coordinates
//     return waypoints
//         .map(waypoint => {
//             if (waypointMap[waypoint]) {
//                 return {
//                     name: waypoint,
//                     lat: waypointMap[waypoint].lat,
//                     lng: waypointMap[waypoint].lng
//                 };
//             }
//             return null; // Waypoint not found
//         })
//         .filter(Boolean); // Remove unfound waypoints
// }

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

function findByWaypoint(fixes, waypoint) {
    const match = fixes.find(item =>
        item.startsWith(waypoint.toUpperCase() + "")
    );

    if (!match) return null;

    const coordMatch = match.match(/\(([^)]+)\)/);
    if (!coordMatch) return null;

    const [lat, lon] = coordMatch[1].split(',').map(Number);
    return { waypoint: waypoint.toUpperCase(), latitude: lat, longitude: lon };
}

const updateData = async (req, res) => {
    try {
        await initializeMaps(); // Refresh maps with latest data

        res.json({ data: "Backend updated with latest data" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { displayAllFlights, displayAllSummary, displayAirRoutes, displayAirways, displayFlightPlanByCallsign, displayFixes, updateData };