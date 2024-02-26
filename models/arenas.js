const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const arenaSchema = new Schema(
    {

        eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'event' },
        name: { type: String },
        description: { type: String },

        isDeleted: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true }

    },
    { timestamps: true }
);

module.exports = mongoose.model('arena', arenaSchema);
