const express = require('express');
const { displayAllFlights, displayAllSummary, displayAirways, displayFlightPlanByID, displayAirRoutes, displayFixes, updateData } = require('./controller');

const router = express.Router();

// GET health check route
router.get('/health', (req, res) => {
    res.json({ message: 'Flight Plan Server is healthy' });
});
// GET Display Flight Plan
router.get('/displayAll', displayAllFlights);
router.get('/displayAirRoutes', displayAirRoutes);

router.get('/waypoint', displayFixes);

// router.get('/waypointsGeo', displayWaypointsGeo);

// GET airways
router.get('/airways', displayAirways);

// For FlightPath-UI
router.get('/flights', displayAllSummary);
router.get('/flightDetails', displayFlightPlanByID);

router.get('/updateData', updateData);

module.exports = router;