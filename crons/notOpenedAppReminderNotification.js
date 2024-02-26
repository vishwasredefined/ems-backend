require("../config/index");
const cron = require("node-cron");

//Models
const Notifications = require("../models/notifications");
const InstalledDevices = require("../models/installedDevices");


//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 3 * * *", function () {
    //every day at 3 AM
    console.log("notOpenedAppReminderNotification working...");
    notOpenedAppReminderNotification();
});

// notOpenedAppReminderNotification()

async function notOpenedAppReminderNotification() {
    try {
        let current_date = new Date();
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()) - 6 || 0))).setUTCHours(0,0,0,0));
        console.log(endDate)
        let deviceData = await InstalledDevices.find({ createdAt: { $lte: endDate } },{ deviceToken:1, platform: 1 });
        console.log("deviceData ", deviceData);

        if(deviceData.length > 0){
            let notficationsToSend = await getNotificationsToInsert(deviceData);
            if (!notficationsToSend.success) {
                console.log("Error....");
                return;
            };

            notficationsToSend = notficationsToSend.data;
            if(!notficationsToSend.length){
                console.log("No users are elligible for this notification.Returning...");
                return;
            };

            let sendNotificationsRes = await sendNotifications(deviceData);
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

async function getNotificationsToInsert(allDevices) {

    try {
        let notficationsToSend = [];
        for (let i = 0; i < allDevices.length; i++) {
            let device = allDevices[i]; //SpecificUser
            console.log("device", device);
            if(device.platform && device.deviceToken){
                let notificationObj = {
                    alertType: 'PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `App not opened!`,
                    message: `Explore the latest! Check out our recent collection of events and find your next adventure.`,
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

 async function sendNotifications(deviceTokens, notificationIds) {
    try {
        if(deviceTokens.length > 0){
            let isSuccess = false;
            for (let j = 0; j < deviceTokens.length; j++) {
                let element = deviceTokens[j];
                console.log("User Device Token Platform...", element.platform);
                if (element.platform == "ios" || element.platform == "android") {
                    console.log("device_token ", element.deviceToken);
                    let notification = {
                        title: `App not opened!`,
                        message: `Explore the latest! Check out our recent collection of events and find your next adventure.`,
                    }
                    let notificationResponse = await notify.sendSingleNotification(element.deviceToken, notification, {});
                    if (notificationResponse.success) {
                        console.log("Notification status ", notificationResponse.response.response);
                        isSuccess = true;
                        if(notificationResponse.response.response.successCount == 1){
                            console.log("notification sent!")
                        }
                    } else {
                        console.log("Notification not sent");
                    }
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