require("../config/index");
const cron = require("node-cron");

//Models
const Users = require("../models/users");
const Events = require("../models/events");
const Notifications = require("../models/notifications");
const Bookmarks = require("../models/bookmarks");
const Agendas = require("../models/agendas");

//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 0 6 * * *", function () {
    //every day at 6 AM
    console.log("bookmarkedTwoSessionsNotification working...");
    bookmarkedTwoSessionsNotification();
});

// bookmarkedTwoSessionsNotification();

async function bookmarkedTwoSessionsNotification() {
    try {

        let currentDate = new Date();
        let current_date = new Date();
        console.log(currentDate)
        let startDate = new Date(new Date((currentDate.setDate((currentDate.getDate()) || 0))).setUTCHours(0,0,0,0));
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()) || 0))).setUTCHours(23,59,59,999));
        console.log(startDate)
        console.log(endDate)

        let eventData = await Events.distinct("_id",{ $and:[{startDate: { $gte: startDate }},{startDate: { $lte: endDate }}] }).lean();
        console.log("eventData ", eventData);
        let allAgendas = await Agendas.distinct("_id", { eventId: { $in: eventData }, isActive: true, isDeleted: false });
        console.log("allAgendas ", allAgendas);
          
        let allBookmarkedUsers = [];
        if(allAgendas.length > 0){
            allBookmarkedUsers = await Bookmarks.aggregate([
                {
                    $match: { agendaId: { $in: allAgendas }, isDeleted: false, isActive:true }
                },
                {
                    $group: {
                        "_id": {"userId": "$userId", "eventId": "$eventId"},
                        "bookmarks": { $push: "$$ROOT" },
                        // "bookmark": { $first: "$$ROOT" },
                    }
                },
                {
                    $project: {
                        _id: 1,
                        bookmarkSize: {$size: "$bookmarks"}
                    },
                },
                {$match: {"bookmarkSize": {$gte: 2}}},
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
                    $lookup: {
                        from: "events",
                        localField: "_id.eventId",
                        foreignField: "_id",
                        as: "eventData"
                    }
                },
                { $unwind: { path: "$eventData", preserveNullAndEmptyArrays: true } },
            ])
        }

        // console.log("allBookmarkedUsers ", allBookmarkedUsers);

        if(allBookmarkedUsers.length > 0){
            let notficationsToSend = await getNotificationsToInsert(allBookmarkedUsers);
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
            if(user.users && user.users._id && (user.users.deviceInfo && user.users.deviceInfo.length > 0) && user.eventData && user.eventData.name){
            // console.log("user", user);

                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `Bookmarked 2+ sessions`,
                    message: `Heads up! You've bookmarked over 2 sessions for ${user.eventData.name}. Keep an eye on the schedule to stay on track.`                   ,
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
        // console.log("allNotifications => ", allNotifications.length)
        if(allNotifications.length > 0){
            for (let i = 0; i < allNotifications.length; i++) {
                let notification = allNotifications[i];
                if (notification.userId && notification.userId.deviceInfo[0]) {
                    let deviceTokens = notification.userId.deviceInfo;
                    for (let j = 0; j < deviceTokens.length; j++) {
                        let element = deviceTokens[j];
                        // console.log("User Device Token Platform...", element.platform);
                        if (element.platform == "ios" || element.platform == "android") {
                            let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                            if (notificationResponse.success) {
                                console.log("Notification resp => ", notificationResponse.response.response);
                                if(notificationResponse.response.response.successCount == 1){
                                    console.log("Notification sent");
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