require("../config/index");
const cron = require("node-cron");

//Models
const Users = require("../models/users");
const Notifications = require("../models/notifications");
const Visitors = require("../models/visitors");
const Events = require("../models/events");


//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 0 * * *", function () {
    //every 1 day
    console.log("paymentReminderNotification working...");
    paymentReminderNotification();
});

// paymentReminderNotification();

async function paymentReminderNotification() {
    try {
        let current_date = new Date();
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()) || 0))).setUTCHours(23,59,59,999));
        console.log(endDate)

        let eventData = await Events.distinct("_id", { endDate: { $gte: endDate }, expired: false, isActive:true, isDeleted: false }).lean();
        console.log("eventData ", eventData);
        let allVisitors = await Visitors.aggregate([
            {
                $match: {  eventId: { $in: eventData, $exists: true }, isPackagePurchased: false, userId: { $exists: true } }
            },
            {
                $group: {
                    "_id": {"userId": "$userId", "eventId": "$eventId"},
                    // "bookmarkDetails": { $push: "$$ROOT" },
                    // "visitor": { $first: "$$ROOT" },
                }
            },
            {
                $match : {
                    "_id.userId": { $ne: null },
                    "_id.eventId": { $ne: null }
                }
            },
            {
                $lookup: {
                    from: "events",
                    localField: "_id.eventId",
                    foreignField: "_id",
                    as: "events"
                }
            },
            { $unwind: { path: "$events", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "_id.userId",
                    foreignField: "_id",
                    as: "users"
                }
            },
            { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    "_id": 1,
                    "users._id": 1,
                    "users.deviceInfo": 1,
                    "users.email": 1,
                    "events.name": 1,
                }
            }
        ])
        // console.log("allVisitors ", allVisitors);
            
        if(allVisitors.length > 0){
            let notficationsToSend = await getNotificationsToInsert(allVisitors);
            // console.log("notficationsToSend ", notficationsToSend.data)
            if (!notficationsToSend.success) {
                console.log("Error....");
                return;
            };

            notficationsToSend = notficationsToSend.data;
            if(!notficationsToSend.length){
                console.log("No users are elligible for this notification.Returning...");
                return;
            };

            let sendNotificationsRes = await sendNotifications(notficationsToSend);
            if (!sendNotificationsRes.success) {
                console.log("Error in sending....");
                return;
            };
        }
        console.log("\n All Sent...");

    } catch (error) {
        console.log("Error...", error);
        return {
            success: false,
            data: error
        }
    }
};

async function getNotificationsToInsert(allUsers) {

    try {
        let notficationsToSend = [];
        for (let i = 0; i < allUsers.length; i++) {
            let user = allUsers[i]; //SpecificUser
            // console.log("user", user);
            if(user.users && user.users._id && (user.users.deviceInfo[0]) && user.events && user.events.name){
                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `Payment not done!`,
                    message: `Your seat at ${user.events.name} awaits! Finalize your ticket purchase to confirm your spot.`,
                    email: user.users.email,
                    userId: user.users._id,
                    isSent: false,
                    isRead: false,
                    isDeleted: false
                };
                // console.log(" Inserting Notification ...", notificationObj);

                let insertedId = await Notifications.create(notificationObj)
                // console.log(insertedId)
                notficationsToSend.push(insertedId._id);
            }
        };
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

 async function sendNotifications(notiId) {
    try {
        let notificationIds = notiId;
        // console.log("Notification ids ", notificationIds)
        let allNotifications = await Notifications.find({ _id: { $in: notificationIds } }).populate("userId").sort({ createdAt: -1 });
        console.log("allNotifications => ", allNotifications.length)
        if(allNotifications.length > 0){
            for (let i = 0; i < allNotifications.length; i++) {
                let isSuccess = false;
                let notification = allNotifications[i];
                // console.log("\nProcessing Notifcation => ", notification._id);

                if (notification.userId && notification.userId.deviceInfo[0]) {
                    let deviceTokens = notification.userId.deviceInfo;
                    for (let j = 0; j < deviceTokens.length; j++) {
                        let element = deviceTokens[j];
                        console.log("User Device Token Platform...", element.platform);
                        if (element.platform == "ios" || element.platform == "android") {
                            // console.log("device_token ", element.token);
                            let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                            if (notificationResponse.success) {
                                console.log("Notification response => ", notificationResponse.response.response);
                                isSuccess = true;
                                if(notificationResponse.response.response.successCount == 1){
                                    console.log("notification sent")
                                    await Notifications.findOneAndUpdate({ _id: notification._id },{ $set: {isSent: true } });
                                }
                            } else {
                                console.log("Notification not sent");
                            }
                        }
                    };
                }
            };
        }
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