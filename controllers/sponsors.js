const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

const path = require("path");

//helper
const responseUtilities = require("../helpers/sendResponse");

//models
const Sponsors = require("../models/sponsors");
const Events = require("../models/events");
const Packages = require("../models/packages");

const role = JSON.parse(process.env.role);

//controllers
const events = require("../controllers/events");
const users = require("../controllers/users");
const { checkIfInvalidEvent } = require("../controllers/events");



/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding sponsor
 */
exports.addSponsor =async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (
		!data.title || !data.email || !data.name || !data.designation ||
		!data.company || !data.website || !data.businessSector || !data.eventId ||
		!data.packageId || !data.goal || !data.country || !data.companyDescription ||
		!data.businessEmail
	) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addSponsor", null, data.req.signature));
	}


	console.log("Data.eventids => ", data.eventId);
	data.eventIds = [data.eventId];
	data.packageIds = [data.packageId];
	console.log("Modified => ", data.eventIds, data.packageIds);

	if (data.packageId) {
		let package = await Packages.findOne({ _id: data.packageId });
		if (!package) {
			return cb(responseUtilities.sendResponse(400, "Package not found.", "addSponsor", null, data.req.signature));
		};
		if (!package.isActive) {
			return cb(responseUtilities.sendResponse(400, "Package not active.", "addSponsor", null, data.req.signature));
		}
		if (!package.type || package.type != "Sponsor") {
			return cb(responseUtilities.sendResponse(400, "Invalid Package selected.", "addSponsor", null, data.req.signature));
		}
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkIfSponsorAlreadyExistForEvent, data));
	waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	waterfallFunctions.push(async.apply(users.findUserByEmail, data));
	waterfallFunctions.push(async.apply(addSponsorData, data));
	async.waterfall(waterfallFunctions, cb);

};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller to check If Sponsor Already Exist For Event
 */
const checkIfSponsorAlreadyExistForEvent = async function (data, response, cb) {

	if (!cb) {
		cb = response;
	}

	// User can be assigned a role in multiple events
	let events = data.eventIds;

	let isAssignedInAnyEvent = false;

	let repeatedEventName = "";
	for (let i = 0; i < events.length; i++) {

		//check if the user is not added as any speaker in the individual event
		let findData = {
			eventId: events[i],
			email: data.email
		}
		if (data.req.auth.role == role.eventadmin) {
			findData.eventAdminId = data.req.auth.id
		}
		if (data.req.auth.role == role.eventmanager) {
			findData.eventAdminId = data.req.auth.eventAdminId
		}

		console.log("FindData => ", findData);
		let res = await Sponsors.findOne(findData).populate("eventId").exec();
		if (res) {
			console.log("He is already as sponsor as => ", res.name);
			isAssignedInAnyEvent = true;
			repeatedEventName = res.eventId ? res.eventId.name : null;
			break;
		}
	}
	if (isAssignedInAnyEvent) {
		return cb(
			responseUtilities.sendResponse(
				400,
				`This email is already available as sponsor for event ${repeatedEventName}`,
				"addSpeaker",
				null,
				data.req.signature
			)
		);
	} else {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Proceed to add sponsor",
				"addSpeaker",
				null,
				data.req.signature
			)
		);
	}
}
exports.checkIfSponsorAlreadyExistForEvent = checkIfSponsorAlreadyExistForEvent;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Sponsor Data 
 */
const addSponsorData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let allEvents = data.eventIds;
	let allPackages = data.packageIds;
	let insertSponsorData = [];
	for (let i = 0; i < allEvents.length; i++) {
		let insertData = {
			email: data.email,
			isActive: true,
			// eventAdminId: data.req.auth.id,
			status: "UNDER_REVIEW",
			eventId: allEvents[i],
			packageId: allPackages[i]
		}
		if (data.req.auth.role == role.eventadmin) {
			insertData.eventAdminId = data.req.auth.id
		}
		if (data.req.auth.role == role.eventmanager) {
			insertData.eventAdminId = data.req.auth.eventAdminId
		}
		if (data.name) {
			insertData.name = data.name
		}
		if (data.title) {
			insertData.title = data.title
		}
		if (data.designation) {
			insertData.designation = data.designation
		}
		if (data.goal) {
			insertData.goal = data.goal
		}
		if (data.logo) {
			insertData.logo = data.logo
		}
		if (data.businessSector) {
			insertData.businessSector = data.businessSector
		}
		if (data.company) {
			insertData.company = data.company
		}
		if (data.website) {
			insertData.website = data.website
		}
		if (data.country) {
			insertData.country = data.country
		}
		if (data.phone) {
			insertData.phone = data.phone
		}
		if (data.whatsAppMobile) {
			insertData.whatsAppMobile = data.whatsAppMobile
		}
		if (JSON.stringify(data.phoneCode)) {
			insertData.phoneCode = data.phoneCode
		}
		if (JSON.stringify(data.whatsAppMobileCode)) {
			insertData.whatsAppMobileCode = data.whatsAppMobileCode
		}
		if (data.companyDescription) {
			insertData.companyDescription = data.companyDescription
		}
		if (data.linkedin) {
			insertData.linkedin = data.linkedin
		}
		if (data.twitter) {
			insertData.twitter = data.twitter
		}
		if (data.telegram) {
			insertData.telegram = data.telegram
		}
		if (data.businessEmail) {
			insertData.businessEmail = data.businessEmail
		}
		insertSponsorData.push(insertData);
	}
	Sponsors.insertMany(insertSponsorData, (err, res) => {
		if (err) {
			console.error("Unable to Add Sponsor: ", err);
			return cb(responseUtilities.sendResponse(500, null, "addSponsorData", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Sponsor added", "addSponsorData", null, data.req.signature));
	});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all sponsors for admin : Pagination 
 */
exports.getAllSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if ([role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	let check = mongoose.Types.ObjectId;

	if (data.eventId) {
		if (!check.isValid(data.eventId)) {
			return cb(responseUtilities.sendResponse(400, "Invalid Parameter", "getAllSponsors", null, data.req.signature));
		}
		findData.eventId = data.eventId
	}

	if (data.agencyId && check.isValid(data.agencyId)) {
		findData.eventAdminId = data.agencyId
	}

	if (JSON.stringify(data.assigned)) {
		if (data.assigned == true || data.assigned == "true") {
			findData.status = "ASSIGNED"
		} else {
			findData.status = "UNDER_REVIEW"
		}
	};

	Sponsors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for sponsors: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getAllSponsors", null, null));

		}
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (data.currentPage) {
			skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
		}
		Sponsors.find(findData)
			.populate("eventId country packageId")
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get sponsors: ", err);
					return cb(responseUtilities.sendResponse(500, null, "getAllSponsors", null, null));
				}
				let sendData = {
					data: res,
					count: count,
					pageLimit: limit,
				};
				return cb(null, responseUtilities.sendResponse(200, "All Sponsors fetched for admin", "getAllSponsors", sendData, null));
			});
	});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all sponsors lists
 */
exports.getSponsor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findSponsorsOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findEventSponsors, data));
	async.waterfall(waterfallFunctions, cb);

};

const findSponsorsOfEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findSpeakersOfEvent",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.eventId
	}
	if (data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}
	Events.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findSpeakersOfEvent",
						null,
						null
					)
				);
			}
			let sponsors = (res && res.sponsors) || null;
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Sponsors fetched",
					"findSpeakersOfEvent",
					sponsors,
					null
				)
			);
		});
};

const findEventSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
	};
	// if (data.eventSpecific && response.data) {
	// 	findData._id = { $nin: response.data }
	// }

	if (data.name) {
		findData["name"] = { '$regex': `${data.name}`, '$options': 'i' }
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	console.log("Find Sponsors => ", findData)
	Sponsors.find(findData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Sponsors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findEventSponsors",
						null,
						null
					)
				);
			}
			let sendData = {
				data: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Sponsors fetched",
					"findEventSponsors",
					sendData,
					null
				)
			);
		});
}

//controler for getting events associated to media
exports.getSponsorEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.sponsorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getSpeakerEvents",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];

	waterfallFunctions.push(async.apply(findSponsorDetails, data));
	waterfallFunctions.push(async.apply(findEventsAssociatedToSponsors, data));
	async.waterfall(waterfallFunctions, cb);

};

//controler for getting events associated to media
exports.getEventSponsorsByPackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	console.log("inn get sponsor by package")
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getEventSponsorsByPackage",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		status: "ASSIGNED",
		isDeleted: false
	}
	let pipeline = [
		{
			"$match": findData
		},
		{
			"$lookup": {
				from: "packages",
				localField: "packageId",
				foreignField: "_id",
				as: "package"
			}
		},
		{
			$unwind: "$package"

		},
		{
			"$group": {
				_id: "$package.title",
				sponsors: {
					"$addToSet": {
						"data": "$$ROOT"
					}
				}
			}
		}
	]
	console.log("==============sponsor by package pipeline====", pipeline)
	Sponsors.aggregate(pipeline)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get sponsor: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getEventSponsorsByPackage", null, null)
				);
			}

			let sendData = {
				data: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Sponsors by package fetched",
					"getEventSponsorsByPackage",
					sendData,
					null
				)
			);
		})

	// let waterfallFunctions = [];

	// waterfallFunctions.push(async.apply(findSponsorDetails, data));
	// waterfallFunctions.push(async.apply(findEventsAssociatedToSponsors, data));
	// async.waterfall(waterfallFunctions, cb);

};

//Contoller for sponsor by id
exports.getSponsorById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getSponsorById",
				null,
				data.req.signature
			)
		);
	}

	if (!mongoose.Types.ObjectId.isValid(data.id)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid Parameter",
				"getSponsorById",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.id,
		isDeleted: false,
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	Sponsors.findOne(findData)
		.populate('country')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get sponsor: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getSponsorById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						404,
						"Sponsor not found",
						"getSponsorById",
						null,
						data.req.signature
					)
				);
			}
			let sendData = {
				data: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Sponsor fetched by id",
					"getSponsorById",
					sendData,
					null
				)
			);
		});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for updating sponsor
 */
exports.updateSponsor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.sponsorId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateSponsor", null, data.req.signature));
	}

	let waterfallFunctions = [];

	waterfallFunctions.push(async.apply(findSponsorDetails, data));
	if (data.email) {
		waterfallFunctions.push(async.apply(checkIfEmailExistForEvent, data));
	}
	waterfallFunctions.push(async.apply(updateSponsorDetails, data));
	async.waterfall(waterfallFunctions, cb);

};

const updateSponsorDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.sponsorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateSponsorDetails",
				null,
				null
			)
		);
	}
	let findData = {
		_id: data.sponsorId
	};

	let addToSetData = {};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = data;

	Sponsors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update sponsor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateSponsorDetails",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Sponsor updated",
				"updateSponsorDetails",
				null,
				null
			)
		);
	});
}

const checkIfEmailExistForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!response.data || !response.data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Sponsor not found",
				"checkIfEmailExistForEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $ne: data.sponsorId },
		eventId: response.data.eventId,
		email: data.email,
		isDeleted: false,
	};

	if (response.data.packageId) {
		findData.packageId = response.data.packageId
	}
	console.log("==========find by email data=====", findData)
	Sponsors.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Media: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "checkIfEmailExistForEvent", null, null)
			);
		}
		if (res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Sponsor email already exist for event",
					"checkIfEmailExistForEvent",
					null,
					data.req.signature
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Sponsor not exist for the email",
				"checkIfEmailExistForEvent",
				res,
				null
			)
		);
	});
}


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update sponsor block status
 */
exports.updateSponsorBlockStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.sponsorId || !JSON.stringify(data.isBlocked)) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "updateSponsorBlockStatus", null, null));

	}
	let findData = {
		_id: data.sponsorId
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents },
			findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = {
		isBlocked: data.isBlocked,
		status: "UNDER_REVIEW"
	};

	Sponsors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Sponsors", err);
			return cb(responseUtilities.sendResponse(500, null, "updateSponsorBlockStatus", null, null));

		}
		return cb(null, responseUtilities.sendResponse(200, "Sponsor block status updated", "updateSponsorBlockStatus", null, null));
	});
};



/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting sponsor by id
 */
const findSponsorDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.sponsorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findSponsorDetails",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.sponsorId,
		isDeleted: false,
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	Sponsors.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Sponsor: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "findSponsorDetails", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					404,
					"Sponsor not found",
					"findSponsorDetails",
					null,
					data.req.signature
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Sponsor fetched by id",
				"findSponsorDetails",
				res,
				null
			)
		);
	});
};

const findEventsAssociatedToSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.sponsorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findEventsAssociatedToSponsors",
				null,
				data.req.signature
			)
		);
	}

	let sponsorRes = JSON.parse(JSON.stringify(response.data));
	if (!sponsorRes) {
		return cb(
			responseUtilities.sendResponse(
				404,
				"Sponsor not found",
				"findEventsAssociatedToSponsors",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		status: "ASSIGNED",
		isDeleted: false,
		email: sponsorRes.email
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Sponsors.find(findData)
		.populate("eventId")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findEventsAssociatedToSponsors",
						null,
						null
					)
				);
			}
			let allEventsAssignedToSponsor = [];
			for (let i = 0; i < res.length; i++) {
				let obj = {
					name: (res[i].eventId && res[i].eventId.name) || null
				}
				if (obj.name && !allEventsAssignedToSponsor.includes(obj.name)) {
					allEventsAssignedToSponsor.push(obj)
				}
			}

			sponsorRes["events"] = allEventsAssignedToSponsor;
			let sendData = {
				data: sponsorRes
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Sponsor Events fetched",
					"findEventsAssociatedToSponsors",
					sendData,
					null
				)
			);
		});
}

exports.getSponsorsForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findSponsorsOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findSponsorsForEvent, data));
	async.waterfall(waterfallFunctions, cb);

};

const findSponsorsForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
	};

	let sortOrder = {}
	let assignedSponsorIds = response.data || [];
	// if (data.eventSpecific && response.data) {
	// 	findData._id = { $nin: response.data }
	// }


	if (data.name) {
		const regex = /^[^*|\":<>[\]{}`\\()';&$]+$/;
		if (!regex.test(data.name)) {
			console.log("Invalid input");
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid search input",
					"findSponsorsForEvent",
					null,
					data.req.signature
				)
			);
		}
		findData["name"] = { '$regex': `${data.name}`, '$options': 'i' }
	}
	if (data.email) {
		findData.email = data.email
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	// findData.eventadmin = data.req.auth.id
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	if (data.eventSpecific) {
		sortOrder = { updatedAt: -1 }
	} else {
		sortOrder = { createdAt: -1 }
	}

	Sponsors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for medias: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"findSponsorsForEvent",
					null,
					null
				)
			);
		}
		console.log("count for media=======", count)
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (!data.currentPage) {
			data.currentPage = Math.ceil(count / limit);
		}
		skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
		Sponsors.find(findData)
			.skip(skip)
			.limit(limit)
			.sort(sortOrder)
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get Sponsors: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"findSponsorsForEvent",
							null,
							null
						)
					);
				}
				let sponsorRes = JSON.parse(JSON.stringify(res))
				// for(let id of assignedSponsorIds){
				// 	let index = sponsorRes.findIndex(s => s._id.toString() == id.toString())
				// 	if(index >= 0){
				// 		sponsorRes[index]["assigned"] = true
				// 	}
				// }
				let sendData = {
					data: sponsorRes,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"All Sponsors fetched for event",
						"findSponsorsForEvent",
						sendData,
						null
					)
				);
			});
	});
}


exports.getLatestSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getLatestSponsors",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
		eventId: data.eventId,
		status: "ASSIGNED"
	};

	let project = {
		createdAt: 0
	}

	if (!data.req.auth) {
		project = {
			name: 1,
			email: 1,
			designation: 1,
			logo: 1,
			website: 1,
			company: 1,
		}
	}

	let appMemberLimit = parseInt(process.env.appMemberLimit);
	console.log("Find Sponsors => ", findData)
	Sponsors.find(findData, project)
		.populate('packageId country')
		.limit(appMemberLimit)
		.sort({ updatedAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getLatestSponsors",
						null,
						null
					)
				);
			}
			let sendData = {
				data: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Sponsors fetched",
					"getLatestSponsors",
					sendData,
					null
				)
			);
		});
}


/** Export all sponsors */
exports.exportAllSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	};

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = JSON.parse(data.isBlocked)
	}

	if (JSON.stringify(data.assigned)) {
		if ([true, "true"].includes(data.assigned)) {
			findData.status = "ASSIGNED"
		} else {
			findData.status = "UNDER_REVIEW";
		}
	};

	if (data.search) {
		console.log("data.search => ", data.search)
		findData["$or"] = [
			{ name: { "$regex": data.search, "$options": "i" } },
			{ email: { "$regex": data.search, "$options": "i" } },
			{ title: { "$regex": data.search, "$options": "i" } }
		]
	}

	console.log("findData => ", findData)

	if (data.agencyId) {
		findData.eventAdminId = data.agencyId
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.packageId) {
		findData.packageId = data.packageId
	}

	let populateData = " eventId eventAdminId packageId country "
	console.log("Populate Data => ", populateData)
	Sponsors.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding exportAllSponsors => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllSponsors", err, null));
			}

			if (!res.length) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"No Record(s) found",
						"exportAllSponsors",
						null,
						null
					)
				);
			}
			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let sponsor = res[i];
				if (data.eventId && !sponsor.eventId) {
					continue;
				}
				if (data.agencyId && !sponsor.eventAdminId) {
					continue;
				}
				if (data.packageId && !sponsor.packageId) {
					continue;
				}

				let fieldObject = {
					"Agency": sponsor?.eventAdminId?.name,
					"Event": sponsor?.eventId?.name,
					"Package": sponsor?.packageId?.title,
					"Package Type": sponsor?.packageId?.type,
					"Title": sponsor.title,
					"Name": sponsor.name,
					"Email": sponsor.email,
					"Whatsapp Mobile": sponsor?.whatsAppMobile,
					"Goal": sponsor?.goal,
					"Country": sponsor.country?.name,
					"Business Sector": sponsor?.businessSector,
					"Designation": sponsor?.designation,
					"Company": sponsor?.company,
					"Website": sponsor?.website,
					"Status": sponsor?.status,
					"Linkedin": sponsor?.linkedin,
					"Twitter": sponsor?.twitter,
					"Telegram": sponsor?.telegram
				}
				dataArray.push(fieldObject);
			}

			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllSponsors", null, null));

			}
			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportAllSponsors", dataArray, null));
		})
}