require("../config/index");
const cron = require("node-cron");

//Models
const Users = require("../models/users");
const Notifications = require("../models/notifications");


//Helpers
const notify = require("../helpers/notification");

cron.schedule("0 6 * * *", function () {

    //every day at 6 AM
    console.log("appOpenedButNotCompletedProfileNotification working...");
    appOpenedButNotCompletedProfileNotification();
});
// appOpenedButNotCompletedProfileNotification();


async function appOpenedButNotCompletedProfileNotification() {
    try {
        let current_date = new Date();
        let endDate = new Date(new Date((current_date.setDate((current_date.getDate()) - 2 || 0))).setUTCHours(0,0,0,0));
        // console.log(endDate)

        let userData = await Users.find({ role: "user", createdAt: { $lte: endDate }, profileCompleted: false, isActive: true, isBlocked: false, "deviceInfo.0": { "$exists": true } },{ name: 1,email: 1, deviceInfo: 1, createdAt: 1, updatedAt: 1 }).lean();
        // console.log("userData ", userData);
            
        if(userData.length > 0){
            let notficationsToSend = await getNotificationsToInsert(userData);
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
            if(user._id && user.email){
                let notificationObj = {
                    alertType: 'PROFILE_COMPLETION_PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    title: `Complete profile!`,
                    message: `Almost there! Complete your profile to enhance your event experience.`,
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
        console.log("Notification ids ", notificationIds)
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
                            // console.log("device_token ", element.token);
                            let notificationResponse = await notify.sendSingleNotification(element.token, notification, {});
                            if (notificationResponse.success) {
                                console.log("Notification sent => ", notificationResponse);
                                isSuccess = true;
                                if(notificationResponse.response.response.successCount == 1){
                                    // console.log("notificationIds at end ")
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