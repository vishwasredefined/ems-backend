const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

const path = require("path");

//helper
const responseUtilities = require("../helpers/sendResponse");
const notify = require("../helpers/notification");

//models
const Notifications = require("../models/notifications");
const ScheduleNotifications = require("../models/scheduledNotifications");
const Speakers = require("../models/speakers");
const Sponsors = require("../models/speakers");
const Medias = require("../models/medias");
const Exhibitors = require("../models/exhibitors");
const Visitors = require("../models/visitors");
const Events = require("../models/events");
const Users = require("../models/users");

const role = JSON.parse(process.env.role);

//controllers
const events = require("../controllers/events"); 

//Contoller for adding Notification
exports.addNotifications = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.alertType || !data.targetUser || !data.title || !['PUSH_NOTIFICATION', 'EMAIL'].includes(data.alertType)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Params missing",
				"addNotification",
				null,
				data.req.signature
			)
		);
	}

	let waterFallFunctions = [];
	if (data.req.auth.role == role.marketingmanager) {
		waterFallFunctions.push(async.apply(findEventAdmin, data));
	}
	waterFallFunctions.push(async.apply(scheduleNotification, data));
	if (data.alertType == 'PUSH_NOTIFICATION') {
		waterFallFunctions.push(async.apply(addPushNotificationsForUsers, data));
		// return cb(
		// 	null,
		// 	responseUtilities.sendResponse(
		// 		200,
		// 		"Push notification added",
		// 		"addNotification",
		// 		null,
		// 		data.req.signature
		// 	)
		// );
	} else if (data.alertType == 'EMAIL') {
		waterFallFunctions.push(async.apply(addEmailNotificationsForUsers, data));
		// return cb(
		// 	null,
		// 	responseUtilities.sendResponse(
		// 		200,
		// 		"Email notification added",
		// 		"addNotification",
		// 		null,
		// 		data.req.signature
		// 	)
		// );
	} else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid notification type",
				"addNotification",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterFallFunctions, cb);

};

const scheduleNotification = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.alertType || !data.title) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Params missing",
				"addNotification",
				null,
				data.req.signature
			)
		);
	}

	let insertData = {
		alertType: data.alertType,
		targetUser: data.targetUser,
		message: data.message,
		title: data.title,
		createdBy: data.req.auth.id
	}
	if(data.targetAttendees){
		insertData.targetAttendees = data.targetAttendees
	}
	if (data.eventAdminId) {
		insertData.eventAdminId = data.eventAdminId
	}
	if (data.eventIds) {
		insertData.eventIds = data.eventIds
	}
	if (data.image) {
		insertData.image = data.image
	}
	if (data.redirectionLink) {
		insertData.redirectionLink = data.redirectionLink
	}
	if (data.targetUserType) {
		insertData["targetUserType"] = data.targetUserType
	}
	ScheduleNotifications.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to create notification: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"addNotification",
					null,
					data.req.signature
				)
			);
		}
		let scheduledNotification = JSON.parse(JSON.stringify(res))
		if (scheduledNotification._id) {

			delete scheduledNotification._id
		}
		data.scheduledNotification = scheduledNotification
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Notification scheduled",
				"addNotification",
				null,
				data.req.signature
			)
		);
	});
}

const addPushNotificationsForUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	// 'ALL_USERS', 'MEDIA_PARTNERS', 'SPEAKERS', 'SPONSORS', 'EXHIBITORS', 'ALL_EVENT_SPECIFIC_USERS'
	let targetUser = data.targetUser
	console.log("=========target user====", targetUser, typeof targetUser)
	let waterFallFunctions = [];
	if (data.targetUser == "ALL_USERS") {

		waterFallFunctions.push(async.apply(addPushNotificationsForAllUsers, data));
	} else if (targetUser == "SPEAKERS") {
		waterFallFunctions.push(async.apply(addPushNotificationsForSpeakers, data));
	} else if (targetUser == 'SPONSORS') {
		waterFallFunctions.push(async.apply(addPushNotificationsForSponsors, data));
	} else if (targetUser == 'MEDIA_PARTNERS') {
		waterFallFunctions.push(async.apply(addPushNotificationsForMedias, data));
	} else if (targetUser == 'EXHIBITORS') {
		waterFallFunctions.push(async.apply(addPushNotificationsForExhibitors, data));
	} else if (targetUser == 'ATTENDEES' || targetUser == 'VISITOR') {
		waterFallFunctions.push(async.apply(addPushNotificationsForAttendees, data));
	} else if (targetUser == 'ALL_EVENT_SPECIFIC_USERS') {
		waterFallFunctions.push(async.apply(addPushNotificationsForSpeakers, data));
		waterFallFunctions.push(async.apply(addPushNotificationsForSponsors, data));
		waterFallFunctions.push(async.apply(addPushNotificationsForMedias, data));
		waterFallFunctions.push(async.apply(addPushNotificationsForExhibitors, data));
		waterFallFunctions.push(async.apply(addPushNotificationsForAttendees, data));

	} else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid targer user",
				"addNotification",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterFallFunctions, cb);
}

const addEmailNotificationsForUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let targetUser = data.targetUser
	console.log("=========target user====", targetUser, typeof targetUser)
	let waterFallFunctions = [];
	if (data.targetUser == "ALL_USERS") {

		waterFallFunctions.push(async.apply(addEmailNotificationsForAllUsers, data));
	} else if (targetUser == "SPEAKERS") {
		waterFallFunctions.push(async.apply(addEmailNotificationsForSpeakers, data));
	} else if (targetUser == 'SPONSORS') {
		waterFallFunctions.push(async.apply(addEmailNotificationsForSponsors, data));
	} else if (targetUser == 'MEDIA_PARTNERS') {
		waterFallFunctions.push(async.apply(addEmailNotificationsForMedias, data));
	} else if (targetUser == 'EXHIBITORS') {
		waterFallFunctions.push(async.apply(addEmailNotificationsForExhibitors, data));
	} else if (targetUser == 'ATTENDEES' || targetUser == "VISITOR") {
		waterFallFunctions.push(async.apply(addEmailNotificationsForAttendees, data));
	} else if (targetUser == 'ALL_EVENT_SPECIFIC_USERS') {
		waterFallFunctions.push(async.apply(addEmailNotificationsForSpeakers, data));
		waterFallFunctions.push(async.apply(addEmailNotificationsForSponsors, data));
		waterFallFunctions.push(async.apply(addEmailNotificationsForMedias, data));
		waterFallFunctions.push(async.apply(addEmailNotificationsForExhibitors, data));
		waterFallFunctions.push(async.apply(addEmailNotificationsForAttendees, data));

	} else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid targer user",
				"addNotification",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterFallFunctions, cb);
}

exports.getAllNotificationsForAdmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let waterFallFunctions = [];
	if (data.req.auth.role == role.marketingmanager) {
		waterFallFunctions.push(async.apply(findEventAdmin, data));
	}
	waterFallFunctions.push(async.apply(getAllNotifications, data));
	async.waterfall(waterFallFunctions, cb);
}

//Contoller for getting all speakers
const getAllNotifications = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		// "$or" : [{ createdBy: data.req.auth.id }, { eventAdminId: data.req.auth.id }]
	};

	// if(data.req.auth.role == role.marketingmanager){
	// 	if (!data.eventAdminId) {
	// 		return cb(
	// 			responseUtilities.sendResponse(
	// 				400,
	// 				"No Notifications found",
	// 				"getAllNotifications",
	// 				null,
	// 				data.req.signature
	// 			)
	// 		);
	// 	}
	// 	findData.eventAdminId = data.eventAdminId
	// }else{
	// }
	findData.createdBy = data.req.auth.id

	if (data.eventId) {
		if (!mongoose.Types.ObjectId.isValid(data.eventId)) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid event id",
					"getpackages",
					null,
					data.req.signature
				)
			);
		}
		findData.eventIds = data.eventId
	}

	ScheduleNotifications.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for speakers: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllPackages",
					null,
					null
				)
			);
		}
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (data.currentPage) {
			skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
		}
		ScheduleNotifications.find(findData)
			.skip(skip)
			.limit(limit)
			.populate('eventIds')
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get Notifications: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllNotifications",
							null,
							null
						)
					);
				}
				let sendData = {
					data: res,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"All Notifications fetched for admin",
						"getAllNotifications",
						sendData,
						null
					)
				);
			});
	});
};

const addPushNotificationsForAllUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	let findData = { isBlocked: false };

	console.log("================schedule data=======", scheduledNotification)
	Users.find(findData)
		.populate('userId')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get users: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let users = JSON.parse(JSON.stringify(res));
			if (users && users.length) {
				let insertData = [];

				for (let i in users) {
					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.userId = users[i]._id;
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == users.length) {
						console.log("============final inser data for notification", insertData)
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Speakers Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addPushNotificationsForSpeakers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	console.log("=====scheduling speaker notifications==")
	let scheduledNotification = data.scheduledNotification;
	let findData = { isActive: true, isDeleted: false, userId: { $exists: true } };
	// if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
	// 	let eventIds = (scheduledNotification.eventIds)
	// 	eventIds = eventIds.map((el) => mongoose.Types.ObjectId(el))
	// 	findData.eventId = { $in: eventIds }
	// }
	let status = { $in: ["ASSIGNED", "UNDER_REVIEW"] }
	let targetUserType = scheduledNotification.targetUserType
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			// findData.status = "ASSIGNED"
			status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			// findData.status = "UNDER_REVIEW"
			status = "UNDER_REVIEW"
		}
	}
	console.log("status ", status)
	// let pipeline = [
	// 	{
	// 		$match: findData
	// 	},
	// 	{
	// 		$group: {
	// 			_id: "$userId"
	// 		},
	// 	},
	// 	{
	// 		"$lookup": {
	// 			from: "users",
	// 			localField: "_id",
	// 			foreignField: "_id",
	// 			as: "users"
	// 		}
	// 	},
	// 	{
	// 		$unwind: {
	// 			path: "$users"
	// 		}
	// 	},
	// 	{
	// 		$project: {
	// 			_id: 0,
	// 			userId: "$users"
	// 		}
	// 	}
	// ]
	// Speakers.aggregate(pipeline)
	Speakers.distinct('userId', { isActive: true, isDeleted: false, userId: { $exists: true }, status: status, eventId: { "$in": data.eventIds } })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			console.log("===========distinct userId==============", res)
			let speakers = JSON.parse(JSON.stringify(res));
			console.log("==========no of speakers====", speakers)
			if (speakers && speakers.length) {
				let insertData = [];

				for (let i in speakers) {
					// if (speakers[i].userId) {
					// 	console.log("==========speaker userId========", speakers[i].userId._id)
					// }
					// if (speakers[i].userId && (!scheduledNotification.eventIds || !scheduledNotification.eventIds.length || speakers[i].userId.eventNotificationPreference)) {
					if (speakers[i] && (speakers[i] !== null)) {
						let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

						// notificationRes.userId = speakers[i].userId._id;
						notificationRes.userId = speakers[i];
						insertData.push(notificationRes);
						console.log("==========speakers no====", i)

					}
					if (parseInt(i) + 1 == speakers.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Speakers Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addPushNotificationsForSponsors = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	// let findData = { isActive: true, isDeleted: false, userId: { $exists: true } }; //
	// if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
	// 	let eventIds = (scheduledNotification.eventIds)
	// 	eventIds = eventIds.map((el) => mongoose.Types.ObjectId(el))
	// 	findData.eventId = { $in: eventIds }
	// }
	// let eventId = scheduledNotification.eventIds[0]+"";
	// console.log("eventIds ", eventId)
	// eventId  =  mongoose.Types.ObjectId(eventId);
	// let eventId  =  mongoose.Types.ObjectId(data.eventIds[0]);
	// findData.eventId = eventId;
	// console.log("eventId ", eventId);
	
	let targetUserType = scheduledNotification.targetUserType
	let  status = { $in: ["ASSIGNED", "UNDER_REVIEW"] }
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			status = "UNDER_REVIEW"
		}
	}	
	console.log("status ", status)

	// let pipeline = [
	// 	{
	// 		$match: { isActive: true, isDeleted: false, userId: { $exists: true }, status: status, eventId: mongoose.Types.ObjectId(data.eventIds[0]) }
	// 	},
	// 	{
	// 		$group: {
	// 			_id: "$userId"
	// 	},
	// 	},
	// 	{
	// 		"$lookup": {
	// 			from: "users",
	// 			localField: "_id",
	// 			foreignField: "_id",
	// 			as: "users"
	// 		}
	// 	},
	// 	{
	// 		$unwind: {
	// 			path: "$users"
	// 		}
	// 	},
	// 	{
	// 		$project: {
	// 			_id: 0,
	// 			userId: "$users"
	// 		}
	// 	}
	// ]
	// Sponsors.aggregate(pipeline)
	let res = await Sponsors.distinct('userId', { isActive: true, isDeleted: false, userId: { $exists: true }, status: status, eventId: { "$in": data.eventIds }})
		// .exec((err, res) => {
		// 	if (err) {
		// 		console.error("Unable to get Sponsors: ", err);
		// 		return cb(
		// 			responseUtilities.sendResponse(
		// 				500,
		// 				null,
		// 				"addPushNotificationsForSpeakers",
		// 				null,
		// 				null
		// 			)
		// 		);
		// 	}
			let sponsors = JSON.parse(JSON.stringify(res));
			console.log("sponsors length ", sponsors);
			if (sponsors && sponsors.length) {
				let insertData = [];

				for (let i in sponsors) {
					// if (sponsors[i].userId && (!scheduledNotification.eventIds || !scheduledNotification.eventIds.length || sponsors[i].userId.eventNotificationPreference)) {
					if (sponsors[i] && (sponsors[i] !== null)) {
						let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

						// notificationRes.userId = sponsors[i].userId._id;
						notificationRes.userId = sponsors[i];
						insertData.push(notificationRes);
					}
					if (parseInt(i) + 1 == sponsors.length) {
						console.log("insertData length ", insertData.length);
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Sponsors Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		// });
}

const addPushNotificationsForMedias = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	// let findData = { isActive: true, isDeleted: false, userId: { $exists: true } };
	// if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
	// 	let eventIds = (scheduledNotification.eventIds)
	// 	eventIds = eventIds.map((el) => mongoose.Types.ObjectId(el))
	// 	findData.eventId = { $in: eventIds }
	// }

	let targetUserType = scheduledNotification.targetUserType
	let  status = { $in: ["ASSIGNED", "UNDER_REVIEW"] }
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			status = "UNDER_REVIEW"
		}
	}

	// let pipeline = [
	// 	{
	// 		$match: findData
	// 	},
	// 	{
	// 		$group: {
	// 			_id: "$userId"
	// 		},
	// 	},
	// 	{
	// 		"$lookup": {
	// 			from: "users",
	// 			localField: "_id",
	// 			foreignField: "_id",
	// 			as: "users"
	// 		}
	// 	},
	// 	{
	// 		$unwind: {
	// 			path: "$users"
	// 		}
	// 	},
	// 	{
	// 		$project: {
	// 			_id: 0,
	// 			userId: "$users"
	// 		}
	// 	}
	// ]
	// Medias.aggregate(pipeline)
	Medias.distinct('userId', { isActive: true, isDeleted: false, userId: { $exists: true }, status: status, eventId: { "$in": data.eventIds } })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let medias = JSON.parse(JSON.stringify(res));
			if (medias && medias.length) {
				let insertData = [];

				for (let i in medias) {
					// if (medias[i].userId && (!scheduledNotification.eventIds || !scheduledNotification.eventIds.length || medias[i].userId.eventNotificationPreference)) {
					if (medias[i] && (medias[i] !== null)) {
						let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

						// notificationRes.userId = medias[i].userId._id;
						notificationRes.userId = medias[i];
						insertData.push(notificationRes);

					}
					if (parseInt(i) + 1 == medias.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Media-partner Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No medias to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addPushNotificationsForExhibitors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	// let findData = { isActive: true, isDeleted: false, userId: { $exists: true } };
	// if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
	// 	let eventIds = (scheduledNotification.eventIds)
	// 	eventIds = eventIds.map((el) => mongoose.Types.ObjectId(el))
	// 	findData.eventId = { $in: eventIds }
	// }

	let targetUserType = scheduledNotification.targetUserType
	let  status = { $in: ["ASSIGNED", "UNDER_REVIEW"] }
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			status = "UNDER_REVIEW"
		}
	}

	// let pipeline = [
	// 	{
	// 		$match: findData
	// 	},
	// 	{
	// 		$group: {
	// 			_id: "$userId"
	// 		},
	// 	},
	// 	{
	// 		"$lookup": {
	// 			from: "users",
	// 			localField: "_id",
	// 			foreignField: "_id",
	// 			as: "users"
	// 		}
	// 	},
	// 	{
	// 		$unwind: {
	// 			path: "$users"
	// 		}
	// 	},
	// 	{
	// 		$project: {
	// 			_id: 0,
	// 			userId: "$users"
	// 		}
	// 	}
	// ]
	// Exhibitors.aggregate(pipeline)

	Exhibitors.distinct('userId', { isActive: true, isDeleted: false, userId: { $exists: true }, status: status, eventId: { "$in": data.eventIds } })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Exhibitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let exhibitors = JSON.parse(JSON.stringify(res));
			if (exhibitors && exhibitors.length) {
				let insertData = [];

				for (let i in exhibitors) {
					// if (exhibitors[i].userId && (!scheduledNotification.eventIds || !scheduledNotification.eventIds.length || exhibitors[i].userId.eventNotificationPreference)) {
					if (exhibitors[i] && (exhibitors[i] !== null)) {
						let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

						// notificationRes.userId = exhibitors[i].userId._id;
						notificationRes.userId = exhibitors[i];
						insertData.push(notificationRes);
						if (parseInt(i) + 1 == exhibitors.length) {
							Notifications.insertMany(insertData, (err, response) => {
								if (err) {
									console.error("Unable to add notification: ", err);
									return cb(
										responseUtilities.sendResponse(
											500,
											null,
											"addPushNotificationsForSpeakers",
											null,
											null
										)
									);
								}
								return cb(
									null,
									responseUtilities.sendResponse(
										200,
										"Exhibitors Notifications added",
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);

							});
						}
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No exhibitors to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addPushNotificationsForAttendees = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	// let findData = { isBlocked: false, isDeleted: false, isPackagePurchased: true, userId: { $exists: true } };
	// if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
	// 	let eventIds = (scheduledNotification.eventIds)
	// 	eventIds = eventIds.map((el) => mongoose.Types.ObjectId(el))
	// 	findData.eventId = { $in: eventIds }
	// }
	// if(scheduledNotification.targetUserType == "ALL"){
	// 	findData.status = { "$in": ['Waitlisted','Approved'] }
	// }else{
	// 	findData.status = (scheduledNotification.targetUserType == "ASSIGNED") ? "Approved": "Waitlisted"
	// }

	let targetUserType = scheduledNotification.targetUserType
	let  status = { $in: ["Waitlisted", "Approved"] }
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			status = "Approved"
		} else if (targetUserType == "UNASSIGNED") {
			status = "Waitlisted"
		}
	}

	/*
	let pipeline = [
		{
			$match: findData
		},
		{
			$group: {
				_id: "$userId"
			},
		},
		{
			"$lookup": {
				from: "users",
				localField: "_id",
				foreignField: "_id",
				as: "users"
			}
		},
		{
			$unwind: {
				path: "$users"
			}
		},
		{
			$project: {
				_id: 0,
				userId: "$users"
			}
		}
	]
	Visitors.aggregate(pipeline)
	*/
	// Visitors.find(findData)

	Visitors.distinct('userId', { isBlocked: false, isDeleted: false, isPackagePurchased: true, userId: { $exists: true }, status: status, eventId: { "$in": data.eventIds } })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Visitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let visitors = JSON.parse(JSON.stringify(res));
			if (visitors && visitors.length) {
				let insertData = [];
				for (let i in visitors) {
					// if (visitors[i].userId && (!scheduledNotification.eventIds || !scheduledNotification.eventIds.length || visitors[i].userId.eventNotificationPreference)) {
					// if (visitors[i].userId) {
					if (visitors[i] && (visitors[i] !== null)) {
						let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

						notificationRes.userId = visitors[i];
						insertData.push(notificationRes);
					}
					if (parseInt(i) + 1 == visitors.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Visitors Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

//email notification
const addEmailNotificationsForAllUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	let findData = { isBlocked: false };

	Users.find(findData)
		.populate('userId')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get users: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let users = JSON.parse(JSON.stringify(res));
			if (users && users.length) {
				let insertData = [];

				for (let i in users) {
					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.userId = users[i]._id;
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == users.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Speakers Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addEmailNotificationsForSpeakers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	console.log("=====scheduling speaker notifications==")
	let scheduledNotification = data.scheduledNotification;
	let findData = { isActive: true, isDeleted: false };
	if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
		let eventIds = (scheduledNotification.eventIds)
		// eventIds = eventIds.map((el)=>mongoose.Types.ObjectId(el))
		findData.eventId = { $in: eventIds }
	}

	let targetUserType = scheduledNotification.targetUserType
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			findData.status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			findData.status = "UNDER_REVIEW"
		}
	}

	Speakers.distinct('email', findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let speakers = JSON.parse(JSON.stringify(res));
			console.log("==========no of speakers====", speakers.length, speakers)
			if (speakers && speakers.length) {
				let insertData = [];

				for (let i in speakers) {

					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.email = speakers[i];
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == speakers.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Speakers Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addEmailNotificationsForSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	let findData = { isActive: true, isDeleted: false };
	if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
		findData.eventId = { $in: scheduledNotification.eventIds }
	}

	let targetUserType = scheduledNotification.targetUserType
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			findData.status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			findData.status = "UNDER_REVIEW"
		}
	}

	Sponsors.distinct('email', findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Sponsors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let sponsors = JSON.parse(JSON.stringify(res));
			if (sponsors && sponsors.length) {
				let insertData = [];

				for (let i in sponsors) {
					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.email = sponsors[i];
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == sponsors.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Sponsors Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addEmailNotificationsForMedias = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	let findData = { isActive: true, isDeleted: false };
	if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
		findData.eventId = { $in: scheduledNotification.eventIds }
	}

	let targetUserType = scheduledNotification.targetUserType
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			findData.status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			findData.status = "UNDER_REVIEW"
		}
	}

	Medias.distinct('email', findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let medias = JSON.parse(JSON.stringify(res));
			if (medias && medias.length) {
				let insertData = [];

				for (let i in medias) {
					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.email = medias[i];
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == medias.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Media-partner Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No medias to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addEmailNotificationsForExhibitors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	let findData = { isActive: true, isDeleted: false };
	if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
		findData.eventId = { $in: scheduledNotification.eventIds }
	}

	let targetUserType = scheduledNotification.targetUserType
	if (targetUserType) {
		if (targetUserType == "ASSIGNED") {
			findData.status = "ASSIGNED"
		} else if (targetUserType == "UNASSIGNED") {
			findData.status = "UNDER_REVIEW"
		}
	}

	Exhibitors.distinct('email', findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Exhibitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let exhibitors = JSON.parse(JSON.stringify(res));
			if (exhibitors && exhibitors.length) {
				let insertData = [];

				for (let i in exhibitors) {
					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.email = exhibitors[i];
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == exhibitors.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Exhibitors Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No exhibitors to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}

const addEmailNotificationsForAttendees = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let scheduledNotification = data.scheduledNotification;
	let findData = { isBlocked: false, isDeleted: false, isPackagePurchased: true };
	if (scheduledNotification.eventIds && scheduledNotification.eventIds.length) {
		let eventIds = (scheduledNotification.eventIds)
		eventIds = eventIds.map((el) => mongoose.Types.ObjectId(el))
		findData.eventId = { $in: eventIds }
	}
	if(scheduledNotification.targetUserType == "ALL"){
		findData.status = { "$in": ['Waitlisted','Approved'] }
	}else{
		findData.status = (scheduledNotification.targetUserType == "ASSIGNED") ? "Approved": "Waitlisted"
	}
	Visitors.distinct('email', findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Visitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let visitors = JSON.parse(JSON.stringify(res));
			if (visitors && visitors.length) {
				let insertData = [];

				for (let i in visitors) {
					let notificationRes = JSON.parse(JSON.stringify(scheduledNotification));

					notificationRes.email = visitors[i];
					insertData.push(notificationRes);
					if (parseInt(i) + 1 == visitors.length) {
						Notifications.insertMany(insertData, (err, response) => {
							if (err) {
								console.error("Unable to add notification: ", err);
								return cb(
									responseUtilities.sendResponse(
										500,
										null,
										"addPushNotificationsForSpeakers",
										null,
										null
									)
								);
							}
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"Visitors Notifications added",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);

						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
}




/* contoller for  Notification for admin */
exports.getAllNotificationForAdmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = { isDeleted: false };
	if (data.targetUser) {
		findData.targetUser = data.targetUser
	}
	Notifications.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for Notifications: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllNotificationForAdmin",
					null,
					null
				)
			);
		}
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (!data.currentPage) {
			data.currentPage = Math.ceil(count / limit);
		}
		skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
		let populate = [
			{
				path: "userId"
			},
			{
				path: "programScheduleId",
				populate: {
					path: "categoryId programId",
				},
				select: {
					_id: 1,
					programType: 1,
					categoryId: 1,
					programId: 1,
					title: 1,
					programDescription: 1,
				},
			},
		];
		Notifications.find(findData)
			.skip(skip)
			.limit(limit)
			.populate(populate)
			.sort({ createdAt: 1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get Notifications: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllNotificationForAdmin",
							null,
							null
						)
					);
				}
				let sendData = {
					data: res,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						responseMessages.FETCH_ALL_NOTIFICATIONS_ADMIN,
						"getAllNotificationForAdmin",
						sendData,
						null
					)
				);
			});
	});
};

//Contoller for notification by id
exports.getNotificationByUserId = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		userId: data.req.auth.id,
		isDeleted: false,
	};
	let findUser = { _id: data.req.auth.id };
	Notifications.findOne(findUser).exec((err, user) => {
		if (err) {
			console.error("Unable to get User: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getNotificationByUserId",
					null,
					null
				)
			);
		}
		let waterFallFunctions = [];
		if (!user.eventNotificationPreference && !user.feedNotificationPreference) {
			findData.targetUser = "All User";
			data.findData = findData;
		} else if (!user.eventNotificationPreference) {
			findData.targetUser = "All User";
			data.findData = findData;
		} else {
			data.findData = findData;
		}
		waterFallFunctions.push(async.apply(getUserNotification, data));
		async.waterfall(waterFallFunctions, cb);
	});
};

const getUserNotifications = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		userId: data.req.auth.id,
		alertType: { $ne: "EMAIL_NOTIFICATION" },
		// isSent: true,
		isDeleted: false
	};

	if (data.eventId) {
		findData.eventIds = data.eventId
	}


	console.log("Find Notifcations => ", findData)
	Notifications.find(findData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Notifications: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getUserNotifications",
						null,
						null
					)
				);
			}
			let sendData = {
				data: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All User Notifications fetched",
					"getUserNotifications",
					sendData,
					null
				)
			);
		});
}

exports.getUserNotifications = getUserNotifications;

/**
 * 
 * @param {*} data 
 * @param {*} response 
 * @param {*} cb 
 * @description get unread notifications count
 */
exports.userGetUnreadNotificationsCount = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		userId: data.req.auth.id,
		alertType: "PUSH_NOTIFICATION",
		// isSent: true,
		isDeleted: false,
		isRead: false
	};

	console.log("Find Notifications count for user => ", findData)
	Notifications.countDocuments(findData).exec((err, res) => {
		if (err) {
			console.error("Unable to get Notifications count : ", err);
			return cb(responseUtilities.sendResponse(500, null, "userGetUnreadNotificationsCount", null, null));
		}
		let DTS = { count: res }
		return cb(null, responseUtilities.sendResponse(200, "All User Notifications count fetched", "userGetUnreadNotificationsCount", DTS, null));
	});
}

/* contoller for read notification */
exports.readNotifications = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		userId: data.req.auth.id,
		// isSent: true
	};
	if (data.notificationId) {
		findData._id = data.notificationId
	}
	let updateData = {
		isRead: true,
	};

	console.log("===========read notification find data==", findData)
	Notifications.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update notification status", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"readNotifications",
					null,
					null
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Notifications updated",
				"readNotifications",
				null,
				null
			)
		);
	});
};

/* contoller for read notification */
exports.deleteNotification = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.notificationId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Params missing",
				"deleteNotification",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		userId: data.req.auth.id,
		_id: data.notificationId
	};

	let updateData = {
		isDeleted: true,
	};

	console.log("===========read notification find data==", findData)
	Notifications.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update notification status", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"deleteNotification",
					null,
					null
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Notification deleted",
				"deleteNotification",
				null,
				null
			)
		);
	});
};

const findEventAdmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}


	let findData = {
		_id: data.req.auth.id
	}
	Users.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get User: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findEventAdmin",
						null,
						null
					)
				);
			}
			data.eventAdminId = (res && res.eventAdminId) || null
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Finding eventAdmin",
					"findEventAdmin",
					null,
					null
				)
			);
		});
}

/* contoller for read notification */
exports.sendMultipleNotification = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = { role: "user", isActive: true, isBlocked: false, "deviceInfo.0": { "$exists": true } };
	Users.find(findData, { deviceInfo: 1,_id :0 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get users: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
			let users = JSON.parse(JSON.stringify(res));
			if (users && users.length) {
				users = users.reduce((acc, array) => acc.concat(array.deviceInfo), []);
				let tokens = [];
				for (let i in users) {
					tokens.push(users[i].token);
					let notification = {
						title: "Test bulk notify",
						message: "Test bulk notify all users"
					}
					let payload = {}
					if (parseInt(i) + 1 == users.length) {
						notify.sendBulkNotifications(tokens,notification,payload)
						.then((response) => {
							console.log('Notifications sent successfully:', response);
							return cb(
								null,
								responseUtilities.sendResponse(
									200,
									"All users Notifications sent",
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);
						})
						.catch((error) => {
							console.error('Error sending notifications:', error);
							return cb(
								responseUtilities.sendResponse(
									500,
									null,
									"addPushNotificationsForSpeakers",
									null,
									null
								)
							);
						});
					}
				}

			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"No speakers to be notified",
						"addPushNotificationsForSpeakers",
						null,
						null
					)
				);
			}
		});
};