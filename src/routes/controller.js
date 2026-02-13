const { getFMDisplayAll, getGeoAirway, getGeoFixes } = require('../clients/externalApi');

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

const displayAirRoutes = async (req, res) => {
    try {
        
        const flightPlan = await getFMDisplayAll();
        
        if (!flightPlan) {
            return res.status(404).json({ error: 'Flight plan not found' });
        }

        console.log('displayAirRoutes');
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
    
    console.log('Route Text Results:', results);
    return results;
}

const displayFlightPlanByCallsign = async (req, res) => {
    try {
        const { callsign } = req.query;
        
        if (!callsign) {
            return res.status(404).json({ error: 'Callsign required' });
        }

        const flightPlan = await getFMDisplayAll();
        
        if (!flightPlan) {
            return res.status(404).json({ error: 'Flight plan not found' });
        }

        const result = findByCallsign(flightPlan, callsign.toUpperCase());

        if (!result) {
            return res.status(404).json({ error: `Flight plan by callsign ${callsign} not found` });
        }
                
        res.json({ success: true, data: result });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

function findByCallsign(flightPlans, callsign) {
    return Object.values(flightPlans).find(
        plan => plan.aircraftIdentification === callsign);
}

const displayAirways = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get air way
        const airWay = await getGeoAirway();
        
        if (!airWay) {
            return res.status(404).json({ error: 'Airway not found' });
        }
                
        res.json({ success: true, data: airWay });
        // res.json({ success: true});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { displayAllFlights, displayAirRoutes, displayAirways, displayFlightPlanByCallsign };