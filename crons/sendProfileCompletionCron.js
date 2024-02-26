require("../config/index");
const cron = require("node-cron");

//Models
const Users = require("../models/users");
const Notifications = require("../models/notifications");

const Countries = require("../models/countries");
const States = require("../models/states");
const Cities = require("../models/cities");


//Helpers
const notify = require("../helpers/notification");

cron.schedule("*/5 * * * *", function () {
    //every 5 minute
    sendProfileIncompleteNotifications();
});

// sendProfileIncompleteNotifications();

async function sendProfileIncompleteNotifications() {

    try {

        let allUsers = await Users.find({ role: "user", deviceInfo: { $ne: [] } }, { password: 0, salt: 0, accountId: 0 }).populate(" userMeta.country , userMeta.state , userMeta.city ")
        console.log("allUsers => ", allUsers.length);


        let notficationsToSend = await getNotificationsToInsert(allUsers);
        if (!notficationsToSend.success) {
            console.log("Error....");
            return;
        };

        notficationsToSend = notficationsToSend.data || [];
        if(!notficationsToSend.length){
            console.log("No users are elligible for this notification.Returning...");
            return;
        };

        let insertNotifications = await Notifications.insertMany(notficationsToSend);
        console.log("\nNotifications inserted...")

        let DTS = {
            findData: {
                alertType: "PROFILE_COMPLETION_PUSH_NOTIFICATION",
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
            console.log("\nProcessing User => ", user._id)
            let allFieldsToProfilePercentage = JSON.parse(process.env.PROFILE_COMPLETION_WEIGHTAGE);
            let keys = Object.keys(allFieldsToProfilePercentage);
            // console.log("Keys => ", keys)
            let profileCompletionPercentage = 0;
            for (let i = 0; i < keys.length; i++) {
                // console.log("Keys[i] => ", keys[i], user[`${keys[i]}`] , user?.userMeta[`${keys[i]}`] )
                if (user[`${keys[i]}`] || (user.userMeta && user?.userMeta[`${keys[i]}`]) || (user.socials && user?.socials[`${keys[i]}`])) {
                    profileCompletionPercentage += parseFloat(allFieldsToProfilePercentage[`${keys[i]}`])
                }
            };
            console.log(" Profile Completion Percentage => ", profileCompletionPercentage)
            profileCompletionPercentage = Math.ceil(profileCompletionPercentage);

            if (profileCompletionPercentage < 40) {
                let notificationObj = {
                    alertType: 'PROFILE_COMPLETION_PUSH_NOTIFICATION',
                    targetUser: "ALL_USERS",
                    // targetUserType: ,
                    // redirectionLink:,
                    // image: ,
                    title: "Complete your profile",
                    message: "Just a few more details to kickstart your journey with Today Events!"                    ,
                    subject: "Just a few more details to kickstart your journey with Today Events!"                    ,
                    email: user.email,
                    userId: user._id,
                    isSent: false,
                    isRead: false,
                    isDeleted: false,
                };
                console.log(" Inserting Notification ...");
                notficationsToSend.push(notificationObj);
            } else {
                console.log(" Profile is more than 40% for ", user._id, user.email);
            };

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