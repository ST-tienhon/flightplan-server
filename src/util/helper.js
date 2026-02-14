

function parseAirports(airportList) {
  const map = {};
  airportList?.forEach(item => {
    // Adjust regex based on your airport data format
    const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
    if (match) {
      const [, code, lat, lng] = match;
      // map[code] = { lat: parseFloat(lat), lng: parseFloat(lng) };
      // For duplicate codes, e.g. VKL with 2 sets of coordinates. to resolve later with nearest coordinate logic
      map[code] ??= [];
      map[code].push({ lat: parseFloat(lat), lng: parseFloat(lng) });
    }
  });
  return map;
}

function parseNavaids(navaidsList) {
  const map = {};
  navaidsList?.forEach(item => {
    // Adjust based on your navaid data format
    const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
    if (match) {
      const [, code, lat, lng] = match;
      // map[code] = { lat: parseFloat(lat), lng: parseFloat(lng) };
      // For duplicate codes, e.g. VKL with 2 sets of coordinates. to resolve later with nearest coordinate logic
      map[code] ??= [];
      map[code].push({ lat: parseFloat(lat), lng: parseFloat(lng) });
    }
  });
  return map;
}

function parseFixes(fixesList) {
  const map = {};
  fixesList?.forEach(item => {
    const match = item.match(/^([A-Z0-9]+)\s*\(([^,]+),([^)]+)\)$/);
    if (match) {
      const [, code, lat, lng] = match;
      // map[code] = { lat: parseFloat(lat), lng: parseFloat(lng) };
      // For duplicate codes, e.g. VKL with 2 sets of coordinates. to resolve later with nearest coordinate logic
      map[code] ??= [];
      map[code].push({ lat: parseFloat(lat), lng: parseFloat(lng) });
    }
  });
  return map;
}

function dist2(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

// Picks the smoothest overall route through the candidates (global optimum)
function pickBestWaypoints(waypoints) {
  if (!Array.isArray(waypoints) || waypoints.length === 0) return [];

  const nodes = waypoints.map(w => ({
    name: w.name,
    candidates: Array.isArray(w.candidates) ? w.candidates : []
  }));

  // handle missing candidates if any
  for (const n of nodes) {
    if (n.candidates.length === 0) {
      n.candidates = [{ lat: null, lng: null, missing: true }];
    }
  }

  const N = nodes.length;
  const dp = Array.from({ length: N }, () => []);
  const back = Array.from({ length: N }, () => []);

  // init
  dp[0] = nodes[0].candidates.map(() => 0);
  back[0] = nodes[0].candidates.map(() => -1);

  for (let i = 1; i < N; i++) {
    const prev = nodes[i - 1].candidates;
    const curr = nodes[i].candidates;

    for (let j = 0; j < curr.length; j++) {
      let bestCost = Infinity;
      let bestPrev = -1;

      for (let k = 0; k < prev.length; k++) {
        const a = prev[k], b = curr[j];

        const bad = (a.lat == null || a.lng == null || b.lat == null || b.lng == null);
        const step = bad ? 1e12 : dist2(a, b);

        const cost = dp[i - 1][k] + step;
        if (cost < bestCost) {
          bestCost = cost;
          bestPrev = k;
        }
      }

      dp[i][j] = bestCost;
      back[i][j] = bestPrev;
    }
  }

  // choose best end
  let endJ = 0;
  let bestEnd = Infinity;
  for (let j = 0; j < dp[N - 1].length; j++) {
    if (dp[N - 1][j] < bestEnd) {
      bestEnd = dp[N - 1][j];
      endJ = j;
    }
  }

  // backtrack
  const chosen = new Array(N);
  for (let i = N - 1; i >= 0; i--) {
    chosen[i] = nodes[i].candidates[endJ];
    endJ = back[i][endJ];
  }

  // final stripped output
  return nodes.map((n, i) => ({
    name: n.name,
    lat: chosen[i].lat ?? null,
    lng: chosen[i].lng ?? null
  }));
}

function retrieveSummary(flightPlans) {
  const results = flightPlans.map(({ aircraftIdentification, departure, arrival }) => ({
    callsign: aircraftIdentification,
    dep: departure?.departureAerodrome,
    arr: arrival?.destinationAerodrome
  }))
  return results;
}

function retrieveRoutes(flightPlans) {
  const results = flightPlans
    .map(plan => plan.filedRoute?.routeText)
    .filter(Boolean);
  return results;
}

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

function enrichWaypointsWithCoordinates(waypoints, fixesMap, navaidsMap) {
  return waypoints
    .map((waypoint) => {
      const key = String(waypoint).trim().toUpperCase();
      const found = fixesMap[key] || navaidsMap[key];

      if (!found) return { name: key, candidates: [], missing: true };

      const candidates = Array.isArray(found) ? found : [found];

      return { name: key, candidates };
    });
}

function enrichRouteWithAirportsDep(departure, routeWaypoints, airportMap) {
  const enriched = [...routeWaypoints];

  const key = String(departure || '').trim().toUpperCase();
  const airport = airportMap[key];

  enriched.unshift({
    name: key,
    candidates: Array.isArray(airport)
      ? airport
      : airport
        ? [airport]
        : []
  });

  return enriched;
}

function enrichRouteWithAirportsArr(arrival, routeWaypoints, airportMap) {
  const enriched = [...routeWaypoints];

  const key = String(arrival || '').trim().toUpperCase();
  const airport = airportMap[key];

  enriched.push({
    name: key,
    candidates: Array.isArray(airport)
      ? airport
      : airport
        ? [airport]
        : []
  });

  return enriched;
}

module.exports = {
  parseAirports,
  parseFixes,
  parseNavaids,
  pickBestWaypoints,
  retrieveSummary,
  retrieveRoutes,
  findByWaypoint,
  findByCallsign,
  parseRouteElements,
  enrichWaypointsWithCoordinates,
  enrichRouteWithAirportsDep,
  enrichRouteWithAirportsArr
};