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

cron.schedule("0 0 * * *", function () {
//cron.schedule("*/10 * * * *", function () {

    //once in a day
    console.log("bookmarkedAgendaReminderNotification working...");
    bookmarkedAgendaReminderNotifications();
});

// bookmarkedAgendaReminderNotifications();

async function bookmarkedAgendaReminderNotifications() {
    try {

        let currentDate = new Date();
        let current_date = new Date();
        console.log(currentDate)
        let startDate = new Date(new Date((currentDate.setDate((currentDate.getDate() + 1) || 0))).setUTCHours(0,0,0,0));
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()+1) || 0))).setUTCHours(23,59,59,999));
        console.log(startDate)
        console.log(endDate)

        let allAgendas = await Agendas.distinct("_id",{ isActive: true, isDeleted: false, $and:[{ date: { $gte: startDate } },{ date: { $lte: endDate } }] });
        console.log("allAgendas", allAgendas)

        let allBookmarkedUsers = await Bookmarks.aggregate([
            {
                $match: { agendaId: { $in: allAgendas }, isDeleted: false, isActive:true, isNotified: false }
            },
            {
                $group: {
                    "_id": {"userId": "$userId", "eventId": "$eventId"},
                    // "bookmarkDetails": { $push: "$$ROOT" },
                    "bookmark": { $first: "$$ROOT" },
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
                    from: "User",
                    localField: "_id.userId",
                    foreignField: "_id",
                    as: "users"
                }
            },
            { $unwind: { path: "$users", preserveNullAndEmptyArrays: true } },
        ])

        // console.log("allBookmarkedUsers ", allBookmarkedUsers);
        let bookmarkIds = [];
        if(allBookmarkedUsers.length > 0){
            allBookmarkedUsers.map(element => bookmarkIds.push(element.bookmark._id))
            // console.log("bookmarkIds ", bookmarkIds)

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
            let updateBookmarks = await Bookmarks.updateMany({ _id: { $in: bookmarkIds }}, { $set: { isNotified: true } },{ multi: true });
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

            if(user.events && user.events.name && user._id.userId){
                let userData = await Users.findOne({ _id: user._id.userId, role: "user", "deviceInfo.0": { "$exists": true } }, { email: 1, deviceInfo:1 });
                // console.log("userData ", userData)
                if(userData){
                    let notificationObj = {
                        alertType: 'PUSH_NOTIFICATION',
                        targetUser: "ALL_USERS",
                        title: `Checkout ${user.events.name} agenda!`,
                        message: `Have you seen the full agenda for ${user.events.name}? It's packed with amazing sessions. Take a look!`,
                        email: userData.email,
                        userId: user._id.userId,
                        isSent: false,
                        isRead: false,
                        isDeleted: false
                    };
                    // console.log(" Inserting Notification ...", notificationObj);

                    let insertedId = await Notifications.create(notificationObj)
                    // console.log(insertedId)
                    notficationsToSend.push(insertedId._id);
                }
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
                let isSuccess = false;
                let notification = allNotifications[i];
                // console.log("\nProcessing Notifcation => ", notification._id);
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
