const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    orderInfo: {
        type: String,
        required: true
    },
    paymentMethod: {
        type: String,
        default: 'momo'
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'cancelled'],
        default: 'pending'
    },
    momoTransId: {
        type: String,
        default: null
    },
    resultCode: {
        type: Number,
        default: null
    },
    message: {
        type: String,
        default: null
    },
    responseTime: {
        type: Date,
        default: null
    },
    subscriptionPlanId: {
        type: Number,
        required: true
    },
    payUrl: {
        type: String,
        default: null
    },
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true
});

// Index for better query performance
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ orderId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);