// tests/helper.test.js
const {
  parseAirports,
  parseFixes,
  parseNavaids,
  enrichWaypointsWithCoordinates,
  enrichRouteWithAirportsDep,
  enrichRouteWithAirportsArr,
  parseRouteElements,
  pickBestWaypoints,
} = require('../util/helper');

describe('src/util/helper.js', () => {
  test('parseAirports stores duplicates as arrays', () => {
    const airportsList = [
      'VABB (19.09,72.87)',
      'WSSS (1.36,103.99)',
      'VABB (19.0901,72.8701)', // duplicate code
    ];

    const airportMap = parseAirports(airportsList);

    expect(Array.isArray(airportMap.VABB)).toBe(true);
    expect(airportMap.VABB).toHaveLength(2);
    expect(airportMap.WSSS).toHaveLength(1);
    expect(airportMap.VABB[0]).toMatchObject({ lat: 19.09, lng: 72.87 });
  });

  test('parseFixes and parseNavaids store duplicates as arrays', () => {
    const fixesList = ['VKL (2.72,101.74)', 'VKL (51.66,5.71)'];
    const navaidsList = ['VKL (2.72,101.74)', 'AAA (1,2)'];

    const fixesMap = parseFixes(fixesList);
    const navaidsMap = parseNavaids(navaidsList);

    expect(fixesMap.VKL).toHaveLength(2);
    expect(navaidsMap.VKL).toHaveLength(1);
  });

  test('enrichWaypointsWithCoordinates merges fixes + navaids candidates and dedupes', () => {
    const fixesMap = parseFixes(['VKL (2.72,101.74)', 'VKL (51.66,5.71)']);
    const navaidsMap = parseNavaids(['VKL (2.72,101.74)', 'VKL (2.72,101.74)']); // duplicates

    const result = enrichWaypointsWithCoordinates(['VKL', 'NOPE'], fixesMap, navaidsMap);

    expect(result).toHaveLength(2);

    const vkl = result[0];
    expect(vkl.name).toBe('VKL');
    // should contain both unique coords (2.72/101.74) and (51.66/5.71)
    expect(vkl.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lat: 2.72, lng: 101.74 }),
        expect.objectContaining({ lat: 51.66, lng: 5.71 }),
      ])
    );

    const nope = result[1];
    expect(nope.name).toBe('NOPE');
    expect(nope.missing).toBe(true);
    expect(nope.candidates).toHaveLength(0);
  });

  test('enrichRouteWithAirportsDep/Arr adds airports to start/end (candidates array)', () => {
    const airportMap = parseAirports(['VABB (19.09,72.87)', 'WSSS (1.36,103.99)']);

    const mid = [
      { name: 'AGELA', candidates: [{ lat: 16.61, lng: 75.47 }] },
    ];

    const withDep = enrichRouteWithAirportsDep('VABB', mid, airportMap);
    expect(withDep[0].name).toBe('VABB');
    expect(withDep[0].candidates).toHaveLength(1);

    const withArr = enrichRouteWithAirportsArr('WSSS', withDep, airportMap);
    expect(withArr[withArr.length - 1].name).toBe('WSSS');
    expect(withArr[withArr.length - 1].candidates).toHaveLength(1);
  });

  test('parseRouteElements extracts waypoint list and legs correctly', () => {
    const routeElement = [
      { position: { designatedPoint: 'AGELA' }, airway: 'N571' },
      { position: { designatedPoint: 'GURAS' }, airway: 'N571' },
      { position: { designatedPoint: 'LAGOG' }, airway: 'N571' },
    ];

    const { waypoints, legs } = parseRouteElements(routeElement);

    expect(waypoints).toEqual(['AGELA', 'GURAS', 'LAGOG']);
    expect(legs).toEqual([
      { from: 'AGELA', to: 'GURAS', airway: 'N571' },
      { from: 'GURAS', to: 'LAGOG', airway: 'N571' },
    ]);
  });

  test('pickBestWaypoints picks smoothest candidate path (avoids far jump)', () => {
    // Build nodes similar to your pipeline: candidates arrays already merged
    const route = [
      { name: 'VABB', candidates: [{ lat: 19.09, lng: 72.87 }] },
      { name: 'AGELA', candidates: [{ lat: 16.61, lng: 75.47 }] },
      {
        name: 'GURAS',
        candidates: [
          { lat: 14.0, lng: 80.83 },   // "nearby" choice
          { lat: 27.41, lng: 85.23 },  // farther
        ],
      },
      { name: 'LAGOG', candidates: [{ lat: 8.59, lng: 92.0 }] },
      { name: 'GUNIP', candidates: [{ lat: 4.5, lng: 99.53 }] },
      {
        name: 'VKL',
        candidates: [
          { lat: 2.72, lng: 101.74 },   // near Malaysia
          { lat: 51.66, lng: 5.71 },    // Netherlands (massive jump)
        ],
      },
      { name: 'WSSS', candidates: [{ lat: 1.36, lng: 103.99 }] },
    ];

    const best = pickBestWaypoints(route);

    // Ensure VKL chosen is Malaysia-ish, not Netherlands
    const vkl = best.find(x => x.name === 'VKL');
    expect(vkl).toMatchObject({ lat: 2.72, lng: 101.74 });

    expect(best).toHaveLength(route.length);
  });
});
