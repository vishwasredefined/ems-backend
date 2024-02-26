let mongoose = require('./db');

// grab the things we need
let Schema = mongoose.Schema;

var AttendeeLogsSchema = new Schema({
	attendeeId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'visitors'
	},
	eventId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'events'
	},
	logs: [
		{
			type: {type : String, enum: ['CHECKIN', 'CHECKOUT'] },
			timestamp: Date, default: Date.now
		}
	]
}, { timestamps: true });

const attendeeLogs = mongoose.model('attendeeLogs', AttendeeLogsSchema);

module.exports = attendeeLogs;