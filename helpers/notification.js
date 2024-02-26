'use strict'
const { admin } = require('./firebase-notification/firebase-config');
function sendPush(token, message) {
    console.log("In send push function!!")
    return new Promise((resolve, reject) => {
        const options = {
            priority: "high",
            timeToLive: 60 * 60 * 24
        };
        admin.messaging().sendToDevice(token, message, options).then( response => {
			// console.log('Response after sending notification',response )
            resolve({
                success: true,
                message: "Push Notification Sent",
                response: response
            })
        })
        .catch( error => {
            resolve({
                success: false,
                message: "Push Notification Not Sent"
            })
            console.log("error : ", error)
        });
    })
}

function sendBulkPush(token, message) {
    console.log("In bulk send push function!!")
    return new Promise((resolve, reject) => {
        const messageData = {
            notification: {
              title: message.notification.title,
              body:  message.notification.body
            },
            tokens: token // Use 'tokens' for sending to specific devices or 'topics' for sending to topics
          };
        admin.messaging().sendMulticast(messageData).then( response => {
			console.log('Response after sending notification',response )
            resolve({
                success: true,
                message: "Push Notification Sent",
                response: response
            })
        })
        .catch( error => {
            resolve({
                success: false,
                message: "Push Notification Not Sent"
            })
            console.log("error : ", error)
        });
    })
}

    /**
     * 
     * @param {*} deviceToken device token
     * @param {*} notification {title, message, image, data}
     * @param {*} payload {other data}
     * @returns 
     */
     exports.sendSingleNotification = async (deviceToken, notification, payload=null) => {
        try {
            // console.log("In sendSingleNotification :", deviceToken , notification, payload);
            
            let message = {
                notification: {
                    title: notification.title,
                    body: notification.message ? notification.message : notification.body,
                }
            };
            if (notification.imageUrl) {
                message.notification.image = notification.imageUrl

                message.android.notification.imageUrl = notification.imageUrl
                message.apns.payload.aps['mutable-content'] =  1;
                message.apns.fcm_options.image = notification.imageUrl
                message.webpush.headers.image = notification.imageUrl
            }

            if(payload){
                // message.data =JSON.stringify(payload)
                message.data =payload
            }
            console.log("message" , message);
            
            let result = await sendPush(deviceToken, message)
            // console.log("in service result", result)
            if (result.success) {
                return {
                    success: true,
                    message: `Push sent successfully`,
                    response: result
                };
            } else {
                return {
                    success: false,
                    message: `Unable to send Push`
                };
            }
        } catch (error) {
            console.log("Error in sending push notification");
            throw (error);
        }
    };
    /**
     * 
     * @param {*} deviceTokens comma seperated device tokens
     * @param {*} notification {title, message, image, data}
     * @param {*} payload {other data}
     * @returns 
     */
     exports.sendBulkNotification = async (deviceTokens, notification, payload=null) => {
        try {
            console.log("In sendBulkNotification :", deviceTokens , notification, payload);
            
            let message = {
                notification: {
                    title: notification.title,
                    body: notification.message 
                }
            };
            if (notification.imageUrl) {
                message.notification.image = notification.imageUrl
            }
            if(payload){
                message.data =JSON.parse(JSON.stringify(payload))
            }
            
            let result = await sendPush(deviceTokens, message)
            // console.log("in service result", result)
            if (result.success) {
                return {
                    success: true,
                    message: `Push sent successfully`
                };
            } else {
                return {
                    success: false,
                    message: `Unable to send Push`
                };
            }
        } catch (error) {
            console.log("Error in sending push notification");
            throw (error);
        }
    };

/**
     * 
     * @param {*} deviceTokens comma seperated device tokens
     * @param {*} notification {title, message, image, data}
     * @param {*} payload {other data}
     * @returns 
     */
exports.sendBulkNotifications = async (deviceTokens, notification, payload=null) => {
    try {
        console.log("In sendBulkNotification :", deviceTokens , notification, payload);
        
        let message = {
            notification: {
                title: notification.title,
                body: notification.message 
            }
        };
        if (notification.imageUrl) {
            message.notification.image = notification.imageUrl
        }
        if(payload){
            message.data =JSON.parse(JSON.stringify(payload))
        }
        
        let result = await sendBulkPush(deviceTokens, message)
        // console.log("in service result", result)
        if (result.success) {
            return {
                success: true,
                message: `Push sent successfully`
            };
        } else {
            return {
                success: false,
                message: `Unable to send Push`
            };
        }
    } catch (error) {
        console.log("Error in sending push notification");
        throw (error);
    }
};