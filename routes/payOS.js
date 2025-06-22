const express = require('express');
const PayOS = require('@payos/node');
const payOSConfig = require('../config/payOS');
const Payment = require('../models/payment');
const { Clerk, User } = require('@clerk/clerk-sdk-node');

const router = express.Router();

// Khởi tạo PayOS instance
const payOS = new PayOS(
    payOSConfig.clientId,
    payOSConfig.apiKey,
    payOSConfig.checksumKey
);

// Khởi tạo Clerk client
const clerk = new Clerk({
    secretKey: process.env.CLERK_SECRET_KEY
});

// Route tạo link thanh toán
router.post('/create-payment-link', async (req, res) => {
    try {
        const { orderCode, amount, description, returnUrl, cancelUrl, userId, subscriptionPlanId } = req.body;

        // Validate input
        if (!orderCode || !amount || !description) {
            return res.status(400).json({
                error: 'Missing required fields: orderCode, amount, description'
            });
        }

        if (!userId || !subscriptionPlanId) {
            return res.status(400).json({
                error: 'Missing required fields: userId, subscriptionPlanId'
            });
        }

        const paymentData = {
            orderCode: orderCode,
            amount: amount,
            description: description,
            returnUrl: returnUrl,
            cancelUrl: cancelUrl,
        };

        // Tạo payment link từ PayOS
        const paymentLinkResponse = await payOS.createPaymentLink(paymentData);

        // Lưu payment record vào database
        const paymentRecord = new Payment({
            orderId: orderCode.toString(),
            userId: userId,
            amount: amount,
            orderInfo: description,
            paymentMethod: 'payos',
            status: 'pending',
            subscriptionPlanId: subscriptionPlanId,
            payUrl: paymentLinkResponse.checkoutUrl,
            metadata: {
                payOSOrderCode: paymentLinkResponse.orderCode,
                qrCode: paymentLinkResponse.qrCode,
                returnUrl: returnUrl,
                cancelUrl: cancelUrl,
                createdAt: new Date().toISOString()
            }
        });

        await paymentRecord.save();
        console.log('Payment record saved:', paymentRecord._id);

        res.json({
            success: true,
            checkoutUrl: paymentLinkResponse.checkoutUrl,
            orderCode: paymentLinkResponse.orderCode,
            qrCode: paymentLinkResponse.qrCode,
            paymentId: paymentRecord._id
        });

    } catch (error) {
        console.error('PayOS Error:', error);

        // Nếu lỗi khi lưu vào database
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Database validation error',
                message: error.message,
                details: error.errors
            });
        }

        // Nếu lỗi duplicate key (orderId đã tồn tại)
        if (error.code === 11000) {
            return res.status(400).json({
                error: 'Duplicate order',
                message: 'Order ID already exists'
            });
        }

        res.status(500).json({
            error: 'Failed to create payment link',
            message: error.message
        });
    }
});

// Route để lấy thông tin payment (optional - để debug/tracking)
router.get('/payment/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const paymentRecord = await Payment.findOne({ orderId: orderId });

        if (!paymentRecord) {
            return res.status(404).json({
                error: 'Payment not found'
            });
        }

        res.json({
            success: true,
            payment: {
                orderId: paymentRecord.orderId,
                userId: paymentRecord.userId,
                amount: paymentRecord.amount,
                status: paymentRecord.status,
                paymentMethod: paymentRecord.paymentMethod,
                subscriptionPlanId: paymentRecord.subscriptionPlanId,
                createdAt: paymentRecord.createdAt,
                updatedAt: paymentRecord.updatedAt
            }
        });

    } catch (error) {
        console.error('Get Payment Error:', error);
        res.status(500).json({
            error: 'Failed to get payment info',
            message: error.message
        });
    }
});

// Webhook để nhận thông báo từ PayOS (nếu có)
router.post('/webhook', async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('PayOS Webhook received:', webhookData);

        // Verify webhook signature nếu cần
        const signature = req.headers['x-payos-signature'];
        if (signature) {
            const expectedSignature = crypto
                .createHmac('sha256', payOSConfig.checksumKey)
                .update(JSON.stringify(webhookData))
                .digest('hex');

            if (signature !== expectedSignature) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        // Xử lý webhook data
        if (webhookData.data && webhookData.data.orderCode) {
            const orderCode = webhookData.data.orderCode.toString();
            const paymentRecord = await Payment.findOne({ orderId: orderCode });

            if (paymentRecord) {
                if (webhookData.code === '00') {
                    // Thanh toán thành công - không làm gì cả (như yêu cầu)
                    paymentRecord.status = 'success';
                    console.log('PayOS Payment successful:', orderCode);
                } else {
                    // Thanh toán thất bại - revert user role về client
                    paymentRecord.status = 'failed';
                    console.log('PayOS Payment failed:', orderCode);

                    // Revert user role về client thông qua Clerk
                    try {
                        // Lấy thông tin user hiện tại trước
                        const currentUser = await clerk.users.getUser(paymentRecord.userId);

                        await clerk.users.updateUser(paymentRecord.userId, {
                            unsafeMetadata: {
                                ...currentUser.unsafeMetadata, // Giữ nguyên các trường khác
                                role: 'client',               // Chỉ update role
                                subscription: null            // Chỉ update subscription
                            }
                        });

                        console.log(`✅ User ${paymentRecord.userId} role reverted to client due to failed PayOS payment`);

                        // Lưu thông tin vào metadata để tracking
                        paymentRecord.metadata = {
                            ...paymentRecord.metadata,
                            userRoleReverted: true,
                            revertedAt: new Date().toISOString(),
                            revertReason: 'PayOS payment failed'
                        };

                    } catch (clerkError) {
                        console.error('Failed to revert user role in Clerk:', clerkError);

                        // Lưu lỗi vào metadata để debug
                        paymentRecord.metadata = {
                            ...paymentRecord.metadata,
                            userRoleRevertError: clerkError.message,
                            revertAttemptedAt: new Date().toISOString()
                        };
                    }
                }

                await paymentRecord.save();
            } else {
                console.warn('⚠️ PayOS payment not found in database:', orderCode);
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('PayOS Webhook Error:', error);
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message
        });
    }
});

// Route để handle return từ PayOS (alternative solution cho deep link)
router.get('/return', async (req, res) => {
    try {
        const { orderCode, status } = req.query;

        if (!orderCode) {
            return res.status(400).json({ error: 'Missing orderCode' });
        }

        const paymentRecord = await Payment.findOne({ orderId: orderCode.toString() });

        if (!paymentRecord) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Xử lý dựa trên status từ PayOS
        if (status === 'CANCELLED' || status === 'failed') {
            // Thanh toán bị hủy hoặc thất bại
            paymentRecord.status = 'failed';

            // Revert user role về client
            try {
                // Lấy thông tin user hiện tại trước
                const currentUser = await clerk.users.getUser(paymentRecord.userId);

                await clerk.users.updateUser(paymentRecord.userId, {
                    unsafeMetadata: {
                        ...currentUser.unsafeMetadata, // Giữ nguyên các trường khác
                        role: 'client',               // Chỉ update role
                        subscription: null            // Chỉ update subscription
                    }
                });

                console.log(`✅ User ${paymentRecord.userId} role reverted to client due to cancelled/failed PayOS payment`);

                paymentRecord.metadata = {
                    ...paymentRecord.metadata,
                    userRoleReverted: true,
                    revertedAt: new Date().toISOString(),
                    revertReason: `PayOS payment ${status}`
                };

            } catch (clerkError) {
                console.error('Failed to revert user role in Clerk:', clerkError);

                paymentRecord.metadata = {
                    ...paymentRecord.metadata,
                    userRoleRevertError: clerkError.message,
                    revertAttemptedAt: new Date().toISOString()
                };
            }

            await paymentRecord.save();

            // Redirect về deep link với path cụ thể
            return res.redirect(`mmaapp://payment-cancel`);

        } else if (status === 'PAID' || status === 'success') {
            // Thanh toán thành công - không làm gì cả
            paymentRecord.status = 'success';
            await paymentRecord.save();

            // Redirect về deep link với path cụ thể
            return res.redirect(`mmaapp://payment-success`);
        }

        // Default response
        res.json({
            success: true,
            orderCode: orderCode,
            status: paymentRecord.status
        });

    } catch (error) {
        console.error('PayOS Return Error:', error);
        res.status(500).json({
            error: 'Failed to process return',
            message: error.message
        });
    }
});

module.exports = router;