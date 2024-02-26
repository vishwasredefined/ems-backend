const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const sponsorSchema = new Schema(
	{

		packageId: { type: Schema.Types.ObjectId, ref: 'packages' }, // Selected Package
		eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'event' }, // Participating Event

		// Sponsor Info
		title: { type: String }, //[Mr, Ms..]
		name: { type: String }, // Sponsor Name
		email: { type: String, lowercase: true, trim: true }, //Sponsor Email
		businessEmail: { type: String, lowercase: true, trim: true }, //Sponsor Busineess Email
		phone: { type: String },
		whatsAppMobile: { type: String },
		phoneCode: String,
		whatsAppMobileCode : { type: String },
		designation: { type: String }, // Sponsor Designation

		//Company Info
		company: { type: String }, // Company Name
		website: { type: String }, // Company Website
		goal: { type: String }, // Company Goal
		logo: { type: String }, // Company Logo
		businessSector: { type: String }, // Company Sector
		country: { type: mongoose.Schema.Types.ObjectId, ref: 'countries' },
		companyDescription : String,
		linkedin: String,
		twitter: String,
		telegram: String,


		userId: { type: Schema.Types.ObjectId, ref: 'User' }, // Applying App userId
		eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
		allotedPackageDetails: [{
			packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
			noOfTickets: { type: Number }
		}],
		isPassActivated: { type: Boolean, default: false },
		//Sponsor Status
		status: { type: String, enum: ['UNDER_REVIEW', 'ASSIGNED'], default: 'UNDER_REVIEW' },
		isBlocked: { type: Boolean, default: false },
		isActive: { type: Boolean, default: true },
		isDeleted: { type: Boolean, default: false },
	},
	{
		timestamps: true
	}
);

module.exports = mongoose.model('sponsors', sponsorSchema);
