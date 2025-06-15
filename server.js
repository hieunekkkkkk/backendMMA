const app = require('./app');
const connectDB = require('./db');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const initializeServer = async () => {
    try {
        await connectDB();
        console.log('✅ Database connection initialized');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
    }
};

// Initialize database connection
initializeServer();

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}

module.exports = app; // Export app for testing or further configuration