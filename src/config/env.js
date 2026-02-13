const dotenv = require('dotenv')

dotenv.config()

const requiredVars = [
    'NODE_ENV',
    'LOG_LEVEL',
    'PORT',
    'EXTERNAL_API_KEY',
    'EXTERNAL_API_BASE_URL'
]

requiredVars.forEach((key) => {
    if (!process.env[key]) {
        throw new Error(`Environment variable ${key} is required but not set.`)
    }
})

module.exports = {
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    PORT: process.env.PORT,
    EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY,
    EXTERNAL_API_BASE_URL: process.env.EXTERNAL_API_BASE_URL
}