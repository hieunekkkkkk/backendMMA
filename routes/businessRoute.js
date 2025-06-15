const express = require('express');
const router = express.Router();
const Business = require('../models/business');
const axios = require('axios');

// Get all businesses
router.get('/', async (req, res) => {
    try {
        const businesses = await Business.find().sort({ viewCount: -1 });
        res.json(businesses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search businesses
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Tách từ khóa thành mảng và loại bỏ ký tự đặc biệt
        const keywords = query.trim().split(/\s+/)
            .filter(keyword => keyword.length > 0) // Loại bỏ chuỗi rỗng
            .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        if (keywords.length === 0) {
            return res.status(400).json({ error: 'Invalid search query' });
        }

        // Tạo điều kiện tìm kiếm cho từng từ khóa
        const searchConditions = keywords.map(keyword => ({
            $or: [
                { name: { $regex: new RegExp(keyword, 'i') } },
                { description: { $regex: new RegExp(keyword, 'i') } }
            ]
        }));

        const businesses = await Business.find({
            $and: searchConditions
        })
            .select('-products') // Loại bỏ products array để giảm payload nếu không cần
            .sort({ rating: -1, viewCount: -1 })
            .limit(50); // Giới hạn kết quả để tránh overload

        res.json(businesses);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id/ratings', async (req, res) => {
    try {
        const business = await Business.findOne({ id: req.params.id });
        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }
        res.json(business.rating || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id/ratings', async (req, res) => {
    try {
        const { rating } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const business = await Business.findOne({ id: req.params.id });
        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }
        const oldrating = business.rating || 0;
        let newRating;
        if (oldrating === 0) {
            newRating = rating;
        } else {
            newRating = (oldrating + rating) / 2;
        }

        business.rating = newRating;
        await business.save();

        res.status(201).json({ rating: newRating });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
);

// Get business by ID
router.get('/:id', async (req, res) => {
    try {
        const business = await Business.findOne({ id: req.params.id });
        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }
        // Increment view count
        business.viewCount = (business.viewCount || 0) + 1;
        await business.save();
        res.json(business);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get businesses by category
router.get('/category/:category', async (req, res) => {
    try {
        const businesses = await Business.find({
            category: req.params.category
        }).sort({ viewCount: -1 });
        res.json(businesses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get businesses by owner
router.get('/owner/:ownerId', async (req, res) => {
    try {
        const businesses = await Business.find({
            ownerId: req.params.ownerId
        }).sort({ createdAt: -1 });
        res.json(businesses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get most viewed businesses
router.get('/most-viewed', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const businesses = await Business.find()
            .sort({ viewCount: -1 })
            .limit(limit);
        res.json(businesses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




// Create new business
router.post('/', async (req, res) => {
    try {
        const businessData = req.body;
        const address = businessData.address.trim();
        const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${address}&limit=1&addressdetails=1`)
        const locationData = response.data[0];
        businessData.location = {
            "latitude": parseFloat(locationData.lat),
            "longitude": parseFloat(locationData.lon),
        };
        const business = new Business({
            ...businessData,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const savedBusiness = await business.save();
        res.status(201).json(savedBusiness);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update business
router.put('/:id', async (req, res) => {
    try {
        const business = await Business.findOneAndUpdate(
            { id: req.params.id }, // tìm theo trường `id` (chuỗi)
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }

        res.json(business);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete business
router.delete('/:id', async (req, res) => {
    try {
        const business = await Business.findOneAndDelete({ id: req.params.id });
        if (!business) {
            return res.status(404).json({ error: 'Business not found' });
        }
        res.json({ message: 'Business deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;