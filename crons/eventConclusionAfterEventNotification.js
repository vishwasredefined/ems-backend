require("../config/index");
const cron = require("node-cron");

//Models
const User = require("../models/users");
const Events = require("../models/events");
const Notifications = require("../models/notifications");
const Requests = require("../models/requests");


//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 6 * * *", function () {
    //every day at 06 AM
    console.log("eventConclusionAfterEventCron working...");
    eventConclusionAfterEventNotifications();
});

// eventConclusionAfterEventNotifications();

async function eventConclusionAfterEventNotifications() {
    try {

        let currentDate = new Date();
        let current_date = new Date();

        console.log(currentDate)
        let startDate = new Date(new Date((currentDate.setDate((currentDate.getDate() -1) || 0))).setUTCHours(0,0,0,0));
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate() -1) || 0))).setUTCHours(23,59,59,999));
        console.log(startDate)
        console.log(endDate)

        let eventData = await Events.aggregate([
            {
                $match: { $and:[{ endDate: { $gte: startDate } },{ endDate: { $lte: endDate } }] } // isDeleted: false, isActive:true, expired: false
            },
            {
                $project: {
                    name: 1,
                    startDate: 1, 
                    endDate: 1,
                }
            },
            {
                $lookup: {
                    from: "requests",
                    localField: "_id",
                    foreignField: "eventId",
                    as: "requests"
                }
            },
            { $unwind: { path: "$requests", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "requests.userId",
                    foreignField: "_id",
                    as: "users"
                }
            },
            { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    "_id": {"userId": "$requests.userId", "eventId": "$_id"},
                    // "eventDetails": { $push: "$$ROOT" },
                    "eventDetails": { $first: "$$ROOT" },
                }
            }
        ])
        // console.log("eventData ", eventData);

        if(eventData.length > 0){
            let notficationsToSend = await getNotificationsToInsert(eventData);
            console.log("notficationsToSend ", notficationsToSend.data)
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

            if(user.eventDetails && (user.eventDetails.users && user.eventDetails.users.deviceInfo && (user.eventDetails.users.deviceInfo.length > 0)) ){
                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `Thanks for participating!`,
                    message: `Thanks for making ${user.eventDetails.name} memorable!`,
                    email: user.eventDetails.users.email,
                    userId: user.eventDetails.users._id,
                    isSent: false,
                    isRead: false,
                    isDeleted: false
                };
                console.log(" Inserting Notification ...", notificationObj);

                let insertedId = await Notifications.create(notificationObj)
                console.log(insertedId)
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
        console.log("Notification ids ", notificationIds)
        let allNotifications = await Notifications.find({ _id: { $in: notificationIds } }).populate("userId").sort({ createdAt: -1 });
        console.log("allNotifications => ", allNotifications.length)
        if(allNotifications.length > 0){
            for (let i = 0; i < allNotifications.length; i++) {
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
                                if(notificationResponse.response.response.successCount == 1){
                                    console.log("Notification sent => ", notificationResponse);
                                    isSuccess = true;
                                    await Notifications.findOneAndUpdate({ _id: notification._id }, { $set: { isSent: true } });
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