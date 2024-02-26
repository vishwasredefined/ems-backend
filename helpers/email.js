const path = require("path");
const fs = require("fs");  
const QRCode = require('qrcode');
const AWS = require('aws-sdk');
const btoa = require('btoa');
const Mailjet = require('node-mailjet');

const SES_CONFIG = {
    accessKeyId:   `${process.env.AWS_ACCESS_KEY_ID}`,
    secretAccessKey:  `${process.env.AWS_ACCESS_KEY_SECRET}`,
	region: `${process.env.AWS_SES_REGION}`,
};
const AWS_SES = new AWS.SES(SES_CONFIG);

const mailgun = require('mailgun-js')({ apiKey: process.env.apiKey, domain: process.env.domain });
const projectName = 'Backend Core';

// Mailgun function
// import {htmlTemplate} from '../htmlTemplate/emailTemplate'
// const htmlTemplate = require("../htmlTemplate/emailTemplate")
// const sendForgotPasswordTemplate = require("../htmlTemplate/emailTemplate")

const mailjet = new Mailjet({
    apiKey: process.env.MAILJET_PUBLIC_API_KEY,
    apiSecret: process.env.MAILJET_PRIVATE_API_KEY
  });
  

const Handlebars = require('handlebars')

let sendMail = function(from, to, subject, message, cb) {
    
		if((process.env.DEV ==  true  ) || (process.env.DEV ==  'true'  )){
            /* code for send mail with mailgun start */
			/*
            const data = {
				from: from,
				to: to,
				// cc: 'baz@example.com',
				// bcc: 'bar@example.com',
				subject: subject,
				text: message,
				html: message,
				// attachment: attch
			};
			mailgun.messages().send(data, (error, body) => {
				if (error) {
					return cb(error, null);
				}
				return cb(null, body);
			});
            */
            /* code for send mail with mailgun end */

            /* code for send mail with mailjet start */
            mailjet.post("send", { version: "v3.1" })
                .request({
                    Messages: [
                        {
                        From: {
                            Email: from
                        },
                        To: [
                            {
                                Email: to,
                            },
                        ],
                        Subject: subject,
                        TextPart: message,
                        HTMLPart: message,
                        },
                    ],
                })
                .then((result) => {
                    console.log(result.body)
                    let dataToSend = {
                        status: result?.response?.status,
                        statusText: result?.response?.statusText
                    }
                    return cb(null, dataToSend);
                })
                .catch((err) => {
                    console.log(err.statusCode)
                    return cb(err, null);
                });
            /* code for send mail with mailjet end */

		}else{
			let params = {
				Source: process.env.EMAIL_HOST,
				Destination: {
				ToAddresses: [
					to
				],
				},
				ReplyToAddresses: [],
				Message: {
				Body: {
					Html: {
					Charset: 'UTF-8',
					Data: message,
					},
				},
				Subject: {
					Charset: 'UTF-8',
					Data: subject,
				}
				},
			};
			AWS_SES.sendEmail(params, (error, body) => {
			console.log('_+_+_+_+_==>', error, body)
				if (error) {
					return cb(error, null);
				}
				return cb(null, body);
			});
		}

   
}
// Mailgun function

// let sendMail = function(from, to, subject, message, cb) {

//     const data = {
//         from: from,
//         to: to,
//         // cc: 'baz@example.com',
//         // bcc: 'bar@example.com',
//         subject: subject,
//         text: message,
//         html: message,
//         // attachment: attch
//     };

//     mailgun.messages().send(data, (error, body) => {
//         if (error) {
//             return cb(error, null);
//         }
//         return cb(null, body);
//     });
// }


exports.sendAuthOtp = function(data, response, cb) {

    if(!cb){
        cb = response;
    }

    let user = {
        email: data.email
    };
    let generatedOTP = data.otp
    var hostUrl = process.env.EMAIL_HOST
  
    let subject = `OTP ${projectName}`;
    let from = process.env.EMAIL_HOST;
    let to = `${user.email}`;
    let message = `${hostUrl} To verify your account for ems, otp is ${generatedOTP.bold()} for ${user.email},`

    console.log(message)

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};

exports.sendEmailToUsers = function(data, response, cb) {

    if(!cb){
        cb = response;
    }

    let user = {
        email: data.email
    };
	console.log("===============data======email=",data)
    var hostUrl = process.env.EMAIL_HOST
  
    let subject = `${data.title}`;
    let from = process.env.EMAIL_HOST;
    let to = `${user.email}`;
    let message = `${data.messages}`

    console.log("email data *****",subject, message)

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};

exports.sendRegistrationEmailToAgency = function(data, response, cb) {

    if(!cb){
        cb = response;
    }

    let user = {
        email: data.email,
        name: data.name
    };
    let password = data.password
    var hostUrl = process.env.EMAIL_HOST
  
    let subject = `{Added Agency} ${projectName}`;
    let from = process.env.EMAIL_HOST;
    let to = `${user.email}`;
    let message = `<html><h1>Welocme, ${user.name}.</h1><br> You have been added as Event Agency by Tdefi.<br> Login Credentials:  Email : ${user.email},  Password : ${password} .Please login to ${process.env.CLIENT_URL}</html> `

    console.log(message)

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};

exports.sendRegistrationEmailToTeamMember = function(data, response, cb) {

    if(!cb){
        cb = response;
    }

    let user = {
        email: data.contactEmail,
        name: data.contactPersonName || "User",
        agencyName : data.req.auth.name,
		loginEmail:data.email
    };
    let password = data.password
    var hostUrl = process.env.EMAIL_HOST
  
    let subject = `{Added Agency} ${projectName}`;
    let from = process.env.EMAIL_HOST;
    let to = `${user.email}`;
    let message = `<html><h1>Welcome ${user.name},</h1><br> You have been added as team-member by ${ user.agencyName }.<br> Login Credentials:  Email : ${user.loginEmail},  Password : ${password} .Please login to ${process.env.CLIENT_URL}</html> `

    console.log(message)

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};

exports.sendForgotPasswordOtp = function(data, response, cb) {

    if(!cb){
        cb = response;
    }

    let user = {
        email: data.email
    };
    let generatedOTP = (data.otp).toString();
	console.log("=========",generatedOTP)
    var hostUrl = process.env.EMAIL_HOST
  
    let subject = `OTP ${projectName}`;
    let from = process.env.EMAIL_HOST;
    let to = `${user.email}`;
    let message = `${hostUrl} To change your password, otp is ${generatedOTP.bold()} for ${user.email},`

    console.log(message)

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};

exports.sendMailWithGeneratePassLink = function(data, response, cb) {

    if(!cb){
        cb = response;
    }
    // console.log("memberData....", data)
    let memberId = data._id;
    let eventId = (data.eventId && data.eventId._id) ? data.eventId._id : "";
    let memberType = data.memberType;
    console.log("memberId ", memberId, "eventId ", eventId, "memberType ", memberType );
    let dataToEncrypt = `${memberId.toString()},${eventId.toString()},${memberType},${process.env.CLIENT_URL}`;
    let encryptedData = btoa(dataToEncrypt)
    // console.log("encryptedData ", encryptedData);

    let linkGenerated = `${process.env.CLIENT_URL}ticket/details/${encryptedData}`;

    // let linkGenerated = `http://localhost:4200/purchasedPackages/v1/download/passes?data=${encryptedData}`;

    let from = process.env.EMAIL_MAILJET_HOST;
    let to = `${data.email}`;
    let subject = "Event pass generated"
    let message = `<p>The pass for event ${data.eventId?.name} has been generated.please go through the following link to download it </p><br/>
        <p>Click on the link below to generate the passes </p><br/>
        <p>${linkGenerated}</p>`

    // console.log(message);

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};

exports.sendMailToVisitorsForPassActivation = function(data, response, cb) {

    if(!cb){
        cb = response;
    }
    // console.log("memberData....", data)

    let from = process.env.EMAIL_MAILJET_HOST;
    let to = `${data.email}`;
    let subject = "Event pass generated"
    let message = `<p>The pass for event ${data.eventId?.name} has been generated. please login into app to download it </p><br/>`
    
    // console.log("message", message);

    sendMail(from, to, subject, message, function(error, data) {
        if (error) {
            return cb(error);
        }
        return cb(null, data);
    })
};