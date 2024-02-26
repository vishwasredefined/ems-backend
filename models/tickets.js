const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ticketSchema = new Schema({

	eventId:{ type: Schema.Types.ObjectId, ref: 'event'},
	packageId:{ type: Schema.Types.ObjectId, ref: 'packages' },
	visitorId:{ type: Schema.Types.ObjectId, ref: 'visitors' },

	sponsorId:{ type: Schema.Types.ObjectId, ref: 'sponsors' },
	exhibitorId:{ type: Schema.Types.ObjectId, ref: 'exhibitors' },
	speakerId:{ type: Schema.Types.ObjectId, ref: 'speakers' },
	mediaPartnerId:{ type: Schema.Types.ObjectId, ref: 'medias' },
    ticketNo: { type: String, unique : true },
    isExpired: { type: Boolean, default : false },
	isValidated: { type: Boolean, default: false }
    
},{ timestamps: true });

module.exports = mongoose.model('tickets', ticketSchema);
