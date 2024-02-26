const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const eventSchema = new Schema(
	{

		name: { type: String },
		currency: { type: String },
		startDate: { type: Date },
		endDate: { type: Date },
		saleStartDate: { type: Date },
		saleEndDate: { type: Date },
		coverImage: { type: String },
		eventType: { type: String },
		// eventSections: [
		// 	{
		// 		type: String
		// 	}
		// ],
		eventDescription: { type: String },
		managedBy: { type: Schema.Types.ObjectId, ref: 'User' },

		expired: { type: Boolean, default: false },
		isFeatured: { type: Boolean, default: false },
		isActive: { type: Boolean, default: false }, // For App. Works fro publishing 
		isDeleted: { type: Boolean, default: false },

		venue: {
			type: { type: String, enum: ['OFFLINE', 'VIRTUAL', 'HYBRID'] },
			platforms: [                                                        // Virtual platforms links
				{
					type: String, enum: ['ZOOM', 'SKYPE', 'MEET', 'YOUTUBE']
				}
			],
			zoomLink: { type: String },
			skypeLink: { type: String },
			meetLink: { type: String },
			youTubeLink: { type: String },
			zoomId: { type: String },
			zoomPasscode: { type: String },
			floorImage: { type: String },
			mapUrl: { type: String },
			venueTitle: { type: String },
			location: { type: Object },
			addressLineOne: { type: String },
			addressLineTwo: { type: String },
			city: { type: Schema.Types.ObjectId, ref: 'cities' },
			state: { type: Schema.Types.ObjectId, ref: 'states' },
			country: { type: Schema.Types.ObjectId, ref: 'countries' },
			pincode: { type: Number },
			isLinkPublished: { type: Boolean, default: false },
		},

		floorPlan: {
			type: {
				type: String, enum: { values: ['PDF', 'IMAGE'], message: 'Invalid Floorplan type' }
			}, //image/pdf
			link: { type: String }
		},
		socials: {
			mail: { type: String }, //gmail/mail
			instagram: { type: String },
			website: { type: String },
			whatsApp: { type: String },
			youtube: { type: String },
			twitter: { type: String },
			linkedin: { type: String },
			yahoo: { type: String },
			hotmail: { type: String },
			facebook: { type: String },
			telegram: { type: String },
		},
		requestsAllowed: {
			type: Object,
			default: {
				MEDIA_PARTNER: true,
				SPEAKER: true,
				SPONSOR: true,
				EXHIBITOR: true,
				VISITOR: true
			}
		},

		interestedUsers: {
			type: Number,
			default: 0
		},
		notInterestedUsers: {
			type: Number,
			default: 0
		},
		passActivatedStatus: { 
			isSponsorPassActivated: { type: Boolean, default: false }, 
			isSpeakerPassActivated: { type: Boolean, default: false }, 
			isMediaPassActivated: { type: Boolean, default: false }, 
			isExhibitorPassActivated: { type: Boolean, default: false }, 
			isVisitorPassActivated: { type: Boolean, default: false }, 
		},
		category: {
			type: String,
			enum: ["FREE","PAID"]
		},
		// isExclusiveEvent: { type: Boolean, default: false }, // to check weather event is free or paid, if exclusive then it's free

		// additionalInfo: [{
		// 	label: String,
		// 	type: { type: String, enum: ["Input", "Dropdown"] },
		// 	options: [],
		// 	placeholder: String,
		// 	value: String
		// }]
		
		// eventmanager: [
		// 	{
		// 		type: mongoose.Schema.Types.ObjectId,
		// 		ref: 'User'
		// 	},
		// 	{
		// 		default: []
		// 	}
		// ],
		// staff: [
		// 	{
		// 		type: mongoose.Schema.Types.ObjectId,
		// 		ref: 'User'
		// 	},
		// 	{
		// 		default: []
		// 	}
		// ],
		// marketingmanager: [
		// 	{
		// 		type: mongoose.Schema.Types.ObjectId,
		// 		ref: 'User'
		// 	},
		// 	{
		// 		default: []
		// 	}
		// ],
		// financemanager: [
		// 	{
		// 		type: mongoose.Schema.Types.ObjectId,
		// 		ref: 'User'
		// 	},
		// 	{
		// 		default: []
		// 	}
		// ],

	},
	{
		timestamps: true
	}
);

module.exports = mongoose.model('event', eventSchema);
