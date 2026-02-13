const axios = require('axios');
// const { response } = require('express');

function createhttpClient({ baseURL, headers }) {
    const client = axios.create({
        baseURL,
        setTimeout: 5000,
        headers: {
            'content-type': 'application/json',
            ...headers
        }
    });

    // client.interceptors.request.use(
    //     response => {
    //         console.log('Creating HTTP client with baseURL:', response);
    //         return response;
    //     },
    //     error => {
    //         console.error('HTTP Request Error:', error);
    //         return Promise.reject(error);
    //     }
    // );

    return client;
};

module.exports = { createhttpClient };