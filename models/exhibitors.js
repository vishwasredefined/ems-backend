const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const exhibitorSchema = new Schema({

	// Exhibitor Personal Info
	title: { type: String },
	name: { type: String },
	email: { type: String, lowercase: true, trim: true },
	businessEmail: { type: String, lowercase: true, trim: true }, // Business Email
	designation: { type: String },
	phone: { type: String },
	whatsAppMobile: { type: String },
	phoneCode: String,
	whatsAppMobileCode: { type: String },

	// Company Info
	logo: { type: String },
	company: { type: String },
	website: { type: String },
	companyDescription: String,
	businessSector: { type: String },
	country: { type: mongoose.Schema.Types.ObjectId, ref: 'countries' },
	goal: { type: String },

	//Social Media
	linkedin: String,
	twitter: String,
	telegram: String,

	eventPackages: [
		{
		}
	],

	//Applying User
	userId: { type: Schema.Types.ObjectId, ref: 'User' },

	eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'event' },
	packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
	eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
	allotedPackageDetails: [{
		packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
		noOfTickets: { type: Number }
	}],
	isPassActivated: { type: Boolean, default: false },
	//Status
	status: { type: String, enum: ['UNDER_REVIEW', 'ASSIGNED'], default: 'UNDER_REVIEW' },
	isBlocked: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },
	isDeleted: { type: Boolean, default: false },

}, { timestamps: true });

module.exports = mongoose.model('exhibitors', exhibitorSchema);
