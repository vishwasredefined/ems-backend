const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");
const path = require("path");

//Helpers
const responseUtilities = require("../helpers/sendResponse");
const role = JSON.parse(process.env.role);

//Modals
const Medias = require("../models/medias");
const Events = require("../models/events");


//Controllers
const events = require("../controllers/events");
const users = require("../controllers/users");
const { checkIfInvalidEvent } = require("../controllers/events");



/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding Media Partner
 */
exports.addMedia = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (
		!data.mediaHouse || !data.website || !data.eventId ||
		!data.title || !data.contactPerson || !data.designation || !data.email || !data.businessEmail
	) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"addMedia",
				null,
				data.req.signature
			));
	}

	console.log("Data.eventId => ", data.eventId);
	data.eventIds = [data.eventId];
	console.log("Data.eventId => ", data.eventIds)

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkIfMediaPartnerAlreadyExistForEvent, data));
	waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	waterfallFunctions.push(async.apply(users.findUserByEmail, data));
	waterfallFunctions.push(async.apply(addMediaPartnerData, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Checks If Media Partner Already Exist For Event
 */
const checkIfMediaPartnerAlreadyExistForEvent = async function (data, response, cb) {

	if (!cb) {
		cb = response;
	}

	// User can be assigned a role in multiple events
	let events = data.eventIds;

	let isAvailableInAnyEvent = false;
	let repeatedEventName = "";

	for (let i = 0; i < events.length; i++) {

		//check if the User is not added as any media partener in the individual event
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
		let res = await Medias.findOne(findData).populate("eventId").exec();
		if (res) {
			console.log("He is already added as media partner as => ", res.name);
			isAvailableInAnyEvent = true;
			repeatedEventName = res.eventId ? res.eventId.name : null;
			break;
		}
	}
	if (isAvailableInAnyEvent) {
		return cb(
			responseUtilities.sendResponse(
				400,
				`This email is already available as media partner for event ${repeatedEventName}`,
				"checkIfMediaPartnerAlreadyExistForEvent",
				null,
				data.req.signature
			)
		);
	} else {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Proceed to add media partner",
				"checkIfMediaPartnerAlreadyExistForEvent",
				null,
				data.req.signature
			)
		);
	}
};
exports.checkIfMediaPartnerAlreadyExistForEvent = checkIfMediaPartnerAlreadyExistForEvent;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Add Media Partner Data
 */
const addMediaPartnerData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let allEvents = data.eventIds;
	let insertMediaPartnerData = [];

	for (let i = 0; i < allEvents.length; i++) {
		let insertData = {
			email: data.email,
			isActive: true,
			// eventAdminId: data.req.auth.id,
			status: "UNDER_REVIEW",
			eventId: allEvents[i],
			userId: data.userId || null
		}
		if (data.req.auth.role == role.eventadmin) {
			insertData.eventAdminId = data.req.auth.id
		}
		if (data.req.auth.role == role.eventmanager) {
			insertData.eventAdminId = data.req.auth.eventAdminId
		}
		if (data.mediaHouse) {
			insertData.mediaHouse = data.mediaHouse
		}
		if (data.logo) {
			insertData.logo = data.logo
		}
		if (data.website) {
			insertData.website = data.website
		}

		if (data.title) {
			insertData.title = data.title
		};

		if (data.contactPerson) {
			insertData.contactPerson = data.contactPerson
		}
		if (data.mobile) {
			insertData.mobile = data.mobile
		}
		if (data.telegram) {
			insertData.telegram = data.telegram
		};
		if (data.whatsAppMobile) {
			insertData.whatsAppMobile = data.whatsAppMobile
		}
		if (JSON.stringify(data.mobileCode)) {
			insertData.mobileCode = data.mobileCode
		}
		if (JSON.stringify(data.whatsAppMobileCode)) {
			insertData.whatsAppMobileCode = data.whatsAppMobileCode
		}
		if (data.designation) {
			insertData.designation = data.designation
		};
		if (data.linkedin) {
			insertData.linkedin = data.linkedin
		};
		if (data.twitter) {
			insertData.twitter = data.twitter
		};
		if (data.businessEmail) {
			insertData.businessEmail = data.businessEmail
		};
		
		insertMediaPartnerData.push(insertData);
	};

	Medias.insertMany(insertMediaPartnerData, (err, res) => {
		if (err) {
			console.error("Unable to Add Media: ", err);

			return cb(responseUtilities.sendResponse(500, null, "addMediaPartnerData", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Media Partner added", "addMediaPartnerData", res, data.req.signature));
	});
};

//Contoller for getting all medias
exports.getAllMedias = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if ([role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	}
	let check = mongoose.Types.ObjectId;
	if (data.eventId) {
		if (!check.isValid(data.eventId)) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid event id",
					"getAllMedias",
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

	console.log("findData=========", findData)
	Medias.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for medias: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllMedias",
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
		if (data.currentPage) {
			skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
		}
		Medias.find(findData)
			.populate("eventId")
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get medias: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllMedias",
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
						"All Medias fetched for admin",
						"getAllMedias",
						sendData,
						null
					)
				);
			});
	});
};

//controler for getting medias list
exports.getMediasList = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findMediasOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findMedias, data));
	async.waterfall(waterfallFunctions, cb);

};

exports.getMediasForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findMediasOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findMediasForEvent, data));
	async.waterfall(waterfallFunctions, cb);

};

const findMediasForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
	};

	let sortOrder = {}
	let assignedMediaIds = response.data || [];
	// if (data.eventSpecific && response.data) {
	// 	findData._id = { $nin: response.data }
	// }


	if (data.mediaHouse) {
		const regex = /^[^*|\":<>[\]{}`\\()';&$]+$/;
		if (!regex.test(data.mediaHouse)) {
			console.log("Invalid input");
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid search input",
					"findMediasForEvent",
					null,
					data.req.signature
				)
			);
		}
		findData["mediaHouse"] = { '$regex': `${data.mediaHouse}`, '$options': 'i' }
	}
	if (data.email) {
		findData.email = data.email
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	if (data.eventSpecific) {
		sortOrder = { updatedAt: -1 }
	} else {
		sortOrder = { createdAt: -1 }
	}

	Medias.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for medias: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"findMediasForEvent",
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
		Medias.find(findData)
			.skip(skip)
			.limit(limit)
			.sort(sortOrder)
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get medias: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"findMediasForEvent",
							null,
							null
						)
					);
				}

				let mediaRes = JSON.parse(JSON.stringify(res))
				// for (let id of assignedMediaIds) {
				// 	let index = mediaRes.findIndex(s => s._id.toString() == id.toString())
				// 	if (index >= 0) {
				// 		mediaRes[index]["assigned"] = true
				// 	}
				// }

				let sendData = {
					data: mediaRes,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"All Medias fetched for admin",
						"findMediasForEvent",
						sendData,
						null
					)
				);
			});
	});
}

const findMediasOfEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findMediasOfEvent",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.eventId
	}
	Events.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findMediasOfEvent",
						null,
						null
					)
				);
			}
			let medias = (res && res.medias) || null;
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Medias fetched",
					"findMediasOfEvent",
					medias,
					null
				)
			);
		});
}

const findMedias = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
	};

	let sortOrder = {}
	if (data.eventSpecific && response.data) {
		findData._id = { $nin: response.data }
	}


	if (data.mediaHouse) {
		findData["mediaHouse"] = { '$regex': `${data.mediaHouse}`, '$options': 'i' }
	}
	if (data.eventId) {
		findData.eventId = data.eventId
		if (data.app) {
			findData.status = "ASSIGNED"
		}
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	if (data.eventSpecific) {
		sortOrder = { updatedAt: -1 }
	} else {
		sortOrder = { createdAt: -1 }
	}

	console.log("=========media res====================", findData)

	Medias.find(findData)
		.populate("eventId")
		.sort(sortOrder)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findMedias",
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
					"All Medias fetched",
					"findMedias",
					sendData,
					null
				)
			);
		});
}

//controler for getting events assigned to media partner by mediaId
exports.getMediaEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.mediaId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getMediaEvents",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];

	// waterfallFunctions.push(async.apply(events.findAdminEvents, data));
	waterfallFunctions.push(async.apply(findMediaDetails, data));
	waterfallFunctions.push(async.apply(findEventsAssociatedToMedia, data));
	async.waterfall(waterfallFunctions, cb);

};

const findEventsAssociatedToMedia = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.mediaId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findEventsAssociatedToMedia",
				null,
				data.req.signature
			)
		);
	}

	let mediaRes = JSON.parse(JSON.stringify(response.data));
	if (!mediaRes) {
		return cb(
			responseUtilities.sendResponse(
				404,
				"Media not found",
				"findEventsAssociatedToMedia",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		isDeleted: false,
		status: "ASSIGNED",
		email: mediaRes.email
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	Medias.find(findData)
		.populate("eventId")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findEventsAssociatedToMedia",
						null,
						null
					)
				);
			}
			let allEventsAssignedToMediaPartner = [];
			for (let i = 0; i < res.length; i++) {
				let obj = {
					name: res[i].eventId.name
				}
				if (obj.name && !allEventsAssignedToMediaPartner.includes(obj.name)) {
					allEventsAssignedToMediaPartner.push(obj)
				}
			}
			mediaRes["events"] = allEventsAssignedToMediaPartner;
			let sendData = {
				data: mediaRes
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Media Events fetched",
					"findEventsAssociatedToMedia",
					sendData,
					null
				)
			);
		});

}

exports.getMediaById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getMediaById",
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
				"getMediaById",
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
	Medias.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Media: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "getMediaById", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					404,
					"Media not found",
					"getMediaById",
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
				"Media fetched by id",
				"getMediaById",
				sendData,
				null
			)
		);
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update media details
 */
exports.updateMedia = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.mediaId) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "updateMedia", null, null));
	}

	let waterfallFunctions = [];

	waterfallFunctions.push(async.apply(findMediaDetails, data));
	if (data.email) {

		waterfallFunctions.push(async.apply(checkIfEmailExistForEvent, data));
	}

	waterfallFunctions.push(async.apply(updateMediaDetails, data));
	async.waterfall(waterfallFunctions, cb);

};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update media data
 */
const updateMediaDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.mediaId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateMedia",
				null,
				null
			)
		);
	}
	let findData = {
		_id: data.mediaId
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	let updateData = {};

	if (data.mediaHouse) {
		updateData.mediaHouse = data.mediaHouse
	}
	if (data.email) {
		updateData.email = data.email
	}
	if (data.logo) {
		updateData.logo = data.logo
	}

	if (data.website) {
		updateData.website = data.website
	}
	if (data.mobile) {
		updateData.mobile = data.mobile
	}
	if (data.whatsAppMobile) {
		updateData.whatsAppMobile = data.whatsAppMobile
	}
	if (data.mobileCode) {
		updateData.mobileCode = data.mobileCode
	}
	if (data.whatsAppMobileCode) {
		updateData.whatsAppMobileCode = data.whatsAppMobileCode
	}

	if (data.title) {
		updateData.title = data.title
	};
	if (data.contactPerson) {
		updateData.contactPerson = data.contactPerson
	}

	if (data.telegram) {
		updateData.telegram = data.telegram
	};

	if (data.designation) {
		updateData.designation = data.designation
	};

	if (data.linkedin) {
		updateData.linkedin = data.linkedin
	};
	if (data.twitter) {
		updateData.twitter = data.twitter
	};
	if (data.businessEmail) {
		updateData.businessEmail = data.businessEmail
	};

	Medias.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update media", err);
			if (err.code == "11000" && err.errmsg.indexOf("mediaHouse_1") != -1) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Media-house already exist",
						"updateMedia",
						null,
						null
					)
				);
			}
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateMedia",
					null,
					null
				)
			);
		}
		return cb(null, responseUtilities.sendResponse(200, "Media updated", "updateMedia", null, null));
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Check If Email Exist For Event
 */
const checkIfEmailExistForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!response.data || !response.data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Media not found", "updateMedia", null, null));
	};

	let findData = {
		_id: { $ne: data.mediaId },
		eventId: response.data.eventId,
		email: data.email,
		isDeleted: false,
	};

	Medias.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Media: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "getMediaById", null, null)
			);
		}
		if (res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Media email already exist for event",
					"findMediaDetails",
					null,
					data.req.signature
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Media not exist for the email",
				"findMediaDetails",
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
 * @description Contoller for update media block status
 */
exports.updateMediaBlockStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.mediaId || !JSON.stringify(data.isBlocked)) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "updateMediaBlockStatus", null, null));
	}
	let findData = {
		_id: data.mediaId
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = {
		isBlocked: data.isBlocked,
		status: "UNDER_REVIEW"
	};

	Medias.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Sponsors", err);
			return cb(responseUtilities.sendResponse(500, null, "updateMediaBlockStatus", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Media block status updated", "updateMediaBlockStatus", null, null));
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for media by Id
 */
const findMediaDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.mediaId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "findMediaDetails", null, data.req.signature));
	};

	let adminEventIds = [];
	if (response.data) {
		data.adminEventIds = response.data
	};

	let findData = {
		_id: data.mediaId,
		isDeleted: false,
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	console.log("FindData for Media by Id => ", findData);

	Medias.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Media: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getMediaById", null, null));
		}
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "Media not found", "findMediaDetails", null, data.req.signature));
		}

		return cb(null, responseUtilities.sendResponse(200, "Media fetched", "findMediaDetails", res, null));
	});
};

exports.getLatestMedias = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getLatestMedias",
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
			email: 1,
			website: 1,
			logo: 1,
			mediaHouse: 1

		}
	}

	let appMemberLimit = parseInt(process.env.appMemberLimit);
	console.log("Find Medias => ", findData)
	Medias.find(findData, project)
		.limit(appMemberLimit)
		.sort({ updatedAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getLatestMedias",
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
					"Latest Medias fetched",
					"getLatestMedias",
					sendData,
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
 * @description  Export all media partners
 */
exports.exportAllMediaPartners = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	};

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = JSON.parse(data.isBlocked)
	};

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
	};

	console.log("FindData => ", findData)

	if (data.agencyId) {
		findData.eventAdminId = data.agencyId
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.packageId) {
		findData.packageId = data.packageId
	}

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	};
	let populateData = " eventId eventAdminId packageId country "
	console.log("Populate Data => ", populateData)
	Medias.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding exportAllMediaPartners => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllMediaPartners", err, null));
			}
			// console.log("All user res length => ", res);

			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllMediaPartners", null, null));
			};

			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let media = res[i];
				if (data.eventId && !media.eventId) {
					continue;
				}
				if (data.agencyId && !media.eventAdminId) {
					continue;
				}
				if (data.packageId && !media.packageId) {
					continue;
				}

				let fieldObject = {
					"Agency": media?.eventAdminId?.name,
					"Event": media?.eventId?.name,
					"Name": media.mediaHouse,
					"Email": media.email,
					"Whatsapp Mobile": media?.whatsAppMobile,
					"Contact Person": media.contactPerson,
					"Website": media?.website,
					"Status": media?.status
				};
				dataArray.push(fieldObject);
			}

			console.log("Data Array => ", dataArray);
			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllMediaPartners", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Media List", "exportAllMediaPartners", dataArray, null))
		})
}