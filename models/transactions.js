const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TransactionSchema = new Schema(
    {
        txnId: { type: String },
        invoiceNumber: { type: String },
        orderId: { type: String },
        
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        visitorId: { type: mongoose.Schema.Types.ObjectId, ref: "visitors" },
        eventAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
        eventId: { type: Schema.Types.ObjectId, ref: 'event' },

        transactionType: {
            type: String,
            // enum: ["PACKAGE_PURCHASE", "PACKAGE_UPGRADE"] 
        },
        // status: { type: String, enum: ["SUCCESS", "FAILED", "PENDING", "REFUNDED"], },

        paymentMethod: {
            type: String,
            // enum: ["CASH", "ONLINE"]
        },
        gatewayName: {
            type: String,
            // enum: ["STRIPE", "COIN_PAYMENTS"]
        },
        currency: { type: String },

        quantity: { type: Number },
        amount: { type: mongoose.Schema.Types.Decimal128 },  //token amount
        fees: { type: mongoose.Schema.Types.Decimal128 },
        gatewayData: { type: Object },

        //New Keys
        txnHash: { type: String },
        paymode: String,
        settledAmount: { type: Schema.Types.Decimal128, default: 0 },
        usdAmount: { type: Schema.Types.Decimal128, default: 0 },
        currentPrice: { type: Schema.Types.Decimal128, default: 0 },
        status: { type: String, enum: ['PROCESSING', 'COMPLETED', 'CANCELLED', 'PENDING', 'FAILED', 'ONHOLD', 'REJECTED', 'APPROVED', 'SETTLED','PARTIAL'] },
        // gateway: { type: Object },
        rejectionReason: { type: String },

        webhookData: [],

        //Withdrawal Data
        walletAddress: String,
        chain: { type: String, default: process.env.DEFAULT_CHAIN },
        userConsent: Boolean  //Consent that user agree to T&C

    },
    { timestamps: true }
);
module.exports = mongoose.model("transactions", TransactionSchema);
