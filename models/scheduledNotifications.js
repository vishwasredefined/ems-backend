const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const scheduedNotificationSchema = new Schema({

	alertType: { type: String, enum: ['EMAIL', 'PUSH_NOTIFICATION'] },
	targetAttendees: { type: String, enum: ['ALL_APP_USERS', 'EVENT_SPECIFIC_USERS'] },
	targetUser: { type: String },
	targetUserType: { type: String },
	image: { type: String },
	message: { type: String },
	redirectionLink: { type: String },
	title: { type: String },
	eventIds: [
		{ type: Schema.Types.ObjectId, ref: 'event' },
		{
			default: []
		}
	],

	createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
	eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
	isSent: { type: Boolean, default: false },
	isRead: { type: Boolean, default: false },
	isDeleted: { type: Boolean, default: false },

}, { timestamps: true });

exports.scheduedNotifications = scheduedNotificationSchema

module.exports = mongoose.model('scheduedNotifications', scheduedNotificationSchema);
