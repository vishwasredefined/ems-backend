require("../config/index");
const cron = require("node-cron");
const mongoose = require('mongoose')
// var ObjectId = require('mongodb').ObjectID;

//Models
const Users = require("../models/users");
const Events = require("../models/events");
const Notifications = require("../models/notifications");
const Bookmarks = require("../models/bookmarks");
const Agendas = require("../models/agendas");

//Helpers
const notify = require("../helpers/notification");

cron.schedule("*/10 * * * *", function () {
    //at every 10 minutes
    console.log("bookmarkedSessionAlertNotification working...");
    bookmarkedSessionAlertNotification();

});

// bookmarkedSessionAlertNotification();

async function bookmarkedSessionAlertNotification() {
    try {
        let current_date = new Date();
        let date = new Date();
        let hour = date.getHours();
        let currMint = ((date.getMinutes() < 10) ? ("0"+date.getMinutes()) : (date.getMinutes()));
        let currHour = ((date.getHours() < 10) ? ("0"+date.getHours()) : (date.getHours()));
        console.log("currMint ", currMint);
        console.log("currHour ", currHour);
        let minute = date.getMinutes()+ 10;
        let startTime = `${currHour}:${currMint}`;
        let endTime = (minute >= 60) ?  (`${Number(currHour) + 1}:${0}${(Number(minute) - 60)}`) : `${currHour}:${minute}`;
        console.log("start time ", startTime);
        console.log("end time ", endTime);
        let startDate = new Date(new Date((date.setDate((date.getDate()) || 0))).setUTCHours(0,0,0,0));
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()) || 0))).setUTCHours(23,59,59,999));
        console.log(startDate)
        console.log(endDate)

        let allAgendas = await Agendas.distinct("_id",{ $and:[{date: { $gte: startDate }},{date: { $lt: endDate }}, {startTime: { $gte: startTime }},{startTime: { $lte: endTime }}], isActive: true, isDeleted: false });
        
        console.log("allAgendas ", allAgendas);
        let allBookmarkedUsers = [];
        if(allAgendas.length > 0){
            allBookmarkedUsers = await Bookmarks.aggregate([
                {
                    $match: { agendaId: { $in: (allAgendas) }, isDeleted: false, isActive:true }
                },
                {
                    $group: {
                        "_id":  {"userId": "$userId", "eventId": "$eventId", "agendaId": "$agendaId"},
                        // "bookmarks": { $push: "$$ROOT" },
                        // "bookmark": { $first: "$$ROOT" },
                    }
                },
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
                        from: "agendas",
                        localField: "_id.agendaId",
                        foreignField: "_id",
                        as: "agendaData"
                    }
                },
                { $unwind: { path: "$agendaData", preserveNullAndEmptyArrays: true } },
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
            // console.log("user", user);
            if(user.users && user.users._id && (user.users.deviceInfo && user.users.deviceInfo.length > 0) && user.agendaData && user.agendaData.title){
                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `Session starts within 10 minutes`,
                    message: `${user.agendaData.title} is about to start. Head over to the designated area to secure a good spot.`                   ,
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
                // console.log("\nProcessing Notifcation => ", notification._id);
                if (notification.userId && notification.userId.deviceInfo[0]) {
                    let deviceTokens = notification.userId.deviceInfo;
                    for (let j = 0; j < deviceTokens.length; j++) {
                        let element = deviceTokens[j];
                        // console.log("User Device Token Platform...", element.platform);
                        if (element.platform == "ios" || element.platform == "android") {
                            let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                            if (notificationResponse.success) {
                                console.log("Notification response => ", notificationResponse.response.response);
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