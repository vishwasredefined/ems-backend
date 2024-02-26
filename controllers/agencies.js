const async = require('async');
const moment = require('moment');
const mongoose = require("mongoose");
const authController = require("./auth")

//models
const Users = require('../models/users');
const Speakers = require("../models/speakers");
const Sponsors = require("../models/sponsors");
const MediaPartners = require("../models/medias");
const Exhibitors = require("../models/exhibitors");
const Events = require("../models/events");
const TeamMembers = require("../models/teamMembers");

//Utilities
const utilities = require('../helpers/security');
const responseUtilities = require("../helpers/sendResponse");
let emailUtilities = require("../helpers/email");

let allRoles = JSON.parse(process.env.role);

/* Add Agency By SuperAdmin Only */
exports.addEventadmin = function (data, response, cb) {
	if (!cb) cb = response;

	if (!data.email || !data.name) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"addEventadmin",
				null,
				data.req.signature
			)
		);
	}

	if (process.env.DEV == 'true') {
		data.password = "123456789"
	} else {
		data.password = (Math.random() + 1).toString(36).substring(2);
	}
	console.log("System Generated Password => ", data.password);

	let waterFallFunctions = [];
	waterFallFunctions.push(async.apply(checkIfEmailAlreadyExist, data));
	waterFallFunctions.push(async.apply(utilities.generatePassword, data.password));
	waterFallFunctions.push(async.apply(authController.generateAccountId, data));
	waterFallFunctions.push(async.apply(addAgencyData, data));
	waterFallFunctions.push(async.apply(sendEmailToAgencyOnAddition, data));
	async.waterfall(waterFallFunctions, cb);
}

const checkIfEmailAlreadyExist = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = { email: data.email };

	Users.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to update User: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateUser", null, null)
			);
		}
		if (!res) {
			console.log("Ok , email can be addded");
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Proceed Ahead",
					"checkIfEmailAlreadyExist",
					null,
					data.req.signature
				)
			);
		} else {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Email Already Exist",
					"checkIfEmailAlreadyExist",
					null,
					data.req.signature
				)
			);
		}
	});
};

const addAgencyData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let hash = null;
	let salt = null;
	let accountId = null;

	if (response.data) {
		hash = response.data.hash;
		salt = response.data.salt;
		accountId = response.data.accountId;
	}
	if (!hash || !salt || !accountId) {
		console.error("no hash/salt/accountId");
		return cb(responseUtilities.sendResponse(500, "no hash/salt/accountId", "insertUser", null, data.req.signature));
	}

	let updateData = {};
	updateData.name = data.name;
	updateData.password = hash;
	updateData.salt = salt;
	updateData.accountId = accountId;
	updateData.isActive = true;
	updateData.emailVerified = true;
	updateData.provider = "email";
	updateData.addedBy = data.req.auth.id;
	updateData.role = JSON.parse(process.env.role).eventadmin;

	let findData = {
		email: data.email
	}
	let options = {
		upsert: true,
		new: true,
		setDefaultsOnInsert: true
	}
	console.log("Find Agency => ", findData);
	console.log("Insert  Agency => ", updateData);

	Users.findOneAndUpdate(findData, updateData, options, function (err, res) {
		if (err) {
			console.error(err);
			return cb(responseUtilities.sendResponse(500, null, "insertUser", null, data.req.signature));
		}
		return cb(null, responseUtilities.sendResponse(200, "User Added", "insertUser", res, data.req.signature));
	});
};

const sendEmailToAgencyOnAddition = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	emailUtilities.sendRegistrationEmailToAgency(data, (err, res) => {
		if (err) {
			return cb(
				responseUtilities.sendResponse(500, null, "sendEmailToAgency", null, null)
			);
		}
		console.log("Emailsent to agency on addition => ", res)
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Email Sent to agency with credentials",
				"sendEmailToAgency",
				response.data,
				data.req.signature
			)
		);
	});
};

//Contoller for events by id
const getAgencyById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.userId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getAgencyById",
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
				"getAgencyById",
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
					responseUtilities.sendResponse(500, null, "getAgencyById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"User not found",
						"getAgencyById",
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
					"getAgencyById",
					sendData,
					null
				)
			);
		});
};
exports.getAgencyById = getAgencyById;

//Contoller for update agency detail
exports.updateAgencyDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.userId && !data.eventAdminId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateAgencyDetails",
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
		updateData["userMeta.logo"] = data.logo
	}
	if (data.country) {
		updateData["userMeta.country"] = data.country
	}
	if (data.city) {
		updateData["userMeta.city"] = data.city
	}
	if (data.state) {
		updateData["userMeta.state"] = data.state
	}
	if (data.mobileCode) {
		updateData["userMeta.mobileCode"] = data.mobileCode
	}
	if (data.contactPersonName) {
		updateData["userMeta.contactPersonName"] = data.contactPersonName
	}
	if (data.contactPersonMobile) {
		updateData["userMeta.contactPersonMobile"] = data.contactPersonMobile
	}
	if (data.contactPersonDesignation) {
		updateData["userMeta.contactPersonDesignation"] = data.contactPersonDesignation
	}
	if (data.description) {
		updateData["userMeta.description"] = data.description
	}
	if (data.website) {
		updateData["userMeta.website"] = data.website
	}
	if (data.industry) {
		updateData["userMeta.industry"] = data.industry
	}
	if (data.twitter) {
		updateData["socials.twitter"] = data.twitter
	}
	if (data.linkedin) {
		updateData["socials.linkedin"] = data.linkedin
	}
	if (data.telegram) {
		updateData["socials.telegram"] = data.telegram
	}
	if (data.youtube) {
		updateData["socials.youtube"] = data.youtube
	}
	if (data.instagram) {
		updateData["socials.instagram"] = data.instagram
	}

	console.log("Find Event admin => ", findData);
	console.log("update Event admin => ", updateData);

	Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update User: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateAgencyDetails", null, null)
			);
		}
		let markCompleteProfile = {};
		if (
			res.name &&
			res.userMeta && 
			res.userMeta.contactPersonName &&
			res.userMeta.contactPersonMobile &&
			res.userMeta.contactPersonDesignation &&
			res.userMeta.country &&
			res.userMeta.state &&
			res.userMeta.city &&
			res.userMeta.logo
		) {
			markCompleteProfile.profileCompleted = true;
		} else {
			markCompleteProfile.profileCompleted = false;
		}

		Users.findOneAndUpdate(findData, markCompleteProfile, { new: true }, (errProfile, resProfile) => {
			if (errProfile) {
				console.error("Unable to update User: ", errProfile);
				return cb(
					responseUtilities.sendResponse(500, null, "updateAgencyDetails", null, null)
				);
			}
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User updated",
					"updateAgencyDetails",
					resProfile,
					data.req.signature
				)
			);
		});
	});
};

exports.blockEventAdmin = function (data, response, cb) {
	if (!cb) cb = response;

	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"blockEventAdmin",
				null,
				data.req.signature
			)
		);
	}
	console.log("Data => ", data);

	let waterFallFunctions = [];
	waterFallFunctions.push(async.apply(blockEventAdminUserAndTeamMembers, data));
	async.waterfall(waterFallFunctions, cb);
}

const blockEventAdminUserAndTeamMembers = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"blockEventAdmin",
				null,
				data.req.signature
			)
		);
	}

	let eventAdmin = await Users.findOne({ _id: data.id, role: "eventadmin" });
	if (!eventAdmin) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Event Agency Not found",
				"blockEventAdmin",
				null,
				data.req.signature
			)
		);
	}

	let allPromises = [];

	// Block everyone associated to Event Agency
	if (data.isBlocked == true || data.isblocked == "true") {

		let updateEventAdminStatus = Users.updateMany({ "_id": data.id }, { isBlocked: data.isBlocked });
		let updateUsersStatus = Users.updateMany({ "eventAdminId": eventAdmin._id }, { isBlocked: data.isBlocked });
		let updateSpeakersAddedStatus = Speakers.updateMany({ "eventAdminId": eventAdmin._id }, { isBlocked: data.isBlocked });
		let updateSponsorsStatus = Sponsors.updateMany({ "eventAdminId": eventAdmin._id }, { isBlocked: data.isBlocked });
		let updateMediaPartnersStatus = MediaPartners.updateMany({ "eventAdminId": eventAdmin._id }, { isBlocked: data.isBlocked });
		let updateExhibitorsStatus = Exhibitors.updateMany({ "eventAdminId": eventAdmin._id }, { isBlocked: data.isBlocked });
		let updateEventStatus = Events.updateMany({ "eventAdminId": data.id }, { isActive: data.isBlocked });

		allPromises = [
			updateEventAdminStatus,
			updateUsersStatus,
			updateSpeakersAddedStatus,
			updateSponsorsStatus,
			updateMediaPartnersStatus,
			updateExhibitorsStatus,
			updateEventStatus
		]
	} else if (data.isBlocked == false || data.isblocked == "false") {
		let updateEventAdminStatus = Users.updateOne({ "_id": data.id }, { isBlocked: false, isActive: true });
		allPromises = [
			updateEventAdminStatus
		]
	}
	Promise.all(allPromises).then((res) => {
		console.log("Res", res);
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				data.isBlocked ? "Blocked event Agency" : "Unblocked event Agency",
				"blockEventAdmin",
				res,
				data.req.signature
			)
		);
	})
		.catch((err) => {
			console.log("Err", err);
			return cb(
				responseUtilities.sendResponse(400, "Unable to block", "blockEventAdmin", err, null)
			);
		})

	// let findData = {
	// 	$or: [
	// 		{ _id: data.id },
	// 		{ addedBy: data.id },
	// 		{ eventAdminId: data.id }
	// 	]
	// }


	// let updateData = {
	// 	isActive: false,
	// 	isBlocked: true
	// }

	// let options = {
	// 	new: true
	// }
	// console.log("Find Event Admin user => ", findData);
	// console.log("Update Event Admin user status=> ", updateData);

	// Users.findOneAndUpdate(findData, updateData, options, (err, res) => {
	// 	if (err) {
	// 		console.error("Unable to update User: ", err);
	// 		return cb(
	// 			responseUtilities.sendResponse(500, null, "blockEventAdmin", null, null)
	// 		);
	// 	}
	// 	console.log("Response of block eventAdmin => ", res)
	// 	return cb(
	// 		null,
	// 		responseUtilities.sendResponse(
	// 			200,
	// 			"Blocked event admin",
	// 			"blockEventAdmin",
	// 			res,
	// 			data.req.signature
	// 		)
	// 	);

	// });
};

exports.getEventadmins = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = { role: "eventadmin" };

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = JSON.parse(data.isBlocked)
	}

	if (data.search) {
		const regex =  /^[^*|\":<>[\]{}`\\()';&$]+$/;
		if (!regex.test(data.search)) {
			console.log("Invalid input");
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid search input",
					"getEventadmins",
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

	let limit = parseInt(process.env.pageLimit);
	if (data.limit) {
		limit = parseInt(data.limit)
	}
	let skip = 0;
	if (data.currentPage) {
		skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
	}
	console.log("Data findData =>", findData)
	let pipeline = [
		{ $match: findData },
		{
			$lookup: {
				from: "events",
				localField: "_id",
				foreignField: "managedBy",
				as: "events"
			}
		},
		{ $unwind: { path: "$events", preserveNullAndEmptyArrays: true } },
		{ $lookup: { from: "countries", localField: "userMeta.country", foreignField: "_id", as: "userMeta.country" } },
		{ $lookup: { from: "cities", localField: "userMeta.city", foreignField: "_id", as: "userMeta.city" } },
		{ $lookup: { from: "states", localField: "userMeta.state", foreignField: "_id", as: "userMeta.state" } },
		{ $unwind: { path: "$userMeta.country", preserveNullAndEmptyArrays: true } },
		{ $unwind: { path: "$userMeta.state", preserveNullAndEmptyArrays: true } },
		{ $unwind: { path: "$userMeta.city", preserveNullAndEmptyArrays: true } },
		{
			$group:
			{
				"_id": "$_id",
				"agencyDetails": { $first: "$$ROOT" },
				"allevents": { "$push": "$events" },
				"completedEvents": {
					$sum: {
						"$cond": [
							{ $eq: ["$events.expired", true] },
							1,
							0
						]
					}
				},
				"totalEvents": {
					$sum: {
						"$cond": [
							{ $eq: ["$events.isDeleted", false] },
							1,
							0
						]
					}
				},
				"activeEvents": {
					$sum: {
						"$cond": [
							{
								$eq: ["$events.isActive", true]
							},
							1,
							0
						]
					}
				}
			}
		},
		{ $sort: { "agencyDetails.createdAt": -1 } },
		{
			'$facet':
			{
				metaData: [
					{ $count: "total" },
					{ $addFields: { pageLimit: limit } }
				],
				data: [
					{ $skip: skip },
					{ $limit: limit }
				]
			}
		}
	]

	Users.aggregate(pipeline, (err, res) => {
		if (err) {
			console.error("Could not get count for events: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getEventadmins",
					null,
					null
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"All event admins",
				"getEventadmins",
				res,
				null
			)
		);
	})
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

exports.agencyGetTeamMemberList = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.role) {
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
		role: data.role,
	};
	if (data.req.auth.role == allRoles.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.email) {
		findData.email = { "$regex": data.email, "$options": "i" }
	}
	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = data.isBlocked
	}
	Users.find(findData, { password: 0, salt: 0, accountId: 0 })
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event agencies: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getEventadmins",
						null,
						null
					)
				);
			}

			// console.log("Event Admin Liiiiisting => ", sendData)
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All event admins",
					"getEventadmins",
					res,
					null
				)
			);
		});
};

exports.getEventadminsWithoutPagination = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		role: "eventadmin",
		isBlocked: false
	};

	Users.find(findData, { name: 1, _id: 1 })
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event agencies: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getEventadmins",
						null,
						null
					)
				);
			}

			// console.log("Event Admin Liiiiisting  without=> ", res)
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All event admins",
					"getEventadmins",
					res,
					null
				)
			);
		});
};

//Contoller for events by id
const agencyGetProfileDetail = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		_id: data.req.auth.id
	};

	Users.findOne(findData)
		.populate(" userMeta.country , userMeta.state , userMeta.city ")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get User: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getAgencyById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"User/agency not found",
						"getAgencyById",
						null,
						data.req.signature
					)
				);
			}
			// console.log("Get user by id =>", res)
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"User/agency fetched by id",
					"getAgencyById",
					res,
					null
				)
			);
		});
};
exports.agencyGetProfileDetail = agencyGetProfileDetail;

exports.agencyUpdateProfileDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		_id: data.req.auth.id
	};

	delete data.email;

	let updateData = {};
	let userMeta = {};
	if (data.name) {
		updateData.name = data.name
	}
	if (data.logo) {
		updateData["userMeta.logo"] = data.logo
	}
	if (data.country) {
		updateData["userMeta.country"] = data.country
	}
	if (data.city) {
		updateData["userMeta.city"] = data.city
	}
	if (data.state) {
		updateData["userMeta.state"] = data.state
	}
	if (data.mobileCode) {
		updateData["userMeta.mobileCode"] = data.mobileCode
	}
	if (data.contactPersonName) {
		updateData["userMeta.contactPersonName"] = data.contactPersonName
	}
	if (data.contactPersonMobile) {
		updateData["userMeta.contactPersonMobile"] = data.contactPersonMobile
	}
	if (data.contactPersonDesignation) {
		updateData["userMeta.contactPersonDesignation"] = data.contactPersonDesignation
	}
	if (data.description) {
		updateData["userMeta.description"] = data.description
	}
	if (data.website) {
		updateData["userMeta.website"] = data.website
	}
	if (data.industry) {
		updateData["userMeta.industry"] = data.industry
	}
	if (data.twitter) {
		updateData["socials.twitter"] = data.twitter
	}
	if (data.linkedin) {
		updateData["socials.linkedin"] = data.linkedin
	}
	if (data.telegram) {
		updateData["socials.telegram"] = data.telegram
	}
	if (data.youtube) {
		updateData["socials.youtube"] = data.youtube
	}
	if (data.instagram) {
		updateData["socials.instagram"] = data.instagram
	}

	// if (JSON.stringify(userMeta) === '{}') {
	// } else {
	// 	updateData.userMeta = userMeta
	// }

	console.log("Find Event admin => ", findData);
	console.log("update Event admin => ", updateData);

	Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update User: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateAgencyDetails", null, null)
			);
		}
		let markProfileCompleted = {

		}
		if(
			res.name && 
			res.userMeta.contactPersonName && 
			res.userMeta.contactPersonMobile && 
			res.userMeta.contactPersonDesignation && 
			res.userMeta.state && 
			res.userMeta.city && 
			res.userMeta.logo
		){
			markProfileCompleted.profileCompleted = true;
		}else{
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
					"User/agency updated",
					"updateAgencyDetails",
					userRes,
					data.req.signature
				)
			);
		})	
	});
};