const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const visitorSchema = new Schema(
	{

		// Personal Details
		profilePicture: { type: String },
		title: { type: String },
		name: { type: String },

		email: { type: String, lowercase: true, trim: true },
		businessEmail: { type: String, lowercase: true, trim: true }, // Business Email
		firstName: { type: String },
		lastName: { type: String },

		mobile: { type: String },
		whatsAppMobile: { type: String },
		mobileCode: String,
		whatsAppMobileCode : { type: String },

		residenceCountry: { type: Schema.Types.ObjectId, ref: 'countries' },
		nationality: String,

		interestTopics: [{ type: String }],

		linkedin: { type: String },
		twitter: { type: String },
		telegram: { type: String },

		//Company Details
		company: { type: String },
		designation: { type: String },
		website: { type: String }, // Company Website

		userId: { type: Schema.Types.ObjectId, ref: 'User' },
		eventId: { type: Schema.Types.ObjectId, ref: 'event' },
		eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
		
		packageId: { type: Schema.Types.ObjectId, ref: 'packages' },
		
		sponsorId:{ type: Schema.Types.ObjectId, ref: 'sponsors' },
		exhibitorId:{ type: Schema.Types.ObjectId, ref: 'exhibitors' },
		speakerId:{ type: Schema.Types.ObjectId, ref: 'speakers' },
		mediaPartnerId:{ type: Schema.Types.ObjectId, ref: 'medias' },

		isBlocked: { type: Boolean, default: false },
		isDeleted: { type: Boolean, default: false },

		isPackagePurchased: { type: Boolean, default: false },
        isPassActivated: { type: Boolean, default: false },   // Is passes activated by Admin
		parentMember: { type: String, enum: ['Visitor','Sponsor','Exhibitor','Speaker','Media','Admin'] }, //detects weather the visitor has been created from app or admin
		source: {
			type: String,
			enum: ["APP", "ADMIN_PANEL"]
		},
		passUrl: { type: String },
		additionalInfo: [{
			questionId: { type: Schema.Types.ObjectId, ref: 'eventQuestions' },
			//question: String,
			answer: String
		}],
		status: { type: String, enum: ['Waitlisted','Approved'] }
	},
	{
		timestamps: true
	}
);

module.exports = mongoose.model('visitors', visitorSchema);
