const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const currenciesSchema = new Schema({

    isDeleted: { type: Boolean, default: false },
    code: { type: String },
    name: { type: String },
    symbol: { type: String }

}, { timestamps: true });

module.exports = mongoose.model('currencies', currenciesSchema);
