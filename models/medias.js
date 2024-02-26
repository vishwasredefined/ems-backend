const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const mediaSchema = new Schema({

	// About Media House 
	mediaHouse: { type: String }, // Media House Company Name
	logo: { type: String }, //Media House Logo
	website: { type: String }, // Media House Website

	// Media House Contact Details
	title: { type: String }, //[Mr, Ms..]
	contactPerson: { type: String },
	designation: { type: String }, // Sponsor Designation
	email: { type: String, lowercase: true, trim: true }, // Contact Person Email
	businessEmail: { type: String, lowercase: true, trim: true }, //Contact Person Business Email
	mobile: { type: String },
	whatsAppMobile: { type: String },
	mobileCode: String,
	whatsAppMobileCode: { type: String },
	telegram: String,
	linkedin: String,
	twitter: String,
	
	//Applying App User
	userId: { type: Schema.Types.ObjectId, ref: 'User' },

	//Applying Event Details
	eventId: { type: Schema.Types.ObjectId, ref: 'event' },
	eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
	allotedPackageDetails: [{
		packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
		noOfTickets: { type: Number }
	}],
	isPassActivated: { type: Boolean, default: false },
	//Media House Status
	status: { type: String, enum: ['UNDER_REVIEW', 'ASSIGNED'], default: 'UNDER_REVIEW' },
	isBlocked: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },
	isDeleted: { type: Boolean, default: false },

}, { timestamps: true });

exports.medias = mediaSchema

module.exports = mongoose.model('medias', mediaSchema);
