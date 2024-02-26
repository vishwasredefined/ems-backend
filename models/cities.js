const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const citySchema = new Schema({

    id: { type: Number },
    name: { type: String, },
    state_id: { type: Number },
    country_id: { type: Number },

    language: { type: String },
    languageCode: { type: String },
    isDeleted: { type: Boolean, default: false },
 
},{timestamps:true});


exports.cities = citySchema

module.exports = mongoose.model('cities', citySchema);
