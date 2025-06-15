const express = require('express');
const router = express.Router();
const { Clerk } = require('@clerk/clerk-sdk-node');

// Khởi tạo Clerk client
const clerk = new Clerk({
    secretKey: process.env.CLERK_SECRET_KEY
});

// Route lấy danh sách users với pagination
router.get('/users', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const userList = await clerk.users.getUserList({
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        const users = userList.map(user => ({
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            username: user.username,
            role: user.unsafeMetadata?.role || 'client',
            gender: user.unsafeMetadata?.gender,
            createdAt: user.createdAt,
            lastSignInAt: user.lastSignInAt,
            imageUrl: user.imageUrl
        }));

        res.json({
            users,
            total: users.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Route lấy thông tin user cụ thể
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await clerk.users.getUser(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userData = {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            username: user.username,
            role: user.unsafeMetadata?.role || 'client',
            gender: user.unsafeMetadata?.gender,
            createdAt: user.createdAt,
            lastSignInAt: user.lastSignInAt,
            imageUrl: user.imageUrl,
            publicMetadata: user.publicMetadata,
            unsafeMetadata: user.unsafeMetadata
        };

        res.json(userData);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;