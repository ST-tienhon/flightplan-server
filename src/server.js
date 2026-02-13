const app = require('./app');
const env = require('./config/env');
const logger = require('./util/logger');

app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
});