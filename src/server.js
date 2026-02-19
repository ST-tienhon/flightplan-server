const app = require('./app');
const env = require('./config/env');
const logger = require('./util/logger');
const { initializeMaps } = require('./controllers/controller');

async function startServer() {
    try {
        await initializeMaps();   // 👈 initialize once here

        app.listen(env.PORT, () => {
            logger.info(`Server running on port ${env.PORT}`);
        });

    } catch (err) {
        logger.error('Failed to initialize maps:', err);
        process.exit(1);  // crash early if critical
    }
}

startServer();