require('dotenv').config();

const payOSConfig = {
    clientId: process.env.CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.CHECKSUM_KEY,
};

module.exports = payOSConfig;
