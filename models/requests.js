const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const joinRequestSchema = new Schema({

	userId:{ type: Schema.Types.ObjectId, ref: 'User'},
	eventId:{ type: Schema.Types.ObjectId, ref: 'event'},
	packageId:{ type: Schema.Types.ObjectId, ref: 'packages'},
	eventAdminId:{ type: Schema.Types.ObjectId, ref: 'User'},
	country:{ type: Schema.Types.ObjectId, ref: 'countries'},
    joinAs: { type: String, enum: ['SPEAKER', 'SPONSOR', 'MEDIA_PARTNER', 'EXHIBITOR'] },
	joiningDetails: { type: Object },
	status: { type: String, enum: ['UNDER_REVIEW', 'REJECTED', 'PENDING'], default: 'PENDING' },
    name: { type: String },
    email: { type: String },
    businessEmail: { type: String },
	appRequest: { type: Boolean, default: false },
	logs: [
		{
			action: { type: String, enum: ['UNDER_REVIEW', 'REJECTED', 'PENDING'] },
			performedBy: { type: Schema.Types.ObjectId, ref: 'User'},
		}
	],
	isApplyingForSelf:  { type: Boolean, default: true },
    
},{ timestamps: true });
module.exports = mongoose.model('requests', joinRequestSchema);
