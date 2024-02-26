const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const purchasedPackagesSchema = new Schema(
    {

        packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
        eventId: { type: Schema.Types.ObjectId, ref: 'event' },
        packageType: String, // [Visitor, Sponsor, Exhibitor]

        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        visitorId: { type: Schema.Types.ObjectId, ref: 'visitors' },
        transactionId: { type: Schema.Types.ObjectId, ref: 'transactions' },

        // isPassActivated: { type: Boolean, default: false },   // Is passes activated by Admin
        isBlocked: { type: Boolean, default: false },  // Is your pass is blocked by admin
        isExpired: { type: Boolean, default: false },  // Expires when event Expires.
        expiryTime: Date,

        isUpgraded: { type: Boolean, default: false }, //If User Upgrade their ticket then this pass will become useless
    },
    {
        timestamps: true
    }
);
module.exports = mongoose.model('purchasedPackages', purchasedPackagesSchema);
