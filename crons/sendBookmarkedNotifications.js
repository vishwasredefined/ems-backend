require("../config/index");
const db = require("../models/db");

const cron = require("node-cron");

//Models
require("../models/agendas");
require("../models/events");
require("../models/users");

const Bookmarks = require("../models/bookmarks");

//helpers
const notify = require("../helpers/notification");

cron.schedule("*/5 * * * *", function () {
	//every 5 minute
	sendBookMarkNotificationsJob();
});

// sendBookMarkNotificationsJob();

const sendBookMarkNotificationsJob = async function () {
	let findData = {
		isActive : true,
		isSent : false
	};
	Bookmarks.find(findData)
		.populate("userId agenda")
		.exec(async (err, bookmarkRes) => {
			if (err) {
				console.error("Unable to get Bookmarks: ", err);
			}

			console.log("Total unread/unsent Bookmarks=>", bookmarkRes.length)
			for (i in bookmarkRes) {
				let iter = 0;
				let success = false;
				let userBookmark = bookmarkRes[i];

				let payload = {};

				let notification = {
					message: userBookmark.message,
					title: "",
					imageUrl: "",
				};
				if (userBookmark.title) {
					notification["title"] = userBookmark.title;
				}
				if (userBookmark.image) {
					notification["imageUrl"] = userBookmark.image;
				}
				if (userBookmark.userId && userBookmark.userId.deviceInfo[0]) {
					console.log("notification userId");
					let deviceTokens = userBookmark.userId.deviceInfo;
					deviceTokens.forEach(async (element) => {
						console.log("user token");
						if (element.platform == "ios" || element.platform == "android") {
							console.log("token android ios", element.platform);
							let notifRes = await notify.sendSingleNotification(
								element.token,
								notification,
								payload
							);
							console.log("Bookmarks notification resp====", typeof notifRes, typeof i);
							if (notifRes.success) {
								console.log("Bookmarks notification sent");

								if (iter == 0) {
									iter += 1;
									console.log("Bookmarks sent", userBookmark._id, i);
									Bookmarks.updateOne(
										{ _id: userBookmark._id },
										{ isSent: true },
										(err, res) => {
											if (err) {
												console.error(
													"Unable to update Bookmarks status",
													err
												);
											}
										}
									);
								}
							} else {
								console.log("Bookmarks notification not sent");
								//update db with false
							}
						}
					});
				}
			}
		});
};
