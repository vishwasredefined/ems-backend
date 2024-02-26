const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const questionsSchema = new Schema(
	{

        question: String, 

		// Applying User
		userId: { type: Schema.Types.ObjectId, ref: 'User' },

		// Event related Details
        agendaId :  { type: Schema.Types.ObjectId, ref: 'agendas' },
		eventId: { type: Schema.Types.ObjectId, ref: 'event' },
		eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },

		// Status Information
		isAccepted: { type: Boolean, default: true },
		isDeleted: { type: Boolean, default: false },
	},
	{
		timestamps: true
	}
);
module.exports = mongoose.model('questions', questionsSchema);
