require("../config/index");
const db = require("../models/db");

const cron = require("node-cron");

//Models
require("../models/users");
require("../models/events");
const Notifications = require("../models/notifications");

//helpers
const notify = require("../helpers/notification");
const EmailService = require("../helpers/email");

const sendNotificationsJob = async function () {
	let findData = {
		isSent: false,
		isRead: false,
		isDeleted: false,
		alertType: "PUSH_NOTIFICATION",
	};
	Notifications.find(findData)
		.populate("userId")
		.exec(async (err, notificationRes) => {
			if (err) {
				console.error("Unable to get Notifications: ", err);
			}

			console.log("total unread/unsent notifications=======", notificationRes.length)
			for (i in notificationRes) {
				let iter = 0;
				let success = false;
				let userNotification = notificationRes[i];

				let payload = {};

				let notification = {
					message: userNotification.message,
					title: "",
					imageUrl: "",
				};
				if (userNotification.title) {
					notification["title"] = userNotification.title;
				}
				if (userNotification.image) {
					notification["imageUrl"] = userNotification.image;
				}
				if (userNotification.userId && userNotification.userId.deviceInfo[0]) {
					console.log("notification userId");
					let deviceTokens = userNotification.userId.deviceInfo;
					deviceTokens.forEach(async (element) => {
						console.log("user token");
						if (element.platform == "ios" || element.platform == "android") {
							console.log("token android ios", element.platform);
							let notifRes = await notify.sendSingleNotification(
								element.token,
								notification,
								payload
							);
							console.log("notification resp====", typeof notifRes, typeof i);
							if (notifRes.success) {
								console.log("notification sent");

								if (iter == 0) {
									iter += 1;
									console.log("update notification sent", userNotification._id, i);
									Notifications.updateOne(
										{ _id: userNotification._id },
										{ isSent: true },
										(err, res) => {
											if (err) {
												console.error(
													"Unable to update notification status",
													err
												);
											}
										}
									);
								}
							} else {
								console.log("notification not sent");
								//update db with false
							}
						}
					});
				}
			}
		});
};

const emailNotificationsToUsers = async function () {
	console.log("email notification");
	let findData = {
		isSent: false,
		isRead: false,
		isDeleted: false,
		alertType: "EMAIL",
	};
	Notifications.find(findData)
		.populate("userId")
		.exec(async (err, notificationRes) => {
			if (err) {
				console.error("Unable to get Notifications: ", err);
			}
			console.log("total email unread/unsent notifications=======", notificationRes.length)

			for (i in notificationRes) {
				let iter = 0;
				let success = false;
				let userNotification = notificationRes[i];

				if (userNotification.email) {
					let sendData = {
						email: userNotification.email,
						messages: userNotification.message,
						subjects: userNotification.subject,
						title: userNotification.title
					};

					let emailDataToSend = {
						emailData : sendData,
						userNotification : userNotification
					}
					let emailResponse = await sendEmailNotification(emailDataToSend)
					if(emailResponse.success){
						console.log("======email sent to user with email",userNotification.email )
					}else{
						console.log("======email not sent to user with email",userNotification.email )
					}
					// EmailService.sendEmailToUsers(sendData, (err, res) => {
					// 	if (err) {
					// 		console.log("error sending email====", err);
					// 	} else {
					// 		console.log("email sent====");
					// 		Notifications.updateOne(
					// 			{ _id: userNotification._id },
					// 			{ isSent: true },
					// 			(err, res) => {
					// 				if (err) {
					// 					console.error("Unable to update notification status", err);
					// 				}
					// 				console.log("======notif status updated=")
					// 			}
					// 		);
					// 	}
					// });
				}
			}
		});
};

const sendPushNotification = function (data) {
	return new Promise(function (resolve, reject) {

		//send notification

		//update notification

	});
};

const sendEmailNotification = function (emailSendData) {
	return new Promise(function (resolve, reject) {

		let emailData = emailSendData.emailData
		let userNotification = emailSendData.userNotification
		if(!emailData || !userNotification){
			resolve({
				success: false,
				message: "Email Data Missing"
			})
		}
		EmailService.sendEmailToUsers(emailData, (err, res) => {
			if (err) {
				console.log("error sending email====", err);
				resolve({
					success: false,
					message: "Email Notification Not Sent"
				})
			} else {
				console.log("email sent====");
				Notifications.updateOne(
					{ _id: userNotification._id },
					{ isSent: true },
					(err, res) => {
						if (err) {
							console.error("Unable to update notification status", err);
							resolve({
								success: false,
								message: "Email Notification Not updated"
							})
						}else{
							console.log("======notif status updated=",userNotification._id)
							resolve({
								success: true,
								message: "Email sent and Notification updated"
							})
						}
					}
				);
			}
		});

	});
};

cron.schedule("*/5 * * * *", function () {
	//every 5 minute
	sendNotificationsJob();
	//   emailNotificationsToUsers();
});