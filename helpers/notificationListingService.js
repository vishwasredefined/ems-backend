const notificationHelperService =  require('../helpers/notification')
sendNotif = async () => {


let deviceToken = "dYNelV1ORJqa0Z4s3ZPJ2p:APA91bHo3wInvqFk1uDdGw7424upKRCuOJQB9cfya9cFNRWZGOZg9srgcUL57CgQPINTSt5izBHWS6NCAGEEpUnBc_2qkKTYDDsqlXVQKSLJ9uT5Bwbc80J9yaGSM0Szi6CDaLqF9P8f";
  let notification = {
    title:'Hi Amit',
    message:'App is working fine now'
  }
  let payload = {
    userId:'Amit dev',
    Event:'Tdefi'
  }
  let notifResponse =  await notificationHelperService.sendSingleNotification(deviceToken,notification, payload);
  if(notifResponse.success){
    console.log("notofication sent")
  }else{
    console.log("something went wrong to sent notofication ")
    
  }
  console.log('_+_+_+_', notifResponse);

}

sendNotif()