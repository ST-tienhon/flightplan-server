const express = require('express');
const { displayAllFlights, displayAirways, displayFlightPlanByCallsign, displayAirRoutes } = require('./controller');

const router = express.Router();

// GET health check route
router.get('/health', (req, res) => {
    res.json({ message: 'Flight Plan Server is healthy' });
});
// GET Display Flight Plan
router.get('/displayAll', displayAllFlights);
router.get('/displayAirRoutes', displayAirRoutes);
router.get('/display', displayFlightPlanByCallsign);

// GET airways
router.get('/airways', displayAirways);


module.exports = router;