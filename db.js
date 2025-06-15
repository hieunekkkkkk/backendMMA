const mongoose = require('mongoose');
require('dotenv').config();

let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log('✅ MongoDB already connected');
        return;
    }

    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI environment variable is not defined');
        }

        const options = {
            serverSelectionTimeoutMS: 15000, // Tăng lên 15 giây
            socketTimeoutMS: 60000, // Tăng lên 60 giây
            maxPoolSize: 5, // Giảm số kết nối tối đa để tiết kiệm tài nguyên
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
        };

        await mongoose.connect(process.env.MONGO_URI, options);

        isConnected = true;
        console.log('✅ MongoDB connected successfully');

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
            isConnected = false;
        });

    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        isConnected = false;
        throw err;
    }
};

module.exports = connectDB;
