let mongoose = require('./db');

// grab the things we need
let Schema = mongoose.Schema;

// create a schema
let userSchema = new Schema({
	userName: String,
	title: String,
	name: String,
	email: { type: String, unique: true, lowercase: true, trim: true },
	role: {
		type: String,
		default: 'user'
	},
	accountId: Number,
	password: String,
	provider: String,
	salt: String,
	// countryName: String,
	// countryCode: String,
	// mobile: String,
	address: String,
	// city: String,
	// state: String,
	// pincode: String,
	profilePicture: String,
	emailVerified: {
		type: Boolean,
		"default": false
	},
	profileCompleted: {
		type: Boolean,
		"default": false
	},
	userMeta: {
		ip: String,
		country: { type: mongoose.Schema.Types.ObjectId, ref: "countries" },
		countryCode: String,
		timezone: String,
		mobile: String,
		mobileCode: String,
		landline: String,
		city: { type: mongoose.Schema.Types.ObjectId, ref: "cities" },
		state: { type: mongoose.Schema.Types.ObjectId, ref: "states" },
		pincode: String,
		profilePicture: String,
		gender: String,
		dob: Date,
		logo: String,
		contactPersonName: String,
		contactPersonMobile: String,
		contactPersonDesignation: String,
		businessSector: String,
		interestTopics: [{ type: String }],
		description: String,
		contactEmail: String,
		company: String,
		purchasePower: String,
		seniority: String,
		industry: String,
		jobFunction: String,
		website: String,
		whatsAppMobile: { type: String },
		whatsAppMobileCode : { type: String }
	},
	socials: {
		facebook: String,
		twitter: String,
		linkedin: String,
		skype: String,
		telegram: String,
		youtube: String,
		instagram: String
	},
	deviceInfo: [
		{
			platform: { type: String },
			token: { type: String },
		},
	],
	eventNotificationPreference: { type: Boolean, default: true },
	isActive: { type: Boolean, default: false },
	isBlocked: { type: Boolean, default: false },

	addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	eventAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }

}, { timestamps: true });

// we need to create a model using it
let users = mongoose.model('User', userSchema);

module.exports = users;