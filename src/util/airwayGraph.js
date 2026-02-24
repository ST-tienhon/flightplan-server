const R_EARTH_KM = 6371.0088;
const KM_PER_NM = 1.852;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.lon - a.lon);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

function kmToNm(km) {
  return km / KM_PER_NM;
}

class MinHeap {
  constructor() { this.arr = []; }
  push(item) { this.arr.push(item); this._up(this.arr.length - 1); }
  pop() {
    if (!this.arr.length) return null;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length) { this.arr[0] = last; this._down(0); }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.arr[p].dist <= this.arr[i].dist) break;
      [this.arr[p], this.arr[i]] = [this.arr[i], this.arr[p]];
      i = p;
    }
  }
  _down(i) {
    const n = this.arr.length;
    while (true) {
      let s = i, l = i * 2 + 1, r = i * 2 + 2;
      if (l < n && this.arr[l].dist < this.arr[s].dist) s = l;
      if (r < n && this.arr[r].dist < this.arr[s].dist) s = r;
      if (s === i) break;
      [this.arr[i], this.arr[s]] = [this.arr[s], this.arr[i]];
      i = s;
    }
  }
  get size() { return this.arr.length; }
}

/**
 * Build airway adjacency from airway waypoint sequences.
 *
 * waypointById: Map<string, {id,kind,lat,lon}>
 * airwayToWaypoints: Map<string, string[]> (ordered IDs)
 */
function buildAirwayAdjacency(waypointById, airwayToWaypoints, { bidirectional = true } = {}) {
  // adj: nodeId -> Array<{toId, wKm, viaAirway}>
  const adj = new Map();

  function addEdge(fromId, toId, airwayCode) {
    const from = waypointById.get(fromId);
    const to = waypointById.get(toId);
    if (!from || !to) return; // skip unknown IDs

    const wKm = haversineKm(from, to);

    if (!adj.has(fromId)) adj.set(fromId, []);
    adj.get(fromId).push({ toId, wKm, viaAirway: airwayCode });
  }

  for (const [airwayCode, seq] of airwayToWaypoints.entries()) {
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      addEdge(a, b, airwayCode);
      if (bidirectional) addEdge(b, a, airwayCode);
    }
  }
  return adj;
}

/**
 * Add "airport connectors": connect airport to N nearest waypoints (and back).
 * This bridges DEP/ARR into the airway network.
 */
function addAirportConnectors(adj, airport, waypointList, {
  nearestN = 8,
  maxConnectorNm = 250,
  bidirectional = true,
} = {}) {
  const maxKm = maxConnectorNm * KM_PER_NM;

  // compute distances to all waypoints (naive). If huge, index it later.
  const dists = [];
  for (const wp of waypointList) {
    const dKm = haversineKm(airport, wp);
    if (dKm <= maxKm) dists.push({ id: wp.id, dKm });
  }
  dists.sort((x, y) => x.dKm - y.dKm);
  const chosen = dists.slice(0, nearestN);

  const airportId = airport.id;

  if (!adj.has(airportId)) adj.set(airportId, []);

  for (const c of chosen) {
    adj.get(airportId).push({ toId: c.id, wKm: c.dKm, viaAirway: "CONNECTOR" });
    if (bidirectional) {
      if (!adj.has(c.id)) adj.set(c.id, []);
      adj.get(c.id).push({ toId: airportId, wKm: c.dKm, viaAirway: "CONNECTOR" });
    }
  }
}

/**
 * Dijkstra on nodeId graph.
 */
function dijkstraIds(adj, startId, goalId) {
  const dist = new Map([[startId, 0]]);
  const prev = new Map(); // nodeId -> { fromId, viaAirway }
  const visited = new Set();

  const pq = new MinHeap();
  pq.push({ nodeId: startId, dist: 0 });

  while (pq.size) {
    const cur = pq.pop();
    if (!cur) break;
    const u = cur.nodeId;
    if (visited.has(u)) continue;
    visited.add(u);

    if (u === goalId) break;

    const edges = adj.get(u) || [];
    for (const e of edges) {
      const v = e.toId;
      const nd = dist.get(u) + e.wKm;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, { fromId: u, viaAirway: e.viaAirway });
        pq.push({ nodeId: v, dist: nd });
      }
    }
  }

  if (!dist.has(goalId)) return { totalKm: Infinity, pathIds: [], pathVia: [] };

  // reconstruct
  const pathIds = [];
  const pathVia = []; // airway used to reach this node
  let cur = goalId;
  while (cur !== startId) {
    pathIds.push(cur);
    const p = prev.get(cur);
    if (!p) break; // should not happen
    pathVia.push(p.viaAirway);
    cur = p.fromId;
  }
  pathIds.push(startId);
  pathIds.reverse();
  pathVia.reverse();

  return { totalKm: dist.get(goalId), pathIds, pathVia };
}

/**
 * Compute route using airway network + airport connectors.
 */
function computeAirwayRoute({
  depAirport,
  arrAirport,
  waypointById,
  airwayToWaypoints,
  connector = { nearestN: 8, maxConnectorNm: 250 },
  bidirectionalAirways = true,
}) {
  const waypointList = Array.from(waypointById.values()).filter(
    (n) => n.kind === "fix" || n.kind === "navaid"
  );

  const adj = buildAirwayAdjacency(waypointById, airwayToWaypoints, { bidirectional: bidirectionalAirways });

  // bridge airports into airway net
  addAirportConnectors(adj, depAirport, waypointList, connector);
  addAirportConnectors(adj, arrAirport, waypointList, connector);

  const { totalKm, pathIds, pathVia } = dijkstraIds(adj, depAirport.id, arrAirport.id);

  if (!pathIds.length) {
    return { reachable: false, reason: "No path on airway network. Try relaxing connector limits.", totalNm: null, path: [] };
  }

  // materialize nodes
  const idToNode = new Map(waypointById);
  idToNode.set(depAirport.id, depAirport);
  idToNode.set(arrAirport.id, arrAirport);

  const path = pathIds.map((id) => idToNode.get(id)).filter(Boolean);

  return {
    reachable: true,
    totalNm: kmToNm(totalKm),
    path,
    legs: pathVia.map((viaAirway, i) => ({
      from: pathIds[i],
      to: pathIds[i + 1],
      viaAirway,
    })),
  };
}

module.exports = { computeAirwayRoute };