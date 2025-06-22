const app = require('./app');
const connectDB = require('./db');
require('dotenv').config();

const PORT = process.env.PORT;
const HOST = process.env.HOST;


connectDB();

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});

