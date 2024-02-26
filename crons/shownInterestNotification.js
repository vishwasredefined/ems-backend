require("../config/index");
const cron = require("node-cron");

//Models
const Users = require("../models/users");
const Events = require("../models/events");
const Notifications = require("../models/notifications");
const EventInterests = require("../models/eventInterests");
const Requests = require("../models/requests");


//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 6 * * *", function () {
    //every day at 06 AM
    console.log("shownInterestCron working...");
    shownEventInterestNotifications();
});

// shownEventInterestNotifications();

async function shownEventInterestNotifications() {

    try {
        let current_date = new Date();
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()) || 0))).setUTCHours(23,59,59,999));
        console.log(endDate)

        let allEvents = await Events.find({ isDeleted: false, isActive: true, endDate: { $gte: endDate } }).distinct("_id");
        console.log(allEvents);
        let users = [];
        let allUsers = await EventInterests.find({ eventId: { $in: allEvents }, interestType: "INTERESTED", isDeleted: false }).populate('userId', 'email deviceInfo').populate("eventId", "name startDate endDate").lean();
        // console.log("allUsers ", allUsers);
        if(allUsers.length > 0){
            for(j=0; j < allUsers.length; j++){
                if(allUsers[j].userId && allUsers[j].userId._id  && allUsers[j].eventId && allUsers[j].eventId._id){
                    let requestData = await Requests.findOne({ eventId: allUsers[j].eventId._id, userId: allUsers[j].userId._id }).lean();
                    if(!requestData){
                        users.push({userId: allUsers[j].userId,  eventId: allUsers[j].eventId});
                    }
                }
            }
        }
        console.log(users)
    
        let notficationsToSend = await getNotificationsToInsert(users);

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
                // console.log("user", user);
                if(user.userId.deviceInfo && user.userId.deviceInfo.length > 0){
                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: "Register in events!",
                    message: "You showed interest in some events. Have you registered yet? Don’t miss out!"                    ,
                    email: user.userId.email,
                    userId: user.userId._id,
                    isSent: false,
                    isRead: false,
                    isDeleted: false
                };
                // console.log(" Inserting Notification ...");

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
                let notification = allNotifications[i];
                if (notification.userId && notification.userId.deviceInfo[0]) {

                    let deviceTokens = notification.userId.deviceInfo;
                    for (let j = 0; j < deviceTokens.length; j++) {

                        let element = deviceTokens[j];
                        console.log("User Device Token Platform...", element.platform);
                        if (element.platform == "ios" || element.platform == "android") {

                            let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                            if (notificationResponse.success) {
                                console.log("Notification status ", notificationResponse.response.response);
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