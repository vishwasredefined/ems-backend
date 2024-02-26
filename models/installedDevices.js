let mongoose = require('./db');

// grab the things we need
let Schema = mongoose.Schema;

// create a schema
let installedDevicesSchema = new Schema({
	key: String,
	platform: String,
	deviceToken: String

}, { timestamps: true });

// we need to create a model using it
let InstalledDevices = mongoose.model('installedDevices', installedDevicesSchema);

module.exports = InstalledDevices;