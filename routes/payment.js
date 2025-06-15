const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../models/payment');
const {
    partnerCode,
    accessKey,
    secretKey,
    endpoint,
    redirectUrl,
    notifyUrl
} = require('../config/momoConfig');

const router = express.Router();

// Tạo yêu cầu thanh toán và lưu vào DB
router.post('/create-payment', async (req, res) => {
    try {
        const { orderId, amount, orderInfo, userId, subscriptionPlanId } = req.body;

        if (!orderId || !amount || !orderInfo || !userId || !subscriptionPlanId) {
            return res.status(400).json({
                error: 'Missing required fields: orderId, amount, orderInfo, userId, subscriptionPlanId'
            });
        }

        // Check if payment already exists
        const existingPayment = await Payment.findOne({ orderId });
        if (existingPayment) {
            return res.status(400).json({ error: 'Payment with this order ID already exists' });
        }

        const requestId = Date.now().toString();
        const requestType = 'captureWallet';
        const extraData = '';

        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
        const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            amount,
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl: notifyUrl,
            extraData,
            requestType,
            signature,
            lang: 'en'
        };

        // Call MoMo API
        const momoRes = await axios.post(endpoint, requestBody, {
            headers: { 'Content-Type': 'application/json' }
        });

        const momoData = momoRes.data;

        // Save payment to database
        const payment = new Payment({
            orderId,
            userId,
            amount: parseInt(amount),
            orderInfo,
            subscriptionPlanId: parseInt(subscriptionPlanId),
            payUrl: momoData.payUrl || null,
            status: momoData.resultCode === 0 ? 'pending' : 'failed',
            resultCode: momoData.resultCode,
            message: momoData.message,
            metadata: {
                requestId,
                momoRequestId: momoData.requestId,
                deeplink: momoData.deeplink,
                qrCodeUrl: momoData.qrCodeUrl,
                deeplinkMiniApp: momoData.deeplinkMiniApp
            }
        });

        await payment.save();

        console.log('✅ Payment created and saved to DB:', orderId);

        return res.status(200).json({
            ...momoData,
            paymentId: payment._id
        });

    } catch (error) {
        console.error('MoMo create-payment error:', error.message);
        return res.status(500).json({ error: 'MoMo payment request failed.' });
    }
});

// Check payment status
router.get('/status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const payment = await Payment.findOne({ orderId });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.status(200).json({
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            message: payment.message,
            subscriptionPlanId: payment.subscriptionPlanId,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt
        });

    } catch (error) {
        console.error('Check payment status error:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

router.get('/history/all', async (req, res) => {
    try {
        // Parse query parameters safely
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500); // Giới hạn tối đa 500 item/trang

        const skip = (page - 1) * limit;

        // Fetch payments with sorting and pagination
        const [payments, total] = await Promise.all([
            Payment.find({})
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .select('-metadata -__v'), // Ẩn metadata và __v

            Payment.countDocuments()
        ]);

        res.status(200).json({
            payments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get all payment history error:', error);
        res.status(500).json({ error: 'Failed to get payment history' });
    }
});

// Get payment history for user
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const payments = await Payment.find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-metadata -__v');

        const total = await Payment.countDocuments({ userId });

        res.status(200).json({
            payments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({ error: 'Failed to get payment history' });
    }
});

// Xử lý callback IPN từ MoMo
router.post('/notify', async (req, res) => {
    try {
        const data = req.body;
        console.log('🔔 MoMo IPN received:', data);

        const rawSignature = `accessKey=${accessKey}&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&partnerCode=${data.partnerCode}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;
        const expectedSignature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

        if (expectedSignature === data.signature) {
            // Signature hợp lệ, update payment status
            const payment = await Payment.findOne({ orderId: data.orderId });

            if (payment) {
                payment.status = data.resultCode === 0 ? 'success' : 'failed';
                payment.momoTransId = data.transId;
                payment.resultCode = data.resultCode;
                payment.message = data.message;
                payment.responseTime = new Date(data.responseTime);

                await payment.save();

                console.log(`✅ Payment ${payment.status.toUpperCase()} - Order ID: ${data.orderId}, Trans ID: ${data.transId}`);

                // TODO: Có thể thêm logic gửi notification tới frontend qua WebSocket/Push notification

            } else {
                console.warn('⚠️ Payment not found in database:', data.orderId);
            }

            res.status(200).send('OK');
        } else {
            console.warn('❌ Invalid MoMo signature received');
            res.status(400).send('Invalid signature');
        }
    } catch (error) {
        console.error('MoMo notify error:', error);
        res.status(500).send('Internal server error');
    }
});



module.exports = router;