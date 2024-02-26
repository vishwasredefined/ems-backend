require("../config/index");
const cron = require("node-cron");

//Models
const Users = require("../models/users");
const Events = require("../models/events");
const Notifications = require("../models/notifications");

//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 0 * * *", function () {
    //every day at 00 AM
    console.log("eventReminderOnLastDayCron working...");
    eventReminderOnLastDayNotifications();
});

// eventReminderOnLastDayNotifications();

async function eventReminderOnLastDayNotifications() {
    try {

        let currentDate = new Date();
        console.log(currentDate)
        let startDate = new Date(new Date((currentDate.setDate((currentDate.getDate()) || 0))).setUTCHours(0,0,0,0));
        let endDate = new Date(new Date((currentDate.setDate((currentDate.getDate()) || 0))).setUTCHours(23,59,59,999));
        console.log(startDate)
        console.log(endDate)

        let eventData = await Events.find({ $and:[{endDate: { $gte: startDate }},{endDate: { $lte: endDate }}], expired: false, isActive:true, isDeleted: false },{ name:1, startDate: 1, endDate: 1, managedBy:1 }).lean();
        console.log("eventData ", eventData);

        let userList = [];
        if(eventData.length > 0){
            for(let i=0; i < eventData.length; i++){
                let userData = await Users.find({ role: "user", isActive: true, isBlocked: false, "deviceInfo.0": { "$exists": true } },{ name: 1, email: 1, deviceInfo: 1 }).lean();
                if(userData.length > 0){
                    userData.map(element => (element.event =  { ...eventData[i]}));
                }

                userList = [...userList, ...userData];
                // console.log("userData ", userData);
            }
        }
        // console.log("userList ", userList);

        if(userList.length > 0){
            let notficationsToSend = await getNotificationsToInsert(userList);
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

            if(user._id && user.event && user.event._id){
                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `${user.event.name} event last day today!`,
                    message: `Grab them before they're gone! Last-minute tickets for ${user.event.name} just released.`,
                    email: user.email,
                    userId: user._id,
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

                            let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                            if (notificationResponse.success) {
                                console.log("Notification status => ", notificationResponse.response.response);
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