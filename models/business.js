const mongoose = require('mongoose');

const OpeningHoursSchema = new mongoose.Schema({
    open: { type: String, required: true },
    close: { type: String, required: true },
    days: { type: [Number], required: true }, // 0–6 (Sun–Sat)
});

const LocationSchema = new mongoose.Schema({
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
});

const ProductSchema = new mongoose.Schema({
    id: { type: String, required: true },
    businessId: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    price: Number,
    image: String,
    isAvailable: Boolean,
});

const BusinessSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true },
        ownerId: { type: String, required: true },
        name: { type: String, required: true },
        category: {
            type: String,
            enum: ['accommodation', 'hotel', 'restaurant', 'pharmacy', 'gas_station'],
            required: true,
        },
        description: String,
        address: String,
        location: LocationSchema,
        phone: String,
        openingHours: OpeningHoursSchema,
        isOpen: Boolean,
        images: [String],
        viewCount: Number,
        rating: Number,
        products: [ProductSchema],
        createdAt: Date,
        updatedAt: Date,
    },
    { timestamps: false } // Vì bạn đã có `createdAt`, `updatedAt` riêng
);

module.exports = mongoose.model('Business', BusinessSchema, 'business');
