const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const stateSchema = new Schema({

  id: { type: Number },
  name: { type: String },
  country_id: { type: Number, },

  language: { type: String },
  languageCode: { type: String },
  isDeleted: { type: Boolean, default: false },

},{timestamps:true});
exports.states=stateSchema;

module.exports = mongoose.model('states', stateSchema);
