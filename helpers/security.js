const User = require('../models/users');
const mute = require('immutable');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const async = require("async");

// Response Struct
const responseStruct = mute.Map({
    signature: null,
    message: "",
    error: null,
    type: "auth",
    action: null,
    id: null,
    data: null,
    status: null
});

/**
 * @param  {JSON} data - signup data to create token
 * @param  {string} cb -encrypted string
 */

// Data Encryption and Decryption 
const encryptData = function(data, response, cb) {
	if (!cb) {
        cb = response
    }
    try {
        var signOptions = {
            issuer: "Authorization",
            subject: "iam@user.me",
            audience: "emsT-defi",
            expiresIn: "365d", // 6 hours validity
            algorithm: "HS256"
        };
        let encryptedData = jwt.sign(data, process.env.PASS_SALT_STATIC, signOptions);
        // console.log("encryptedData", encryptedData)

        cb(null, encryptedData);
    } catch (e) {
        cb(e);
    }

}
exports.encryptData = encryptData;

/**
 * @param  {string} encryptedData - verify token
 * @param  {boolean} cb -valid or not
 */
const decryptData = function(encryptedData, response, cb) {
	if (!cb) {
        cb = response
    }
    try {

        let verifyOptions = {
            issuer: "Authorization",
            subject: "iam@user.me",
            audience: "emsT-defi",
            expiresIn: "30d", // 30 days validity
            algorithm: "HS256"
        };
        let decryptedData = jwt.verify(encryptedData.token, process.env.PASS_SALT_STATIC, verifyOptions);
        // console.log("decryptedData", decryptedData)
        cb(null, decryptedData);
    } catch (e) {
		console.log("ee",e);
        cb(e);
    }
}
exports.decryptData = decryptData;

/**
 * @param  {string} plaintext - password
 * @param  {JSON} cb -hash, salt
 */

// generate referral link 
 const generateRandomUserName = function() {
    var randomString = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-$!@*';
    var charactersLength = characters.length;
    for (var i = 0; i < 10; i++) {
        randomString += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    randomString = "ems" + randomString.slice(5);
    return randomString
};
exports.generateRandomUserName = generateRandomUserName;

// Password Hashing and Comparing
const generatePassword = function(plaintext, res, cb) {
    if (!cb) {
        cb = res
    }

    const salt = crypto.randomBytes(16).toString('base64')
    const randomSalt = new Buffer(salt,'base64');
    const hash = crypto.pbkdf2Sync(plaintext, randomSalt, 10000, 64, 'sha1').toString('base64');
    
    return cb(null, {
        hash: hash,
        salt: salt
    })
};
exports.generatePassword = generatePassword;

/**
 * @param  {string} plaintext - password
 * @param  {string} hash -user encrypted password
 * @param  {boolean} cb -password matches or not
 */

const comparePassword = function(plaintextInput, hash, salt, cb) {
    console.log(plaintextInput,hash, salt)
    const userSalt = new Buffer(salt,'base64');
    console.log("== > ",plaintextInput);
    const hashResult = crypto.pbkdf2Sync(plaintextInput, userSalt, 10000, 64, 'sha1').toString('base64')
    if(hashResult === hash){
            return cb(null,true)
    }else{
            return cb(null,false)
    }
};
exports.comparePassword = comparePassword;

/**
 * @param  {string} email - email
 * returns true or false
 */
// Input Validators
const validateEmail = function(email) {
    let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};
exports.validateEmail = validateEmail;

/**
 * @param  {string} password - password
 * returns true or false
 */
const validatePassword = function(password) {
    if (password.length < 8 || password.length > 50) {
        return false;
    } else {
        return true;
    }
};
exports.validatePassword = validatePassword;

/**
 * @param  {string} phone - phone
 * returns true or false
 */
const validatePhone = function(phone) {
    if (phone.length < 10 || phone.length > 13) {
        return false;
    } else {
        return true;
    }
};
exports.validatePhone = validatePhone;

/**
 * @param  {string} data - email or accountId
 * @param  {JSON} cb -returns user details
 */
const readUserByKeyValue = function(data, response, cb) {
    if (!cb) {
        cb = response;
    }
    let findData = {};

    //third priority
    if(data.id){
        findData = {
            _id: data.id,
            // isBlocked: false
        }
    }
    //second priority
    if (data.email) {
        findData = {
            email: data.email,
            // isBlocked: false
        }
    }
    //first priority
    if (data.identifier) {
        findData = {
            accountId: data.identifier,
            // isBlocked: false

        }
    }
    User.findOne(findData, function (err, user) {
        if (err) {
          return cb(
            responseStruct
              .merge({
                signature: data.req.signature,
                action: "security",
                status: 500,
                message: "Something went wrong!",
                error: true,
              })
              .toJS()
          );
        }
      // console.log(findData, user);
    
        if (!user) {
          return cb(
            responseStruct
              .merge({
                signature: data.req.signature,
                action: "security",
                status: 403,
                message: "Invalid User: No user found",
                error: true,
              })
              .toJS()
          );
        }
    
        if (user.isBlocked) {
          return cb(
            responseStruct
              .merge({
                signature: data.req.signature,
                action: "security",
                status: 403,
                message: "Invalid User: User blocked by admin",
                error: true,
              })
              .toJS()
          );
        }
        if (user.emailVerified == false) {
          return cb(
            responseStruct
              .merge({
                signature: data.req.signature,
                action: "security",
                status: 403,
                message: "Invalid User: User not verified",
                error: true,
              })
              .toJS()
          );
        }
        if (user.isActive == false) {
          return cb(
            responseStruct
              .merge({
                signature: data.req.signature,
                action: "security",
                status: 403,
                message: "Invalid User: User not active",
                error: true,
              })
              .toJS()
          );
        }
        if (data.login && user.provider != "email" && data.password) {
          return cb(
            responseStruct
              .merge({
                signature: data.req.signature,
                action: "security",
                status: 403,
                message: "Invalid User: Please select correct social platform",
                error: true,
              })
              .toJS()
          );
        }
        return cb(
          null,
          responseStruct
            .merge({
              signature: data.req.signature,
              action: "security",
              status: 200,
              message: "",
              data: user,
              error: false,
            })
            .toJS()
        );
      });
   };

exports.readUserByKeyValue = readUserByKeyValue;

// Auth validate token
/**
 * @param  {string} data - token and identifier
 * @param  {JSON} cb -returns user token valid or not
 */
const validate_token = function(data, cb) {
    if (!data.token || !data.identifier) {
        return cb(responseStruct.merge({
            signature: data.req.signature,
            action: "validate_token",
            status: 403,
            message: "Invalid Credentials",
            error: true
        }).toJS());
    }

	let waterfallFunctions = [];
  
    waterfallFunctions.push(async.apply(readUserByKeyValue, data));
  
  waterfallFunctions.push(async.apply(decryptData, data));
  async.waterfall(waterfallFunctions, cb);
    // tokenPayload = {
    //     user: data.identifier,
    //     token: data.token
    // };
    // // console.log(data)
    // // is token valid
    // // sessions.readToken(tokenPayload, function (err, response){
    // //     if(err){
    // //         return cb(responseStruct.merge({
    // //             signature: data.req.signature,
    // //             action: "validate_token",
    // //             status: 403,
    // //             success: false,
    // //             message: "",
    // //         }).toJS());
    // //     }
    // //     console.log(response[0])
    // // })
    // readUserByKeyValue(data, function(err, user) {
        
    //     if (err) {
    //         console.log(err)
    //         return cb(err);
    //     }
    //     if (!user) {
    //         return cb(responseStruct.merge({
    //             signature: data.req.signature,
    //             action: "validate_token",
    //             status: 403,
    //             message: "No user",
    //             error: true
    //         }).toJS());
    //     }
    //     if (!user.data) {
    //         return cb(responseStruct.merge({
    //             signature: data.req.signature,
    //             action: "validate_token",
    //             status: 403,
    //             message: "No user",
    //             error: true
    //         }).toJS());
    //     }
    //     let key = user.data.salt;
    //     decryptData(data.token, key, function(err, response) {
    //         if (err) {
    //             console.log(err);
    //             return cb(responseStruct.merge({
    //                 signature: data.req.signature,
    //                 action: "validate_token",
    //                 status: 403,
    //                 message: "Unable to decrypt",
    //                 error: true
    //             }).toJS());
    //         }
    //         return cb(null,
    //             responseStruct.merge({
    //                 signature: data.req.signature,
    //                 action: "validate_token",
    //                 status: 200,
    //                 message: "",
    //                 error: false,
    //                 data: response
    //             }).toJS());
    //     })
    // })
};

exports.validate_token = validate_token;


exports.responseStruct = function (status, message, action, data, signature){
    let response = {};
    let statusArr = process.env.STATUS.split(',');
    statusArr = statusArr.map((status)=>+status);
   
    switch (status){
        case  statusArr[0]:  // status = 200
            response={
                action:action,
                status: status,
                message: message,
                data: data,
                error: false
            };
            break;
        case statusArr[1]:  // status = 500
            response={
                action:action,
                status: status,
                message: message? message: "Something went wrong",
                data: data,
                error: true
            };
            break;
        case statusArr[2]:  // status = 400
            response={
                signature:signature,
                action:action,
                status: status,
                message: message? message : "Missing params",
                data: data,
                error: true
            };
            break;
        default:
            response={
                action:action,
                status: status,
                message: message,
                error: true
            };
    }
    return response;
}


exports.getUTCStartDate = function(fromDate) {
  return new Date(new Date(new Date(fromDate).getTime() - new Date(fromDate).getTimezoneOffset() * 60000).setUTCHours(0, 0, 0, 0));
};

exports.getUTCEndDate = function(toDate) {
  return new Date(new Date(new Date(toDate).getTime() - new Date(toDate).getTimezoneOffset() * 60000).setUTCHours(23, 59, 59, 0));
};

/* Unexported Functions */