const express = require('express');
const routes = require('./routes/routes');
const logger = require('./util/logger');
const { pinoHttp } = require('pino-http');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    pinoHttp({
        logger,
        quietReqLogger: true,
        quietResLogger: true,
        customSuccessObject: (req, res) => ({}),
        customSuccessMessage: (req, res) => `Handled ${req.method} ${req.url} with status ${res.statusCode}`,
        customErrorObject: (error, req, res) => ({}),
    })
)

app.use('/api', routes);

// Error handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});


module.exports = app;