const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const bookmarkSchema = new Schema(
	{
		eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'event' },
		agendaId: { type: mongoose.Schema.Types.ObjectId, ref: 'agendas' },
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		date: { type: Date },
		startTime: { type: String },
		endTime: { type: String },
		isNotified: { type: Boolean, default: false },
		isActive: { type: Boolean, default: true },
		isDeleted: { type: Boolean, default: false }
	},
	{
		timestamps: true
	}
);
module.exports = mongoose.model('bookmarks', bookmarkSchema);
