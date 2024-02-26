const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const notificationSchema = new Schema({

	alertType: { type: String, enum: ['EMAIL', 'PUSH_NOTIFICATION', 'PROFILE_COMPLETION_PUSH_NOTIFICATION',"PENDING_NOTIFICATIONS_PUSH_NOTIFICATION"] },
	targetUser: { type: String },
	targetUserType: { type: String },
	redirectionLink: { type: String },
	image: { type: String },
	title: { type: String },
	message: { type: String },
	subject: { type: String },
	email: { type: String },
	userId: { type: Schema.Types.ObjectId, ref: 'User' },
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

exports.notifications = notificationSchema

module.exports = mongoose.model('notifications', notificationSchema);
