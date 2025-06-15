require('dotenv').config();

module.exports = {
    partnerCode: process.env.PARTNER_CODE,
    accessKey: process.env.ACCESS_KEY,
    secretKey: process.env.SECRET_KEY,
    endpoint: process.env.MOMO_ENDPOINT,
    redirectUrl: process.env.REDIRECT_URL,
    notifyUrl: process.env.NOTIFY_URL
};