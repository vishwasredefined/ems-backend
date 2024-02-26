const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventInterestSchema = new Schema(
	{
		eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'event' },
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		interestType: { type: String, default: "INTERESTED" },
		isDeleted: { type: Boolean, default: false }
	},
	{
		timestamps: true
	}
);
module.exports = mongoose.model('eventInterest', eventInterestSchema);
