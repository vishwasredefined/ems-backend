const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const speakerSchema = new Schema(
	{

		// Speaker Personal Info
		profilePicture: { type: String },
		title: String,
		name: { type: String },
		about: { type: String },
		country: { type: mongoose.Schema.Types.ObjectId, ref: "countries" },
		interestTopics: [{ type: String }],
		whatsAppMobile: { type: String },
		mobile: { type: String },
		mobileCode: String,
		whatsAppMobileCode: { type: String },
		designation: { type: String },
		email: { type: String, lowercase: true, trim: true }, // Email
		
		// Professional Information
		businessEmail: { type: String, lowercase: true, trim: true }, //Sponsor Business Email
		businessSector: { type: String },
		organization: { type: String }, // Company Name
		orgWebsite: { type: String }, // Company Website

		linkedin: { type: String },
		twitter: { type: String },
		telegram: { type: String },

		// Applying User
		userId: { type: Schema.Types.ObjectId, ref: 'User' },

		// Event related Details
		eventId: { type: Schema.Types.ObjectId, ref: 'event' },
		eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
		allotedPackageDetails: [{
			packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
			noOfTickets: { type: Number }
		}],
		isPassActivated: { type: Boolean, default: false },

    	// upload passport/emiratesId
		attachedDocuments: [],
		
		// Status Information
		status: { type: String, enum: ['UNDER_REVIEW', 'ASSIGNED'], default: 'UNDER_REVIEW' },
		isBlocked: { type: Boolean, default: false },
		isActive: { type: Boolean, default: true },
		isDeleted: { type: Boolean, default: false },

	},
	{
		timestamps: true
	}
);
module.exports = mongoose.model('speakers', speakerSchema);
