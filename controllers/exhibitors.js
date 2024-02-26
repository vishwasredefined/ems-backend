const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");
const path = require("path");

//helper
const responseUtilities = require("../helpers/sendResponse");

//models
const Exhibitors = require("../models/exhibitors");
const Events = require("../models/events");
const Packages = require("../models/packages");

const role = JSON.parse(process.env.role);

//controllers
const events = require("../controllers/events");
const users = require("../controllers/users");
const { checkIfInvalidEvent } = require("../controllers/events");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding exhibitor
 */
exports.addExhibitor = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.email || !data.name || !data.goal || !data.businessSector || !data.designation || !data.company || !data.website || !data.eventId || !data.packageId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addExhibitor", null, data.req.signature));
	}


	data.eventIds = [data.eventId];
	data.packageIds = [data.packageId];
	console.log("data.eventIds", data.eventIds)
	console.log("data.packageIds", data.packageIds)

	if (data.packageId) {
		let package = await Packages.findOne({ _id: data.packageId });
		if (!package) {
			return cb(responseUtilities.sendResponse(400, "Package not found.", "addExhibitor", null, data.req.signature));
		};
		if (!package.isActive) {
			return cb(responseUtilities.sendResponse(400, "Package not active.", "addExhibitor", null, data.req.signature));
		}
		if (!package.type || package.type != "Exhibitor") {
			return cb(responseUtilities.sendResponse(400, "Invalid Package selected.", "addExhibitor", null, data.req.signature));
		}
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	waterfallFunctions.push(async.apply(checkIfExhibitorAlreadyExistForEvent, data));
	waterfallFunctions.push(async.apply(users.findUserByEmail, data));
	waterfallFunctions.push(async.apply(addExhibitorData, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Checks If  Exhibitor Already Exist For Event
 */
const checkIfExhibitorAlreadyExistForEvent = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	// user can be assigned a role in multiple events
	let events = data.eventIds;

	let isAvailableInAnyEvent = false;
	let validEvent = true;

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

		let findEvent = {
			_id: events[i],
			managedBy: data.req.auth.eventAdminId || data.req.auth.id
		};
		console.log("FindEvent => ", findEvent)
		let event = await Events.findOne(findEvent);
		// console.log("Event => ", event)
		if (!event) {
			validEvent = false;
			break;
		}
		if (event.expired || !event.isActive || event.isDeleted) {
			validEvent = false;
			break;
		};

		console.log("FindData => ", findData);
		let res = await Exhibitors.findOne(findData).populate("eventId").exec();
		if (res) {
			console.log("He is already as exhibitor as => ", res.name);
			isAvailableInAnyEvent = true;
			repeatedEventName = res.eventId ? res.eventId.name : null;
			break;
		}
	}
	if (isAvailableInAnyEvent) {
		return cb(
			responseUtilities.sendResponse(
				400,
				`This email is already available as sponsor for events ${repeatedEventName}`,
				"checkIfExhibitorAlreadyExistForEvent",
				null,
				data.req.signature
			)
		);
	} else if (!validEvent) {
		return cb(responseUtilities.sendResponse(400, `Invalid event`, "checkIfExhibitorAlreadyExistForEvent", null, data.req.signature));
	} else {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Proceed to add exhibitor",
				"checkIfExhibitorAlreadyExistForEvent",
				null,
				data.req.signature
			)
		);
	}
};
exports.checkIfExhibitorAlreadyExistForEvent = checkIfExhibitorAlreadyExistForEvent;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add exhbitior data
 */
const addExhibitorData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let allEvents = data.eventIds;
	let allPackages = data.packageIds;
	let insertExhibitorData = [];
	for (let i = 0; i < allEvents.length; i++) {
		let insertData = {
			email: data.email,
			isActive: true,
			eventAdminId: data.req.auth.eventAdminId || data.req.auth.id,
			status: "UNDER_REVIEW",
			eventId: allEvents[i],
			packageId: allPackages[i],
			userId: data.userId || null
		}
		if (data.name) {
			insertData.name = data.name
		}
		if (data.designation) {
			insertData.designation = data.designation
		}
		if (data.goal) {
			insertData.goal = data.goal
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
		if (data.title) {
			insertData.title = data.title
		}
		if (data.logo) {
			insertData.logo = data.logo
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
		if (data.companyDescription) {
			insertData.companyDescription = data.companyDescription
		}
		if (data.businessEmail) {
			insertData.businessEmail = data.businessEmail
		}
		
		insertExhibitorData.push(insertData);
	}
	Exhibitors.insertMany(insertExhibitorData, (err, res) => {
		if (err) {
			console.error("Unable to Add Exhibitor: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "addExhibitorData", null, null)
			);
		}
		console.log("exhibitor added => ", res)
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Exhibitor added",
				"addExhibitorData",
				res,
				data.req.signature
			)
		);
	});
};

//Contoller for getting all exhibitors for admin
exports.getAllExhibitors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let check = mongoose.Types.ObjectId;
	if (data.eventId) {
		if (!check.isValid(data.eventId)) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid event id",
					"getAllExhibitors",
					null,
					data.req.signature
				)
			);
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
	}
	console.log("FindData", findData)
	Exhibitors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for exhibitors: 2 ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllExhibitors",
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
		Exhibitors.find(findData)
			.populate("eventId country packageId")
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get exhibitors: pagination", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllExhibitors",
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
						"All Exhibitors fetched for admin",
						"getAllExhibitors",
						sendData,
						null
					)
				);
			});
	});
};

//controler for getting exhibitor list
exports.getExhibitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findExhibitorsOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findExhibitors, data));
	async.waterfall(waterfallFunctions, cb);

};

const findExhibitorsOfEvent = function (data, response, cb) {
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
			let exhibitors = (res && res.exhibitors) || null;
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Exhibitors fetched",
					"findSpeakersOfEvent",
					exhibitors,
					null
				)
			);
		});
}

const findExhibitors = function (data, response, cb) {
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
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	Exhibitors.find(findData)
		.populate('country')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Exhibitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findExhibitors",
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
					"All Exhibitors fetched",
					"findExhibitors",
					sendData,
					null
				)
			);
		});
}

//controler for getting events associated to media
exports.getExhibitorEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.exhibitorId) {
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
	waterfallFunctions.push(async.apply(findExhibitorDetails, data));
	waterfallFunctions.push(async.apply(findEventsAssociatedToExhibitor, data));
	async.waterfall(waterfallFunctions, cb);
};

//Contoller for exhibitor by id
exports.getExhibitorById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getExhibitorById",
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
				"getSpeakerById",
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
	Exhibitors.findOne(findData)
		.populate('country')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get exhibitor: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getExhibitorById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						404,
						"Exhibitor not found",
						"getExhibitorById",
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
					"Exhibitor fetched by id",
					"getExhibitorById",
					sendData,
					null
				)
			);
		});
};

//Contoller for update exhibitor
exports.updateExhibitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	console.log("id for exhibitor -============", data.exhibitorId)
	if (!data.exhibitorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateExhibitor",
				null,
				null
			)
		);
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(findExhibitorDetails, data));
	if (data.email) {

		waterfallFunctions.push(async.apply(checkIfEmailExistForEvent, data));
	}
	waterfallFunctions.push(async.apply(updateExhibitorDetails, data));
	async.waterfall(waterfallFunctions, cb);
};

const updateExhibitorDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.exhibitorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateExhibitorDetails",
				null,
				null
			)
		);
	}

	let findData = {
		_id: data.exhibitorId,
		isDeleted: false
	};

	let addToSetData = {};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId;
		findData.eventId = { $in: data.req.auth.filteredEvents }
	}
	let updateData = data;

	Exhibitors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update exhibitor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateExhibitorDetails",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Exhibitor updated",
				"updateExhibitorDetails",
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
				"Exhibitor not found",
				"checkIfEmailExistForEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $ne: data.exhibitorId },
		eventId: response.data.eventId,
		email: data.email,
		isDeleted: false,
	};

	if (response.data.packageId) {
		findData.packageId = response.data.packageId
	}
	console.log("==========find by email data=====", findData)
	Exhibitors.findOne(findData, (err, res) => {
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
					"Exhibitors email already exist for event",
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
				"Exhibitors not exist for the email",
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
 * @description Contoller for update exhibitor block status
 */
exports.updateExhibitorBlockStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.exhibitorId || !JSON.stringify(data.isBlocked)) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "updateExhibitorBlockStatus", null, null));
	}
	let findData = {
		_id: data.exhibitorId
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

	Exhibitors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Exhibitor", err);
			return cb(responseUtilities.sendResponse(500, null, "updateExhibitorBlockStatus", null, null));
		}

		return cb(null, responseUtilities.sendResponse(200, "Exhibitor block status updated", "updateExhibitorBlockStatus", null, null));
	});
};

//Contoller for media by id
const findExhibitorDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.exhibitorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findSpeakerDetails",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.exhibitorId,
		isDeleted: false,
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	Exhibitors.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Exhibitor: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "findSpeakerDetails", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					404,
					"Exhibitor not found",
					"findSpeakerDetails",
					null,
					data.req.signature
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Exhibitor fetched by id",
				"findSpeakerDetails",
				res,
				null
			)
		);
	});
};

const findEventsAssociatedToExhibitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.exhibitorId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findEventsAssociatedToSpeaker",
				null,
				data.req.signature
			)
		);
	}

	let exhibitorRes = JSON.parse(JSON.stringify(response.data));
	if (!exhibitorRes) {
		return cb(
			responseUtilities.sendResponse(
				404,
				"Exhibitor not found",
				"findEventsAssociatedToExhibitor",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		status: "ASSIGNED",
		isDeleted: false,
		email: exhibitorRes.email
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	Exhibitors.find(findData)
		.populate("eventId")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get exhibitor: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findEventsAssociatedToExhibitor",
						null,
						null
					)
				);
			}
			let allEventsAssignedToExhibitor = [];
			for (let i = 0; i < res.length; i++) {
				let obj = {
					name: (res[i].eventId && res[i].eventId.name) || null
				}
				if (obj.name && !allEventsAssignedToExhibitor.includes(obj.name)) {
					allEventsAssignedToExhibitor.push(obj)
				}
			}

			exhibitorRes["events"] = allEventsAssignedToExhibitor;
			let sendData = {
				data: exhibitorRes,
				// count: count,
				// pageLimit: limit,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Exhibitor Events fetched",
					"findEventsAssociatedToExhibitor",
					sendData,
					null
				)
			);
		});
}

exports.getExhibitorsForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findExhibitorsOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findExhibitorsForEvent, data));
	async.waterfall(waterfallFunctions, cb);
};

const findExhibitorsForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
	};

	let sortOrder = {}
	let assignedExhibitorIds = response.data || [];
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
					"findExhibitorsForEvent",
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
	// findData.eventAdminId = data.req.auth.id
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	if (data.eventSpecific) {
		sortOrder = { updatedAt: -1 }
	} else {
		sortOrder = { createdAt: -1 }
	}

	Exhibitors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for medias: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"findExhibitorsForEvent",
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
		Exhibitors.find(findData)
			.skip(skip)
			.limit(limit)
			.sort(sortOrder)
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get exhibitors: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"findExhibitorsForEvent",
							null,
							null
						)
					);
				}
				let exhibitorRes = JSON.parse(JSON.stringify(res))
				// for(let id of assignedExhibitorIds){
				// 	let index = exhibitorRes.findIndex(s => s._id.toString() == id.toString())
				// 	if(index >= 0){
				// 		exhibitorRes[index]["assigned"] = true
				// 	}
				// }

				let sendData = {
					data: exhibitorRes,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"All Exhibitors fetched for event",
						"findExhibitorsForEvent",
						sendData,
						null
					)
				);
			});
	});
}

exports.getLatestExhibitors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getLatestExhibitors",
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
	console.log("Find Exhibitors => ", findData)
	Exhibitors.find(findData, project)
		.populate('packageId country')
		.limit(appMemberLimit)
		.sort({ updatedAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Exhibitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getLatestExhibitors",
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
					"Latest Exhibitors fetched",
					"getLatestExhibitors",
					sendData,
					null
				)
			);
		});
}

/** Export all exhibitors */
exports.exportAllExhibitors = function (data, response, cb) {
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
		if (data.assigned == true || data.assigned == "true") {
			findData.status = "ASSIGNED"
		} else {
			findData.status = "UNDER_REVIEW"
		}
	}

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
	Exhibitors.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding exportAllExhibitors => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllExhibitors", err, null));
			}
			// console.log("All user res length => ", res);

			if (!res.length) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"No Record(s) found",
						"exportAllExhibitors",
						null,
						null
					)
				);
			}
			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let exhibitor = res[i];
				if (data.eventId && !exhibitor.eventId) {
					continue;
				}
				if (data.agencyId && !exhibitor.eventAdminId) {
					continue;
				}
				if (data.packageId && !exhibitor.packageId) {
					continue;
				}

				let fieldObject = {
					"Agency": exhibitor?.eventAdminId?.name,
					"Event": exhibitor?.eventId?.name,
					"Package": exhibitor?.packageId?.title,
					"Package Type": exhibitor?.packageId?.type,
					"Name": exhibitor.name,
					"Goal": exhibitor?.goal,
					"Business Sector": exhibitor?.businessSector,
					"Email": exhibitor.email,
					"Whatsapp Mobile": exhibitor?.whatsAppMobile,
					"Title": exhibitor.title,
					"Country": exhibitor.country?.name,
					"Designation": exhibitor?.designation,
					"Company": exhibitor?.company,
					"Website": exhibitor?.website,
					"Status": exhibitor?.status
				}
				dataArray.push(fieldObject);
			}

			console.log("Data Array => ", dataArray);
			if (!dataArray.length) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"No Record(s) found",
						"exportAllExhibitors",
						null,
						null
					)
				);
			}
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Exhibitors List",
					"exportAllExhibitors",
					dataArray,
					null
				)
			)
		})
}
// console.log(new Date(moment("9/14/2023").startOf('day')))
// console.log(new Date(moment("9/14/2023").endOf('day')));