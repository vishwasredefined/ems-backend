const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const agendaSchema = new Schema({

	eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'event' },
	arenaId: { type: mongoose.Schema.Types.ObjectId, ref: 'arena' },

	// stageLocation: { type: String },
	sessionType: { type: String },
	title: { type: String },
	date: { type: Date },
	startTime: { type: String },
	endTime: { type: String },
	speakers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'speakers' }],
	isDeleted: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },

	description: String,
    eventAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }

}, { timestamps: true });

module.exports = mongoose.model('agendas', agendaSchema);
