const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventQuestionsSchema = new Schema(
	{
        question: String, 
		type: { type: String, enum: ["Input", "Dropdown"], default: "Dropdown" },
		options: [],
		isRequired: { type: Boolean, default: false },
		answer: String,

		// Event related Details
		eventId: { type: Schema.Types.ObjectId, ref: 'event' },
		eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },

		// Status Information
		isActive: { type: Boolean, default: true },
		isDeleted: { type: Boolean, default: false }
	},
	{
		timestamps: true
	}
);
module.exports = mongoose.model('eventQuestions', eventQuestionsSchema);
