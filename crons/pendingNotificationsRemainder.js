require("../config/index");
const cron = require("node-cron");
const mongoose = require("mongoose");

//Models
const Users = require("../models/users");
const Notifications = require("../models/notifications");

//Helpers
const notify = require("../helpers/notification");

cron.schedule("*/5 * * * *", function () {
    //every 5 minute
    sendPendingNotificationsRemainder();
});

// sendPendingNotificationsRemainder();

async function sendPendingNotificationsRemainder() {

    try {

        let users = await Notifications.aggregate([
            {
                $match: {
                    userId: { $exists: true },
                    isSent: true,
                    isRead: false,
                    alertType: { $in: ["PUSH_NOTIFICATION", "PROFILE_COMPLETION_PUSH_NOTIFICATION"] }
                }
            },
            {
                $group: {
                    _id: "$userId",
                    // content: { $push: "$$ROOT" },
                    notificationsSize: { $sum: 1 }
                }
            },
            {
                $match: {
                    notificationsSize: { $gte: 3 }
                }
            }
        ]);

        console.log("Users Having more than 3 notifcations => ", users)

        users = users.map(e => {
            return mongoose.Types.ObjectId(e._id)
        });
        if(!users.length){
            console.log("No users are elligible for this notification.Returning...");
            return;
        };

        let allUsers = await Users.find({ _id: { $in: users } })
        console.log("allUsers => ", allUsers.length);


        let notficationsToSend = await getNotificationsToInsert(allUsers);
        if (!notficationsToSend.success) {
            console.log("Error....");
            return;
        };

        notficationsToSend = notficationsToSend.data;
        let insertNotifications = await Notifications.insertMany(notficationsToSend);
        console.log("\nNotifications inserted...", insertNotifications)

        let DTS = {
            findData: {
                alertType: "PENDING_NOTIFICATIONS_PUSH_NOTIFICATION",
                isSent: false
            }
        }
        let sendNotificationsRes = await sendNotifications(DTS);
        if (!sendNotificationsRes.success) {
            console.log("Error in sending....");
            return;
        };
        console.log("\n All Sent...");

    } catch (error) {
        console.log("Error...", error);
        return {
            success: false,
            data: error
        }
    }
};

async function getNotificationsToInsert(data) {

    try {
        let allUsers = data;
        let notficationsToSend = [];
        for (let i = 0; i < allUsers.length; i++) {


            let user = allUsers[i]; //SpecificUser
            console.log("\nProcessing User => ", user._id);

            let notificationObj = {
                alertType: 'PENDING_NOTIFICATIONS_PUSH_NOTIFICATION',
                targetUser: "ALL_USERS",
                // targetUserType: ,
                // redirectionLink:,
                // image: ,
                title: "You have 3+ notifications",
                message: "You have 3 new notifications! Stay in the loop with the latest updates.",
                subject: "You have 3 new notifications! Stay in the loop with the latest updates.",
                email: user.email,
                userId: user._id,
                isSent: false,
                isRead: false,
                isDeleted: false,
            };
            console.log(" Inserting Notification ...");
            notficationsToSend.push(notificationObj);
        }
        return {
            success: true,
            data: notficationsToSend,
            messgae: "Moddeled"
        }
    } catch (err) {
        return {
            success: false,
            data: err,
            messgae: "Error"
        }
    }
};

async function sendNotifications(data) {

    try {
        let findNotifications = data.findData;
        let allNotifications = await Notifications.find(findNotifications).populate("userId").sort({ createdAt: -1 });
        console.log("allNotifications => ", allNotifications.length)

        for (let i = 0; i < allNotifications.length; i++) {
            // if (i == 1) break;
            let isSuccess = false;
            let notification = allNotifications[i];
            console.log("\nProcessing Notifcation => ", notification._id);

            if (notification.userId && notification.userId.deviceInfo[0]) {

                let deviceTokens = notification.userId.deviceInfo;
                for (let j = 0; j < deviceTokens.length; j++) {

                    let element = deviceTokens[j];
                    console.log("User Device Token Platform...", element.platform);
                    if (element.platform == "ios" || element.platform == "android") {

                        let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                        if (notificationResponse.success) {
                            console.log("Notification sent => ", notificationResponse);
                            isSuccess = true;
                        } else {
                            console.log("Notification not sent");
                        }
                    }
                };
                if (isSuccess) {
                    await Notifications.findOneAndUpdate({ _id: notification._id }, { $set: { isSent: true } });
                    console.log("Notification Doc Updated...")
                }
            }
        };
        return {
            success: true,
            data: {},
            messgae: "Sent"
        }
    } catch (err) {
        return {
            success: false,
            data: err,
            messgae: "Error"
        }
    }
}