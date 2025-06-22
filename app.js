const express = require('express');
const app = express();
const businessRoutes = require('./routes/businessRoute');
const paymentRoutes = require('./routes/payment');
const clerkRoutes = require('./routes/clerk');
const payOSRoutes = require('./routes/payOS');
const cors = require('cors');



app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: false,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '5gb' }));

app.use('/api/businesses', businessRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/clerk', clerkRoutes);
app.use('/api/payos', payOSRoutes);

module.exports = app;
