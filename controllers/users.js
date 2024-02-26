const async = require('async');
const moment = require('moment');
const mongoose = require("mongoose");
const authController = require("./auth")
var atob = require('atob');
var btoa = require('btoa');

//Models
const Users = require('../models/users');
const Visitors = require('../models/visitors');
let Speakers = require("../models/speakers");
let Sponsors = require("../models/sponsors");
let MediaPartners = require("../models/medias");
let Exhibitors = require("../models/exhibitors");
let Events = require("../models/events");
let Bookmarks = require("../models/bookmarks");
const EventInterests = require("../models/eventInterests");
const InstalledDevices = require("../models/installedDevices");


//Utilities
const utilities = require('../helpers/security');
const responseUtilities = require("../helpers/sendResponse");
let emailUtilities = require("../helpers/email");

let allRoles = JSON.parse(process.env.role);

//Contoller for getting all users
exports.getAllUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		role: allRoles.user
	};


	let check = mongoose.Types.ObjectId;
	let createdAt = {};

	let minutesToAdd = 330;
	// if (data.fromDate) {
	// 	let fromDate = new Date(data.fromDate)
	// 	console.log("=============from date before change========", fromDate)
	// 	fromDate = new Date(fromDate.getTime() + minutesToAdd * 60000);
	// 	console.log("=============from date after change========", fromDate)
	// 	createdAt["$gte"] = new Date(fromDate.setHours(0, 0, 0, 0))
	// }
	// if (data.toDate) {
	// 	let toDate = new Date(data.toDate)
	// 	toDate = new Date(toDate.getTime() + minutesToAdd * 60000);
	// 	createdAt["$lte"] = new Date(toDate.setHours(23, 59, 59, 999))
	// }

	if (data.fromDate || data.startDate) {
		let filterDate = data.fromDate || data.startDate
		let fromDate = new Date(filterDate)
		console.log("=============from date before change========", fromDate)
		// createdAt["$gte"] = fromDate
		createdAt["$gte"] = new Date(fromDate.setUTCHours(0, 0, 0, 0))
		console.log("=============from date before change========", createdAt["$gte"])

	}
	if (data.toDate || data.endDate) {
		let filterDate = data.toDate || data.endDate
		let toDate = new Date(filterDate)
		// createdAt["$lte"] = toDate;
		// toDate = new Date(toDate.getTime() + minutesToAdd * 60000);

		createdAt["$lte"] = new Date(toDate.setUTCHours(23, 59, 59, 999))
		console.log("=============from date before change========", createdAt["$lte"])
	}

	if (data.fromDate || data.toDate || data.startDate || data.endDate) {
		findData["createdAt"] = createdAt;
	}

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = data.isBlocked
	}
	if (JSON.stringify(data.profileCompleted)) {
		findData.profileCompleted = data.profileCompleted
	}
	if (data.agencyId && check.isValid(data.agencyId)) {
		findData.eventAdminId = data.agencyId
	}

	if (data.role) {
		findData.role = data.role
	}

	if (data.search) {
		const regex = /^[^*|\":<>[\]{}`\\()';&$]+$/;
		if (!regex.test(data.search)) {
			console.log("Invalid input");
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid search input",
					"getAllUsers",
					null,
					data.req.signature
				)
			);
		}
		findData["$or"] = [
			{ "email": { "$regex": data.search, "$options": "i" } },
			{ "name": { "$regex": data.search, "$options": "i" } }
		]
	}

	console.log("============find all user data=======", findData)
	Users.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for users: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllUsers",
					null,
					null
				)
			);
		}
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (data.currentPage) {
			skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
		}
		Users.find(findData, { password: 0, salt: 0, accountId: 0 })
			.populate('userMeta.country userMeta.state userMeta.city')
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get users: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllUsers",
							null,
							null
						)
					);
				}
				let sendData = {
					data: res,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"All Users fetched for admin",
						"getAllUsers",
						sendData,
						null
					)
				);
			});
	});
};

//Contoller for  update use device-info
exports.updateDeviceInfo = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	console.log("_+_+_+_+_+HETERETE", data.deviceInfo)
	if (!data.deviceInfo || !data.deviceInfo.platform || !data.deviceInfo.token) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Params missing",
				"updateDeviceInfo",
				null,
				data.req.signature
			)
		);
	}
	let newDeviceInfo = data["deviceInfo"];
	let findData = {
		_id: data.req.auth.id,
		"deviceInfo.platform": newDeviceInfo.platform,
	};
	let updateData = {};


	Users.findOne(findData).exec((err, user) => {
		if (err) {
			console.error("Unable to find User: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateDeviceInfo",
					null,
					null
				)
			);
		}
		console.log("index of platform token ===========", user);
		if (user) {
			updateData["deviceInfo.$.token"] = newDeviceInfo.token;
		} else {
			delete findData["deviceInfo.platform"];
			updateData = {
				$push: { deviceInfo: newDeviceInfo },
			};
		}

		Users.findOneAndUpdate(findData, updateData).exec((err, res) => {
			if (err) {
				console.error("Unable to get User: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"updateDeviceInfo",
						null,
						null
					)
				);
			}
			return cb(
				responseUtilities.sendResponse(
					200,
					"Device info updated",
					"updateDeviceInfo",
					null,
					null
				)
			);
		});
	});
};

//Contoller for user by id
const getUserById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.userId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getUserById",
				null,
				data.req.signature
			)
		);
	}

	if (data.id && !mongoose.Types.ObjectId.isValid(data.id)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid Parameter",
				"getUserById",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.id || data.userId,
		// isDeleted: false,
	};

	Users.findOne(findData)
		.populate(" userMeta.country , userMeta.state , userMeta.city ")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get User: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getUserById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"User not found",
						"getUserById",
						null,
						data.req.signature
					)
				);
			}
			let sendData = {
				data: res,
			};
			console.log("Get user by id =>", res)
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User fetched by id",
					"getUserById",
					sendData,
					null
				)
			);
		});
};
exports.getUserById = getUserById;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting user profile
 */
const getUserProfile = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}


	let findData = {
		_id: data.req.auth.id,
		isBlocked: false,
	};

	Users.findOne(findData, { password: 0, salt: 0, accountId: 0 })
		.populate(" userMeta.country , userMeta.state , userMeta.city ")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get User: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getUserProfile", null, null)
				);
			}
			if (!res) {
				return cb(responseUtilities.sendResponse(400, "User not found", "getUserProfile", null, data.req.signature));
			};

			let user = JSON.parse(JSON.stringify(res));
			let allFieldsToProfilePercentage = JSON.parse(process.env.PROFILE_COMPLETION_WEIGHTAGE);
			let keys = Object.keys(allFieldsToProfilePercentage);
			// console.log("Keys => ", keys, user)
			let profileCompletionPercentage = 0;
			for (let i = 0; i < keys.length; i++) {
				// console.log("Keys[i] => ", keys[i], user[`${keys[i]}`] , user?.userMeta[`${keys[i]}`] )
				if (user[`${keys[i]}`] || (user.userMeta && user?.userMeta[`${keys[i]}`]) || (user.socials && user?.socials[`${keys[i]}`])) {
					profileCompletionPercentage += parseFloat(allFieldsToProfilePercentage[`${keys[i]}`])
				}
			};
			console.log("Profile Completion Percentage => ", profileCompletionPercentage)
			user.profileCompletionPercentage = Math.ceil(profileCompletionPercentage);
			return cb(null, responseUtilities.sendResponse(200, "User fetched", "getUserProfile", user, null));
		});
};
exports.getUserProfile = getUserProfile;

//Contoller for update user
exports.updateUser = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.userId && !data.eventAdminId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateUser",
				null,
				data.req.signature
			)
		);
	}

	// let updateData = data;
	let findData = {
		_id: data.userId || data.eventAdminId
	};

	let updateData = {};
	let userMeta = {};
	if (data.name) {
		updateData.name = data.name
	}
	if (data.logo) {
		userMeta.logo = data.logo
	}
	if (data.country) {
		userMeta.country = data.country
	}
	if (data.city) {
		userMeta.city = data.city
	}
	if (data.state) {
		userMeta.state = data.state
	}
	if (data.contactPersonName) {
		userMeta.contactPersonName = data.contactPersonName
	}
	if (data.contactPersonMobile) {
		userMeta.contactPersonMobile = data.contactPersonMobile
	}
	if (data.contactPersonDesignation || data.contactPersonDesignation == '') {
		userMeta.contactPersonDesignation = data.contactPersonDesignation
	}
	if (data.description) {
		userMeta.description = data.description
	}

	if (JSON.stringify(userMeta) === '{}') {
	} else {
		updateData.userMeta = userMeta
	}
	console.log("Find Event admin => ", findData);
	console.log("update Event admin => ", updateData);

	Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update User: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateUser", null, null)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"User updated",
				"updateUser",
				res,
				data.req.signature
			)
		);
	});
};

const findUserByEmail = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"findUserByEmail",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		email: data.email,
		isBlocked: false
	}
	Users.find(findData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get User: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findUser",
						null,
						null
					)
				);
			}
			data.userId = (res && res[0] && res[0]._id) || null
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Finding user",
					"findUser",
					null,
					null
				)
			);
		});
}
exports.findUserByEmail = findUserByEmail

//Contoller for update user
exports.updateUserProfile = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	// if (!data.name || !data.title || !data.mobile) {
	// 	return cb(responseUtilities.sendResponse(400, "Missing params", "updateUserProfile", null, null));
	// }

	let findData = {
		_id: data.req.auth.id
	};

	// console.log("Data fir Update prfile => ", data)
	let updateData = {};
	let userMeta = {};
	if (data.title) {
		updateData.title = data.title
	}
	if (data.name) {
		updateData.name = data.name
	}
	if (data.profilePicture) {
		// updateData["userMeta.profilePicture"] = data.profilePicture;
		updateData["profilePicture"] = data.profilePicture

	}
	if (data.logo || data.logo == "") {
		updateData["userMeta.logo"] = data.logo
	}
	if (JSON.stringify(data.mobile)) {
		updateData["userMeta.mobile"] = data.mobile
	}
	if (JSON.stringify(data.mobileCode)) {
		updateData["userMeta.mobileCode"] = data.mobileCode
	}
	if (data.country && mongoose.Types.ObjectId.isValid(data.country)) {
		updateData["userMeta.country"] = data.country
	};

	if (data.city && mongoose.Types.ObjectId.isValid(data.city)) {
		updateData["userMeta.city"] = data.city
	}
	if (data.state && mongoose.Types.ObjectId.isValid(data.state)) {
		updateData["userMeta.state"] = data.state
	}
	if (JSON.stringify(data.businessSector)) {
		updateData["userMeta.businessSector"] = data.businessSector
	}
	if (data.interestTopics) {
		updateData["userMeta.interestTopics"] = data.interestTopics
	}
	if (JSON.stringify(data.contactPersonName)) {
		updateData["userMeta.contactPersonName"] = data.contactPersonName
	}
	if (JSON.stringify(data.contactPersonMobile)) {
		updateData["userMeta.contactPersonMobile"] = data.contactPersonMobile
	}
	if (JSON.stringify(data.contactPersonDesignation) || data.contactPersonDesignation == '') {
		updateData["userMeta.contactPersonDesignation"] = data.contactPersonDesignation
	};
	if (JSON.stringify(data.whatsAppMobile)) {
		updateData["userMeta.whatsAppMobile"] = data.whatsAppMobile
	};
	if (JSON.stringify(data.whatsAppMobileCode)) {
		updateData["userMeta.whatsAppMobileCode"] = data.whatsAppMobileCode
	}
	if (JSON.stringify(data.contactEmail)) {
		updateData["userMeta.contactEmail"] = data.contactEmail
	}
	if (JSON.stringify(data.description)) {
		updateData["userMeta.description"] = data.description
	}
	if (JSON.stringify(data.landline)) {
		updateData["userMeta.landline"] = data.landline
	}
	if (JSON.stringify(data.company)) {
		updateData["userMeta.company"] = data.company
	}
	if (data.purchasePower) {
		updateData["userMeta.purchasePower"] = data.purchasePower
	}
	if (data.seniority) {
		updateData["userMeta.seniority"] = data.seniority
	}
	if (data.industry) {
		updateData["userMeta.industry"] = data.industry
	}
	if (data.jobFunction) {
		updateData["userMeta.jobFunction"] = data.jobFunction
	}
	if (JSON.stringify(data.website)) {
		updateData["userMeta.website"] = data.website
	}
	if (data.google) {
		updateData["socials.facebook"] = data.facebook
	}
	if (JSON.stringify(data.twitter)) {
		updateData["socials.twitter"] = data.twitter
	}
	if (JSON.stringify(data.linkedin) || JSON.stringify(data.linkedIn)) {
		updateData["socials.linkedin"] = data.linkedin || data.linkedIn;
	}
	if (data.skype) {
		updateData["socials.skype"] = data.skype
	}
	if (JSON.stringify(data.telegram)) {
		updateData["socials.telegram"] = data.telegram
	}

	console.log("Find  user => ", findData);
	console.log("update  user => ", updateData);

	Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update User: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateUserProfile", null, null)
			);
		}
		let markProfileCompleted = {

		}
		if (
			res.name &&
			res.profilePicture &&
			res.userMeta &&
			res.userMeta.mobile &&
			res.userMeta.country &&
			res.userMeta.state &&
			res.userMeta.city
		) {
			markProfileCompleted.profileCompleted = true;
		} else {
			markProfileCompleted.profileCompleted = false;
		}
		Users.findOneAndUpdate(findData, markProfileCompleted, { new: true }, (errUser, userRes) => {
			if (errUser) {
				console.error("Unable to update User: ", errUser);
				return cb(
					responseUtilities.sendResponse(500, null, "updateUserProfile", null, null)
				);
			}
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User updated",
					"updateUserProfile",
					userRes,
					data.req.signature
				)
			);
		})
	});
};

//Contoller for changing Events status
exports.updateUserBlockStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.userId || !JSON.stringify(data.isBlocked)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateUserBlockStatus",
				null,
				null
			)
		);
	}
	let findData = {
		_id: data.userId
	};
	let updateData = {
		isBlocked: data.isBlocked
	};
	Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update user block status", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateUserBlockStatus",
					null,
					null
				)
			);
		}
		let messageToSend = "User Unblocked Successfully"
		if (data.isBlocked == true || data.isBlocked == "true") {
			messageToSend = "User Blocked Successfully"
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				messageToSend,
				"updateUserBlockStatus",
				res,
				null
			)
		);
	});
};

exports.exportAllUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		role: "user"
	}

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = JSON.parse(data.isBlocked)
	}

	if (JSON.stringify(data.profileCompleted)) {
		findData.profileCompleted = JSON.parse(data.profileCompleted)
	}

	if (data.search) {
		console.log("data.search => ", data.search)
		findData["$or"] = [
			{ name: { "$regex": data.search, "$options": "i" } },
			{ email: { "$regex": data.search, "$options": "i" } }
		]
	}
	let createdAt = {};
	if (data.fromDate || data.startDate) {
		let filterDate = data.fromDate || data.startDate
		let fromDate = new Date(filterDate)
		console.log("=============from date before change========", fromDate)
		// createdAt["$gte"] = fromDate
		createdAt["$gte"] = new Date(fromDate.setUTCHours(0, 0, 0, 0))
		console.log("=============from date before change========", createdAt["$gte"])

	}
	if (data.toDate || data.endDate) {
		let filterDate = data.toDate || data.endDate
		let toDate = new Date(filterDate)
		// createdAt["$lte"] = toDate;
		// toDate = new Date(toDate.getTime() + minutesToAdd * 60000);

		createdAt["$lte"] = new Date(toDate.setUTCHours(23, 59, 59, 999))
		console.log("=============from date before change========", createdAt["$lte"])
	}
	console.log("findData => ", findData)
	Users.find(findData)
		.populate(" userMeta.country userMeta.state userMeta.city ")
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding users => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllUsers", err, null));
			}
			console.log("All user res length => ", res.length);

			if (!res.length) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"No Record(s) found",
						"updateUserBlockStatus",
						null,
						null
					)
				);
			}
			let dataArray = [];
			for (let i = 0; i < res.length; i++) {
				let user = res[i];

				let fieldObject = {
					"Name": user.name,
					"Email": user.email,
					"Address": user.address,
					"About": user.userMeta?.description,
					"Reference": user.provider,
					"Profile status": (user.profileCompleted && "COMPLETED") || "INCOMPLETE",
					"Joining date": (user.createdAt).toISOString(),
					"Country": user.userMeta?.country?.name,
					"State": user.userMeta?.state?.name,
					"City": user.userMeta?.city?.name,
					"Mobile": user.userMeta?.mobile,
					"Gender": user.userMeta?.gender,
					"Purchase Power": user.userMeta?.purchasePower,
					"Seniority": user.userMeta?.seniority,
					"Industry": user.userMeta?.industry,
					"Telegram": user.socials?.telegram,
					"Twitter": user.socials?.twitter
				}
				dataArray.push(fieldObject);
			}
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User List",
					"exportAllUsers",
					dataArray,
					null
				)
			)
		})
}


//Contoller for getting user signup count for superadmin
const getUserSignupCountForSuperadmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let currentDate = new Date();
	currentDate.setDate(currentDate.getDate() - 1);

	let lastDate = new Date(currentDate);

	let findData = {
		isBlocked: false,
		role: allRoles.user,
		createdAt: { $gte: lastDate },
	};

	console.log("=======total signup count findData===", findData)
	Users.countDocuments(findData)
		.exec((err, count) => {
			if (err) {
				console.error("Unable to get User count: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getUserSignupCountForSuperadmin", null, null)
				);
			}

			let sendData = {
				totalCount: count,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User signup count fetched",
					"getUserSignupCountForSuperadmin",
					sendData,
					null
				)
			);
		});
};
exports.getUserSignupCountForSuperadmin = getUserSignupCountForSuperadmin;

//Contoller for getting user signup count for superadmin
const getUserCountForSuperadmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isBlocked: false,
		role: allRoles.user,
	};

	Users.countDocuments(findData)
		.exec((err, count) => {
			if (err) {
				console.error("Unable to get User count: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getUserSignupCountForSuperadmin", null, null)
				);
			}

			let sendData = {
				totalCount: count,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User signup count fetched",
					"getUserSignupCountForSuperadmin",
					sendData,
					null
				)
			);
		});
};
exports.getUserCountForSuperadmin = getUserCountForSuperadmin;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for get Users Count For Agency (ONBOARDED)
 */
const getOnboardedUserCountForAgency = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let eventAdminId = data.req.auth.eventAdminId || data.req.auth.id;
	let findData = {
		eventAdminId: eventAdminId,
		isBlocked: false,
		isDeleted: false,
		// isActive:true
	};
	if (data.eventId) findData.eventId = data.eventId;
	let allPromises = [];
	let speakerCount = Speakers.distinct("email", { ...findData, status: "ASSIGNED" });
	let visitors = Visitors.countDocuments({ ...findData, isPackagePurchased: true });
	let sponsorCount = Sponsors.distinct("email", { ...findData, status: "ASSIGNED" });
	let mediaCount = MediaPartners.distinct("email", { ...findData, status: "ASSIGNED" });
	let exhibitorCount = Exhibitors.distinct("email", { ...findData, status: "ASSIGNED" });

	allPromises = [
		speakerCount,
		sponsorCount,
		visitors,
		mediaCount,
		exhibitorCount
	];

	Promise.all(allPromises).then((res) => {
		console.log("Emails participating in agency =>", res[0]);

		let count = 0
		let combinedArray = [].concat(
			(res[0] || []),
			(res[1] || []),
			(res[2] || []),
			(res[3] || []),
			(res[4] || [])
		);
		let uniqueArray = Array.from(new Set(combinedArray));
		// uniqueArray = uniqueArray.concat(res[2]);
		count = uniqueArray.length;
		console.log("Count except visitor => ", count);
		// console.log("Visiotrs => ", res[2])
		let sendData = {
			totalCount: count + res[2]
		};

		return cb(null, responseUtilities.sendResponse(200, "Users count fetched", "getOnboardedUserCountForAgency", sendData, data.req.signature));
	})
		.catch((err) => {
			console.log("Err", err);
			return cb(
				responseUtilities.sendResponse(400, "Unable to get users count", "getOnboardedUserCountForAgency", err, null)
			);
		})
}
exports.getOnboardedUserCountForAgency = getOnboardedUserCountForAgency;

//Contoller for getUserSignupCountForAgency
const getUserSignupCountForAgency = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let currentDate = new Date();
	currentDate.setDate(currentDate.getDate() - 1);

	let lastDate = new Date(currentDate);
	let eventAdminId = data.req.auth.eventAdminId || data.req.auth.id
	let allPromises = [];
	let speakerCount = Speakers.distinct("email", { eventAdminId: eventAdminId, isBlocked: false, isDeleted: false, createdAt: { $gte: lastDate } });
	let visitors = Visitors.distinct("email", { eventAdminId: eventAdminId, isBlocked: false, isDeleted: false, isPackagePurchased: true, createdAt: { $gte: lastDate } });
	let sponsorCount = Sponsors.distinct("email", { eventAdminId: eventAdminId, isBlocked: false, isDeleted: false, createdAt: { $gte: lastDate } });
	let mediaCount = MediaPartners.distinct("email", { eventAdminId: eventAdminId, isBlocked: false, isDeleted: false, createdAt: { $gte: lastDate } });
	let exhibitorCount = Exhibitors.distinct("email", { eventAdminId: eventAdminId, isBlocked: false, isDeleted: false, createdAt: { $gte: lastDate } });
	// let agendaCount = Agendas.distinct({ eventId: data.eventId, isDeleted: false });
	// let sponsorPackageCount = Packages.countDocuments({ eventId: data.eventId, type: "Sponsor", isActive: true, isDeleted: false });
	// let exhibitorPackageCount = Packages.countDocuments({ eventId: data.eventId, type: "Exhibitor", isActive: true, isDeleted: false });

	allPromises = [
		speakerCount,
		sponsorCount,
		visitors,
		mediaCount,
		exhibitorCount
	]

	Promise.all(allPromises).then((res) => {
		console.log("Res", res[0]);

		let count = 0
		let combinedArray = [].concat(
			(res[0] || []),
			(res[1] || []),
			(res[2] || []),
			(res[3] || []),
			(res[4] || [])
		);
		let uniqueArray = Array.from(new Set(combinedArray));
		count = uniqueArray.length;
		// console.log("======count", count)
		let sendData = {
			totalCount: count
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Users count fetched",
				"getUserSignupCountForAgency",
				sendData,
				data.req.signature
			)
		);
	})
		.catch((err) => {
			console.log("Err", err);
			return cb(
				responseUtilities.sendResponse(400, "Unable to get users count", "getUserSignupCountForAgency", err, null)
			);
		})
}
exports.getUserSignupCountForAgency = getUserSignupCountForAgency;

//Contoller for adding user bookmark
const bookmarkUserEntity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	console.log("bookmarkUserEntity => ", data.agendaId);

	if (!data.agendaId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "bookmarkUserEntity", null, data.req.signature));
	};
	let findData = {
		agendaId: data.agendaId,
		userId: (data.req.auth && data.req.auth.id) || null
	};

	let insertData = {
		isActive: true
	};

	if (JSON.stringify(data.isActive)) {
		insertData.isActive = data.isActive
	}

	if (data.eventId) {
		insertData.eventId = data.eventId
	}

	let options = {
		upsert: true,
		new: true,
		setDefaultsOnInsert: true
	}

	console.log("=======bookmark insert data for user===", insertData)

	Bookmarks.findOneAndUpdate(findData, insertData, options, (err, res) => {
		if (err) {
			console.error("Unable to get User count: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "bookmarkUserEntity", null, null)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Bookmark added",
				"bookmarkUserEntity",
				null,
				null
			)
		);
	});
};
exports.bookmarkUserEntity = bookmarkUserEntity;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @returns Show interest in an event
 */
exports.addInterestInEvent = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.eventId || !(data.interestType) || !["INTERESTED", "NOT_INTERESTED"].includes(data.interestType)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addInterestInEvent", null, data.req.signature));
	};

	let findData = {
		eventId: data.eventId,
		userId: data.req.auth.id || null,
		//type:"EVENT_INTEREST"
	};

	let interestedCountToIncrease = 0, nonInterestedCountToIncrease = 0;
	let checkIfShownAnyInterest = await EventInterests.findOne(findData);

	if (checkIfShownAnyInterest) {
		if (checkIfShownAnyInterest.interestType == "INTERESTED" && data.interestType == "NOT_INTERESTED") {
			interestedCountToIncrease--;
			nonInterestedCountToIncrease++;
		};
		if (checkIfShownAnyInterest.interestType == "NOT_INTERESTED" && data.interestType == "INTERESTED") {
			interestedCountToIncrease++;
			nonInterestedCountToIncrease--;
		};
	} else {
		if (data.interestType == "NOT_INTERESTED") {
			nonInterestedCountToIncrease++;
		};
		if (data.interestType == "INTERESTED") {
			interestedCountToIncrease++;
		};
	}

	let insertData = {
		interestType: data.interestType
	};

	let options = {
		upsert: true,
		new: true,
		setDefaultsOnInsert: true
	};

	console.log("interestedCountToIncrease =>", interestedCountToIncrease);
	console.log("nonInterestedCountToIncrease =>", nonInterestedCountToIncrease);
	EventInterests.findOneAndUpdate(findData, insertData, options, (err, res) => {
		if (err) {
			console.error("Unable to get User count: ", err);
			return cb(responseUtilities.sendResponse(500, null, "addInterestInEvent", null, null));
		}

		let findEvent = {
			_id: data.eventId
		};

		let updateInterest = {
			$inc: {
				interestedUsers: interestedCountToIncrease,
				notInterestedUsers: nonInterestedCountToIncrease
			}
		};

		console.log("Event interest update => ", updateInterest)
		Events.findOneAndUpdate(findEvent, updateInterest, { new: true }, (errE, resE) => {
			if (errE) {
				return cb(responseUtilities.sendResponse(500, null, "addInterestInEvent", null, null));
			};
			return cb(null, responseUtilities.sendResponse(200, "Interest added", "addInterestInEvent", null, null));
		})
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @returns Show interest in an event
 */
exports.getMyBookmarks = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isActive: true,
		userId: (data.req.auth && data.req.auth.id) || null
	};

	let limit = parseInt(process.env.pageLimit);
	if (data.limit) {
		limit = parseInt(data.limit)
	}
	let skip = 0;
	if (data.currentPage) {
		skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
	}

	console.log("Bookmarks findData => ", findData, skip, limit)

	Bookmarks.find(findData)
		.populate([
			{
				path: "agendaId",
				populate: [
					{
						path: 'speakers',
						model: 'speakers'
					},
					{
						path: 'eventId',
						model: 'event'
					},
					{
						path: 'arenaId',
						model: 'arena'
					},
				]
			}
		])
		.sort({ createdAt: -1 })
		.exec(async (err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "getMyBookmarks", null, null));
			};

			res = JSON.parse(JSON.stringify(res));
			let DTS = [];
			// console.log("Bookmakrs => ", res)
			for (let i = 0; i < res.length; i++) {

				let insertData = {
					...res[i]
				};
				let agenda = JSON.parse(JSON.stringify(res[i].agendaId));
				let activeSpeakers = res[i].agendaId.speakers || [];
				activeSpeakers = activeSpeakers.filter(e => !e.isBlocked);

				insertData.agendaId.speakers = activeSpeakers;
				if (agenda?.eventId?.isActive) {
					DTS.push(insertData)
				}
			};

			let finalResponse = {
				data: DTS.slice(skip, Math.min(DTS.length, skip + limit)),
				limit: limit,
				count: DTS.length
			}
			return cb(null, responseUtilities.sendResponse(200, "", "getMyBookmarks", finalResponse, null));
		});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding token 
 */
exports.addInstalledDevicesToken = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.deviceToken) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addInstalledDeviceTokens", null, data.req.signature));
	};
	
	let waterFallFunctions = [];
	waterFallFunctions.push(async.apply(checkIfDeviceTokenExistsInUsers, data));
	waterFallFunctions.push(async.apply(addInstalledDeviceData, data));
	async.waterfall(waterFallFunctions, cb);

};

const checkIfDeviceTokenExistsInUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.deviceToken) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkTokenExistsInUsers", null, null));
	};

	Users.find({ isActive: true, isBlocked: false },{ deviceInfo: 1 }, (err, res) => {
		if(err){
			return cb(responseUtilities.sendResponse(500, null, "checkTokenExistsInUsers", null, null));
		}
		let users = res;
		let isExists = "false";
		if(users.length > 0){
			for(let i=0; i< users.length; i++){
				if(users[i].deviceInfo[0]){
					let devices = users[i].deviceInfo;
					// console.log("devices ", devices);
					for(let j=0; j < devices.length; j++){
						if(data.deviceToken == devices[j].token){
							isExists = "true"
						}
					}
				}
			}
		}
		console.log("isExists ", isExists);
		data.isTokenExists = isExists;

		let message = (isExists == "true") ? "Device token exists in users." : "Device token available to insert."
		
		return cb(null, responseUtilities.sendResponse(200, message, "checkTokenExistsInUsers", null, null));		

	});
};

const addInstalledDeviceData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.key || !data.deviceToken || !data.plateform) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addInstalledDeviceTokens", null, data.req.signature));
	};

	if(atob(data.key) !== "ems-b@ck&ndSup&r-s&cr&t"){
		return cb(responseUtilities.sendResponse(400, "Invalid key", "addInstalledDeviceTokens", null, data.req.signature));
	}
	if(data.isTokenExists == "false"){

		InstalledDevices.findOne({ deviceToken: data.deviceToken, key: data.key, plateform: data.plateform }, (errI, resI) => {
			if(errI){
				return cb(responseUtilities.sendResponse(500, null, "addInstalledDeviceTokens", null, null));
			}
			if (resI) {
				let date = new Date();
				console.log("today date ", date);
				let dataToUpdate = {
					createdAt: date,
					updatedAt: date
				}
				InstalledDevices.findOneAndUpdate({ deviceToken: data.deviceToken, key: data.key },{ $set: dataToUpdate },{ new: true, upsert: true }, (errU, resU) => {
					if (errU) {
						return cb(responseUtilities.sendResponse(500, null, "addInstalledDeviceTokens", null, null));
					}
					return cb(null, responseUtilities.sendResponse(200, "Device token updated successfully.", "addInstalledDeviceTokens", resU, null));
				});
			}else{
				// var secret = "ems-b@ck&ndSup&r-s&cr&t";
				// var b64 = btoa(secret);
				// console.log(b64);
				// var b64ca = "ZW1zLWJAY2smbmRTdXAmci1zJmNyJnQ=";
				// var bin = atob(b64ca);
			
				let insertData = {
					key: data.key,
					plateform: data.plateform,
					deviceToken: data.deviceToken
				};

				console.log("insertData => ", insertData)

				InstalledDevices.create(insertData, (err, res) => {
					if (err) {
						return cb(responseUtilities.sendResponse(500, null, "addInstalledDeviceTokens", null, null));
					}
					return cb(null, responseUtilities.sendResponse(200, "Device token added successfully.", "addInstalledDeviceTokens", res, null));
				});
			}
		});
	}else{
		return cb(null, responseUtilities.sendResponse(200, "Device token available in users.", "addInstalledDeviceTokens", null, null));
	}
};


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for deleting token 
 */
exports.deleteInstalledDevicesToken = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.deviceToken) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addInstalledDeviceTokens", null, data.req.signature));
	};
	
	let waterFallFunctions = [];
	waterFallFunctions.push(async.apply(checkIfDeviceTokenExistsInUsers, data));
	waterFallFunctions.push(async.apply(deleteInstalledDeviceData, data));
	async.waterfall(waterFallFunctions, cb);

};

const deleteInstalledDeviceData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.key || !data.deviceToken || !data.plateform) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "deleteInstalledDeviceTokens", null, data.req.signature));
	};

	if(atob(data.key) !== "ems-b@ck&ndSup&r-s&cr&t"){
		return cb(responseUtilities.sendResponse(400, "Invalid key", "deleteInstalledDeviceTokens", null, data.req.signature));
	}
	if(data.isTokenExists == "true"){
		InstalledDevices.findOne({ deviceToken: data.deviceToken, key: data.key, plateform: data.plateform }, (errI, resI) => {
			if(errI){
				return cb(responseUtilities.sendResponse(500, null, "deleteInstalledDeviceTokens", null, null));
			}
			if (resI) {
				InstalledDevices.deleteOne({ _id: resI._id  }, (errU, resU) => {
					if (errU) {
						return cb(responseUtilities.sendResponse(500, "Error occured while deleting", "deleteInstalledDeviceTokens", null, null));
					}
					return cb(null, responseUtilities.sendResponse(200, "Device token deleted successfully.", "deleteInstalledDeviceTokens", null, null));
				});
			}else{
				return cb(responseUtilities.sendResponse(500, "Something went wrong", "deleteInstalledDeviceTokens", null, null));
			}
		});
	}else{
		return cb(null, responseUtilities.sendResponse(200, "Device token does not exists in users.", "deleteInstalledDeviceTokens", null, null));
	}
};