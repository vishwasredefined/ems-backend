const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

const path = require("path");
const axios = require('axios');
const fs = require('fs');

//helper
const responseUtilities = require("../helpers/sendResponse");

//models
const Speakers = require("../models/speakers");
const Users = require("../models/users");
const Requests = require("../models/requests");
const Events = require("../models/events");
const Agendas = require("../models/agendas");
const Bookmarks = require("../models/bookmarks");


const role = JSON.parse(process.env.role);

//Controllers
const events = require("../controllers/events");
const users = require("../controllers/users");
const { checkIfInvalidEvent } = require("../controllers/events");


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding speaker
 */
exports.addSpeaker = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.email || !data.name || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"addSpeaker",
				null,
				data.req.signature
			)
		);
	}
	let waterfallFunctions = [];

	data.email = data.email.toLowerCase();
	console.log("Data.eventids => ", data.eventId)
	data.eventIds = [data.eventId];
	console.log("Modified => ", data.eventIds);

	waterfallFunctions.push(async.apply(checkIfSpeakerAlreadyExistForEvent, data));
	waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	waterfallFunctions.push(async.apply(users.findUserByEmail, data));
	waterfallFunctions.push(async.apply(addSpeakerData, data));
	async.waterfall(waterfallFunctions, cb);
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller to check If Speaker Already Exist For Event
 */
const checkIfSpeakerAlreadyExistForEvent = async function (data, response, cb) {

	if (!cb) {
		cb = response;
	}

	// user can be assigned a role in multiple events
	let events = data.eventIds;

	let isAssignedInAnyEvent = false;

	let repeatedEventName = "";
	for (let i = 0; i < events.length; i++) {

		//check if the user is not added as any speaker in the individual event
		let findData = {
			eventId: events[i],
			email: data.email
		}
		findData.eventAdminId = data.req.auth.eventAdminId || data.req.auth.id

		console.log("FindData => ", findData);
		let res = await Speakers.findOne(findData).populate("eventId").exec();
		if (res) {
			console.log("He is already as  speaker as => ", res.name);
			isAssignedInAnyEvent = true;
			repeatedEventName = res.eventId ? res.eventId.name : null;
			break;
		}
	}
	if (isAssignedInAnyEvent) {
		return cb(
			responseUtilities.sendResponse(
				400,
				`This email is already available as speaker for event ${repeatedEventName}`,
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
				"Proceed to add speaker",
				"addSpeaker",
				null,
				data.req.signature
			)
		);
	}
}
exports.checkIfSpeakerAlreadyExistForEvent = checkIfSpeakerAlreadyExistForEvent;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Speaker Data 
 */
const addSpeakerData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let allEvents = data.eventIds;
	let insertSpeakerData = [];
	for (let i = 0; i < allEvents.length; i++) {
		let insertData = {
			email: data.email,
			isActive: true,
			eventAdminId: data.req.auth.eventAdminId || data.req.auth.id,
			status: "UNDER_REVIEW",
			eventId: allEvents[i],
			userId: data.userId || null
		}
		if (data.name) {
			insertData.name = data.name
		}
		if (data.designation) {
			insertData.designation = data.designation
		}
		if (data.businessSector) {
			insertData.businessSector = data.businessSector
		}
		if (data.profilePicture) {
			insertData.profilePicture = data.profilePicture
		}
		if (data.organization) {
			insertData.organization = data.organization
		}
		if (data.orgWebsite) {
			insertData.orgWebsite = data.orgWebsite
		}
		if (data.about) {
			insertData.about = data.about
		}
		if (data.interestTopics) {
			insertData.interestTopics = data.interestTopics
		}
		if (data.mobile) {
			insertData.mobile = data.mobile
		}
		if (data.whatsAppMobile) {
			insertData.whatsAppMobile = data.whatsAppMobile
		}
		if (JSON.stringify(data.mobileCode)) {
			insertData.mobileCode = data.mobileCode
		}
		if (JSON.stringify(data.whatsAppMobileCode)) {
			insertData.whatsAppMobileCode = data.whatsAppMobileCode
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
		if (data.title) {
			insertData.title = data.title
		}
		if (data.country) {
			insertData.country = data.country
		}
		if (data.attachedDocuments) {
			insertData.attachedDocuments = data.attachedDocuments
		}
		if (data.businessEmail) {
			insertData.businessEmail = data.businessEmail
		}
		
		insertSpeakerData.push(insertData);
	}

	Speakers.insertMany(insertSpeakerData, (err, res) => {
		if (err) {
			console.error("Unable to Add Speaker: ", err);
			return cb(responseUtilities.sendResponse(500, null, "addSpeaker", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Speaker added", "addSpeaker", null, data.req.signature));
	});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all speakers for admin (Pagination)
 */
exports.getAllSpeakers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = mongoose.Types.ObjectId(data.req.auth.id);
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = mongoose.Types.ObjectId(data.req.auth.eventAdminId)
	}

	let check = mongoose.Types.ObjectId;
	if (data.eventId) {
		if (!check.isValid(data.eventId)) {
			return cb(responseUtilities.sendResponse(400, "Invalid Parameter", "getAllSpeakers", null, data.req.signature));
		}
		findData.eventId = mongoose.Types.ObjectId(data.eventId);
	};

	if (data.agencyId && check.isValid(data.agencyId)) {
		findData.eventAdminId = mongoose.Types.ObjectId(data.agencyId);
	}

	if (JSON.stringify(data.assigned)) {
		if (data.assigned == true || data.assigned == "true") {
			findData.status = "ASSIGNED"
		} else {
			findData.status = "UNDER_REVIEW"
		}
	}

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = data.isBlocked
	};

	console.log("Find Speakers => ", findData);

	let limit = parseInt(process.env.pageLimit);
	if (data.limit) {
		limit = parseInt(data.limit)
	}
	let skip = 0;
	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}

	Speakers.aggregate([
		{
			$match: findData
		},
		{
			$lookup: {
				from: "events",
				localField: "eventId",
				foreignField: "_id",
				as: "eventId"
			}
		},
		{
			$unwind: {
				path: "$eventId",
				preserveNullAndEmptyArrays: true
			}
		},
		{
			$lookup: {
				from: "countries",
				localField: "country",
				foreignField: "_id",
				as: "country"
			}
		},
		{
			$unwind: {
				path: "$country",
				// preserveNullAndEmptyArrays: true
			}
		},
		{
			$lookup: {
				from: "agendas",
				localField: "_id",
				foreignField: "speakers",
				as: "agendas"
			}
		},
		{
			$sort: {
				createdAt: -1
			}
		},
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
	]).exec((err, res) => {
		if (err) {
			console.error("Unable to get speakers: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getAllSpeakers", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "All Speakers fetched for admin", "getAllSpeakers", res, null));
	});

	// Speakers.countDocuments(findData, (err, count) => {
	// 	if (err) {
	// 		console.error("Could not get count for speakers: ", err);
	// 		return cb(
	// 			responseUtilities.sendResponse(
	// 				500,
	// 				null,
	// 				"getAllSpeakers",
	// 				null,
	// 				null
	// 			)
	// 		);
	// 	}
	// 	let limit = parseInt(process.env.pageLimit);
	// 	if (data.limit) {
	// 		limit = parseInt(data.limit)
	// 	}
	// 	let skip = 0;
	// 	if (data.currentPage) {
	// 		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	// 	}
	// 	Speakers.find(findData)
	// 		.populate("eventId country")
	// 		.skip(skip)
	// 		.limit(limit)
	// 		.sort({ createdAt: -1 })
	// 		.exec((err, res) => {
	// 			if (err) {
	// 				console.error("Unable to get speakers: ", err);
	// 				return cb(
	// 					responseUtilities.sendResponse(
	// 						500,
	// 						null,
	// 						"getAllSpeakers",
	// 						null,
	// 						null
	// 					)
	// 				);
	// 			}
	// 			let sendData = {
	// 				data: res,
	// 				count: count,
	// 				pageLimit: limit,
	// 			};
	// 			return cb(
	// 				null,
	// 				responseUtilities.sendResponse(
	// 					200,
	// 					"All Speakers fetched for admin",
	// 					"getAllSpeakers",
	// 					sendData,
	// 					null
	// 				)
	// 			);
	// 		});
	// });
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting events of given speaker
 */
exports.getSpeakerEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.speakerId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getSpeakerEvents", null, data.req.signature));
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(findSpeakerDetails, data));
	waterfallFunctions.push(async.apply(findEventsAssociatedToSpeaker, data));
	async.waterfall(waterfallFunctions, cb);
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting speaker by id
 */
const findSpeakerDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.speakerId) {
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
		_id: data.speakerId,
		isDeleted: false,
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	Speakers.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Speaker: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "findSpeakerDetails", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Speaker not found",
					"findSpeakerDetails",
					null,
					data.req.signature
				)
			);
		}

		return cb(null, responseUtilities.sendResponse(200, "Speaker fetched by id", "findSpeakerDetails", res, null));
	});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Finding Events Associated To Speaker
 */
const findEventsAssociatedToSpeaker = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.speakerId) {
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

	let speakerRes = JSON.parse(JSON.stringify(response.data));
	if (!speakerRes) {
		return cb(
			responseUtilities.sendResponse(
				404,
				"Speaker not found",
				"findEventsAssociatedToSpeaker",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		status: "ASSIGNED",
		isDeleted: false,
		email: speakerRes.email
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	Speakers.find(findData)
		.populate("eventId country")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get medias: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findEventsAssociatedToSpeaker",
						null,
						null
					)
				);
			}
			let allEventsAssignedToSpeaker = [];
			for (let i = 0; i < res.length; i++) {
				let obj = {
					name: (res[i].eventId && res[i].eventId.name) || null
				}
				if (obj.name && !allEventsAssignedToSpeaker.includes(obj.name)) {
					allEventsAssignedToSpeaker.push(obj)
				}
			}

			speakerRes["events"] = allEventsAssignedToSpeaker;
			let sendData = {
				data: speakerRes
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Speaker Events fetched",
					"findEventsAssociatedToSpeaker",
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
 * @description Contoller for Speaker by id
 */
const getSpeakerById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.speakerId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getSpeakerById", null, data.req.signature));
	}

	if ((data.id && !mongoose.Types.ObjectId.isValid(data.id)) || (data.speakerId && !mongoose.Types.ObjectId.isValid(data.speakerId))) {
		return cb(responseUtilities.sendResponse(400, "Invalid Parameter", "getSpeakerById", null, data.req.signature));
	};

	let findData = {
		_id: data.id || data.speakerId,
		isDeleted: false,
	};

	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
	// 	findData.eventAdminId = data.req.auth.id
	// };

	Speakers.findOne(findData)
		.populate("country")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get speaker: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getSpeakerById", null, null)
				);
			}
			if (!res) {
				return cb(responseUtilities.sendResponse(400, "Speaker not found", "getSpeakerById", null, data.req.signature));
			};

			let sendData = {
				data: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Speaker fetched by id",
					"getSpeakerById",
					sendData,
					null
				)
			);
		});
};

exports.getSpeakerById = getSpeakerById

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for updating speaker
 */
exports.updateSpeaker = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(findSpeakerDetails, data));
	if (data.email) {
		waterfallFunctions.push(async.apply(checkIfEmailExistForEvent, data));
	}
	waterfallFunctions.push(async.apply(updateSpeakerDetails, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update Speaker Details Data
 */
const updateSpeakerDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.speakerId) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "updateSpeaker", null, null));
	};

	let findData = {
		_id: data.speakerId
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = data;
	console.log("Update Data => ", updateData);

	Speakers.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(responseUtilities.sendResponse(500, null, "updateSpeaker", null, null));
		}

		return cb(null, responseUtilities.sendResponse(200, "Speaker updated", "updateSpeaker", null, null));
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description check If Email Exist For Event
 */
const checkIfEmailExistForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!response.data || !response.data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Speaker not found",
				"checkIfEmailExistForEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $ne: data.speakerId },
		eventId: response.data.eventId,
		email: data.email,
		isDeleted: false,
	};

	console.log("==========find by email data=====", findData)
	Speakers.findOne(findData, (err, res) => {
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
					"Speaker email already exist for event",
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
				"Speaker not exist for the email",
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
 * @description Contoller for update speaker block status
 */
exports.updateSpeakerBlockStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.speakerId || !JSON.stringify(data.isBlocked)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateSpeakerBlockStatus", null, data.req.signature));
	};

	let findData = {
		_id: data.speakerId
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

	Speakers.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "updateSpeakerBlockStatus", null, null));
		}

		return cb(null, responseUtilities.sendResponse(200, "Speaker block status updated", "updateSpeakerBlockStatus", null, null));
	});
};



exports.getSpeakersForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findSpeakersOfEvent, data));
	}
	waterfallFunctions.push(async.apply(findSpeakersForEvent, data));

	async.waterfall(waterfallFunctions, cb);

};

const findSpeakersForEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false
	};

	let sortOrder = {}
	let assignedSpeakersIds = response.data || []


	if (data.name) {
		const regex = /^[^*|\":<>[\]{}`\\()';&$]+$/;
		let search = data.name
		console.log("search type input", search);
		if (!regex.test(data.name)) {
			console.log("Invalid input");
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid search input",
					"findSpeakersForEvent",
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
	if ([role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	if (data.eventSpecific) {

		sortOrder = { updatedAt: -1 }
	} else {
		sortOrder = { createdAt: -1 }
	}

	Speakers.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for speaker: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"findSpeakersForEvent",
					null,
					null
				)
			);
		}
		console.log("count for speaker=======", count)
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (!data.currentPage) {
			data.currentPage = Math.ceil(count / limit);
		}
		skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
		Speakers.find(findData)
			.skip(skip)
			.limit(limit)
			.sort(sortOrder)
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get speaker: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"findSpeakersForEvent",
							null,
							null
						)
					);
				}

				let speakerRes = JSON.parse(JSON.stringify(res))
				// for(let id of assignedSpeakersIds){
				// 	let index = speakerRes.findIndex(s => s._id.toString() == id.toString())
				// 	if(index >= 0){
				// 		speakerRes[index]["assigned"] = true
				// 	}
				// }

				let sendData = {
					data: speakerRes,
					count: count,
					pageLimit: limit,
				};
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"All Speakers fetched for event",
						"findSpeakersForEvent",
						sendData,
						null
					)
				);
			});
	});
}

// const getAllSpeakersRequestIdsOfEvent = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}

// 	let findRequests = {
// 		joinAs: "SPEAKER",
// 		status: "UNDER_REVIEW",
// 		eventId: data.eventId
// 	}
// 	console.log("Find All available under_review speakers of this event => ", findRequests);
// 	Requests.find(findRequests, function (err, res) {
// 		if (err) {
// 			console.error("Could not get count for medias: ", err);
// 			return cb(
// 				responseUtilities.sendResponse(
// 					500,
// 					null,
// 					"findSpeakersForEvent",
// 					null,
// 					null
// 				)
// 			);
// 		}
// 		let allApprovedRequestIdsOfEvent = [];
// 		for (let i = 0; i < res.length; i++) {
// 			allApprovedRequestIdsOfEvent.push(res[i]._id)
// 		}
// 		data.allApprovedRequestIdsOfEvent = allApprovedRequestIdsOfEvent;
// 		return cb(
// 			null,
// 			responseUtilities.sendResponse(
// 				200,
// 				"null",
// 				"findSpeakersForEvent",
// 				res,
// 				null
// 			)
// 		)
// 	})
// };
// const findAndUpdateRequests = async function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}

// 	if (!data.eventIds || !data.eventIds.length) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Missing Params",
// 				"addSpeaker",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	let eventIds = data.eventIds
// 	let speakerResp = {};
// 	let speakerData = {};
// 	let requestIds = [];
// 	let error = false;
// 	if (!data.existingMember) {
// 		if (data.designation) {
// 			speakerData.designation = data.designation
// 		}
// 		if (data.businessSector) {
// 			speakerData.businessSector = data.businessSector
// 		}
// 		if (data.profilePicture) {
// 			speakerData.profilePicture = data.profilePicture
// 		}
// 		if (data.organization) {
// 			speakerData.organization = data.organization
// 		}
// 		if (data.orgWebsite) {
// 			speakerData.orgWebsite = data.orgWebsite
// 		}
// 		if (data.about) {
// 			speakerData.about = data.about
// 		}
// 		if (data.interestTopics) {
// 			speakerData.interestTopics = data.interestTopics
// 		}
// 		if (data.mobile) {
// 			speakerData.mobile = data.mobile
// 		}
// 		if (data.whatsAppMobile) {
// 			speakerData.whatsAppMobile = data.whatsAppMobile
// 		}
// 		if (data.linkedin) {
// 			speakerData.linkedin = data.linkedin
// 		}
// 		if (data.twitter) {
// 			speakerData.twitter = data.twitter
// 		}
// 		if (data.telegram) {
// 			speakerData.telegram = data.telegram
// 		}
// 		data.speakerData = speakerData
// 	} else {
// 		speakerResp = JSON.parse(JSON.stringify(response.data.data));
// 		if (speakerResp.designation) {
// 			speakerData.designation = speakerResp.designation
// 		}
// 		if (speakerResp.businessSector) {
// 			speakerData.businessSector = speakerResp.businessSector
// 		}
// 		if (speakerResp.profilePicture) {
// 			speakerData.profilePicture = speakerResp.profilePicture
// 		}
// 		if (speakerResp.organization) {
// 			speakerData.organization = speakerResp.organization
// 		}
// 		if (speakerResp.orgWebsite) {
// 			speakerData.orgWebsite = speakerResp.orgWebsite
// 		}
// 		if (speakerResp.about) {
// 			speakerData.about = speakerResp.about
// 		}
// 		if (speakerResp.interestTopics) {
// 			speakerData.interestTopics = speakerResp.interestTopics
// 		}
// 		if (speakerResp.mobile) {
// 			speakerData.mobile = speakerResp.mobile
// 		}
// 		if (speakerResp.whatsAppMobile) {
// 			speakerData.whatsAppMobile = speakerResp.whatsAppMobile
// 		}
// 		if (speakerResp.linkedin) {
// 			speakerData.linkedin = speakerResp.linkedin
// 		}
// 		if (speakerResp.twitter) {
// 			speakerData.twitter = speakerResp.twitter
// 		}
// 		if (speakerResp.telegram) {
// 			speakerData.telegram = speakerResp.telegram
// 		}
// 	}

// 	for (let i in eventIds) {
// 		let findRequest = {
// 			"joinAs": "SPEAKER",
// 			email: data.email,
// 			eventId: eventIds[i]
// 		}

// 		if (data.existingMember) {
// 			findRequest.email = speakerResp.email
// 		} else if (data.email) {
// 			findRequest.email = data.email
// 		}

// 		findRequest.eventAdminId = data.req.auth.id
// 		if (data.req.auth && data.req.auth.role == role.eventadmin) {
// 			findRequest.eventAdminId = data.req.auth.id
// 		}
// 		let options = {
// 			upsert: true,
// 			new: true,
// 			setDefaultsOnInsert: true,
// 		};
// 		let updateData = {
// 			joiningDetails: speakerData,
// 			status: "UNDER_REVIEW"
// 		};

// 		if (data.existingMember) {
// 			updateData.name = speakerResp.name
// 		} else if (data.name) {
// 			updateData.name = data.name
// 		}

// 		try {

// 			let request = await Requests.findOneAndUpdate(findRequest, updateData, options).exec();
// 			if (request) {
// 				requestIds.push(request._id)
// 				console.log("=======================request respones===============", requestIds, i)
// 			}
// 			if (parseInt(i) + 1 == eventIds.length) {
// 				data.requestIds = requestIds
// 				return cb(
// 					null,
// 					responseUtilities.sendResponse(
// 						200,
// 						"request created/updated",
// 						"createRequest",
// 						null,
// 						data.req.signature
// 					)
// 				);
// 			}
// 		} catch (e) {
// 			console.log("error in requests", e)
// 		}


// 	}

// 	if (error) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Error creating speaker",
// 				"addSpeaker",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}
// }

// const addSpeakerForEvent = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}

// 	if (!data.eventIds || !data.eventIds.length) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Missing Params",
// 				"addSpeaker",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	let insertData = data.speakerData
// 	insertData.email = data.email
// 	insertData.isActive = true

// 	let eventAdminId = data.req.auth.id

// 	insertData.eventAdminId = eventAdminId

// 	if (data.requestIds) {
// 		insertData.requestIds = data.requestIds
// 	}
// 	if (data.name) {
// 		insertData.name = data.name
// 	}


// 	console.log("===========adding speaker for event")
// 	Speakers.create(insertData, (err, res) => {
// 		if (err) {
// 			console.error("Unable to Add Speaker: ", err);
// 			return cb(
// 				responseUtilities.sendResponse(500, null, "addSpeaker", null, null)
// 			);
// 		}
// 		return cb(
// 			null,
// 			responseUtilities.sendResponse(
// 				200,
// 				"Speaker added",
// 				"addSpeaker",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	});
// }

// const updateSpeakerEvent = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}

// 	if (!data.eventIds || !data.eventIds.length) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Missing Params",
// 				"addSpeaker",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	let findData = {
// 		_id: data.speakerId
// 	}

// 	let insertData = {
// 	}
// 	let addToSetData = {};

// 	let eventAdminId = data.req.auth.id

// 	findData.eventAdminId = eventAdminId

// 	if (data.requestIds) {
// 		addToSetData.requestIds = { "$each": data.requestIds }
// 	}


// 	insertData["$addToSet"] = addToSetData
// 	Speakers.findOneAndUpdate(findData, insertData, (err, res) => {
// 		if (err) {
// 			console.error("Unable to Add Speaker: ", err);
// 			return cb(
// 				responseUtilities.sendResponse(500, null, "addSpeaker", null, null)
// 			);
// 		}
// 		return cb(
// 			null,
// 			responseUtilities.sendResponse(
// 				200,
// 				"Speaker updated",
// 				"addSpeaker",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	});

// }


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Export all speakers 
 */
exports.exportAllSpeakers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {}

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

	if (data.search) {
		console.log("data.search => ", data.search)
		findData["$or"] = [
			{ name: { "$regex": data.search, "$options": "i" } },
			{ email: { "$regex": data.search, "$options": "i" } },
			{ title: { "$regex": data.search, "$options": "i" } }
		]
	}


	if (data.agencyId) {
		findData.eventAdminId = data.agencyId
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}

	if (JSON.stringify(data.assigned)) {
		if ([true, "true"].includes(data.assigned)) {
			findData.status = "ASSIGNED"
		} else {
			findData.status = "UNDER_REVIEW"
		}
	};

	console.log("FindData Export=> ", findData);

	let populateData = " eventId eventAdminId packageId country ";

	Speakers.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding exportAllSpeakers => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllSpeakers", err, null));
			}

			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllSpeakers", null, null));
			}
			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let speaker = res[i];
				if (data.eventId && !speaker.eventId) {
					continue;
				}
				if (data.agencyId && !speaker.eventAdminId) {
					continue;
				}

				let interestTopics = speaker?.interestTopics || [];
				let interestTopicsString =''
				interestTopics.map( e => interestTopicsString = `${interestTopicsString},${e} `);
				interestTopicsString = interestTopicsString.slice(1);

				let fieldObject = {
					"Agency": speaker?.eventAdminId?.name,
					"Event": speaker?.eventId?.name,
					"Name": speaker.name,
					"Email": speaker.email,
					"Designation": speaker?.designation,
					"Business Sector": speaker?.businessSector,
					"Organization": speaker.organization,
					"Website": speaker?.orgWebsite,
					"About": speaker?.about,
					"Phone": speaker?.mobile,
					"Whatsapp Mobile": speaker?.whatsAppMobile,
					"Intrest Topics": interestTopicsString,
					"Linkedin": speaker?.linkedin,
					"Twitter": speaker?.twitter,
					"Status": speaker?.status
				}
				dataArray.push(fieldObject);
			}

			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllSpeakers", null, null));

			}
			console.log("Export DTS => ",dataArray )
			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportAllSpeakers", dataArray, null));

		})
}



/*********************************************APP CONTROLLERS*********************************************************** */

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting speaker list
 */
exports.getSpeakers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	if (data.eventSpecific) {
		waterfallFunctions.push(async.apply(findSpeakersOfEvent, data));
	}
	waterfallFunctions.push(async.apply(getSpeakersOfEvent, data));
	async.waterfall(waterfallFunctions, cb);

};

const findSpeakersOfEvent = function (data, response, cb) {
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
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
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
			let speakers = (res && res.speakers) || null;
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Speakers fetched",
					"findSpeakersOfEvent",
					speakers,
					null
				)
			);
		});
}

const getSpeakersOfEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isBlocked: false,
		status: "ASSIGNED"
	};
	if (data.eventSpecific && response.data) {
		findData._id = { $nin: response.data }
	}

	if (data.name) {
		findData["name"] = { '$regex': `${data.name}`, '$options': 'i' }
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth && [role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	console.log("Find Speakers of Event => ", findData)
	Speakers.find(findData)
		.sort({ createdAt: -1 })
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to get Speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getSpeakers",
						null,
						null
					)
				);
			}
			let DTS = JSON.parse(JSON.stringify(res));
			for (let i = 0; i < res.length; i++) {
				let agendas = await Agendas.find({ speakers: res[i]._id });
				DTS[i].agendas = agendas;
			}

			let sendData = {
				data: DTS,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Speakers fetched",
					"getSpeakers",
					sendData,
					null
				)
			);
		});
}


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting speaker list for given event
 */
exports.getLatestSpeakers = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getLatestSpeakers", null, data.req.signature));
	};

	let findData = {
		isDeleted: false,
		isBlocked: false,
		isActive: true,
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
			about: 1,
			designation: 1,
			profilePicture: 1,
			company: 1,
			country: 1
		}
	}

	console.log("Find Speakers of Event => ", findData)
	let appMemberLimit = parseInt(process.env.appMemberLimit);

	Speakers.find(findData, project)
		.limit(appMemberLimit)
		.sort({ updatedAt: -1 })
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to get Speakers: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getLatestSpeakers", null, null));
			};
			let DTS = JSON.parse(JSON.stringify(res));
			for (let i = 0; i < res.length; i++) {
				let agendas = await Agendas.find({ speakers: res[i]._id });
				DTS[i].agendas = agendas;
			}
			return cb(null, responseUtilities.sendResponse(200, "All Speakers fetched", "getLatestSpeakers", DTS, null));
		});
}



/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Speaker by id
 */
exports.getSpecificSpeakerForApp = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.speakerId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getSpeakerById", null, data.req.signature));
	}

	if ((data.id && !mongoose.Types.ObjectId.isValid(data.id)) || (data.speakerId && !mongoose.Types.ObjectId.isValid(data.speakerId))) {
		return cb(responseUtilities.sendResponse(400, "Invalid Parameter", "getSpeakerById", null, data.req.signature));
	};

	let findData = {
		_id: data.id || data.speakerId,
		isDeleted: false,
		isActive: true,
		isBlocked: false
	};

	Speakers.findOne(findData, async (err, res) => {
		if (err) {
			console.error("Unable to get speaker: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getSpeakerById", null, null));
		}
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "Speaker not found", "getSpeakerById", null, data.req.signature));
		};

		let DTS = JSON.parse(JSON.stringify(res));

		let agendas = await Agendas.find({ speakers: res._id, isActive: true }).populate([
			{
				path: "speakers",
				select: "name isBlocked profilePicture"
			},{
				path: "arenaId",
				select: "eventId name createdAt description isDeleted"
			}]);
		let agendasToSend = [];
		agendas = JSON.parse(JSON.stringify(agendas))
		if (data.req.auth && data.req.auth.id) {
			for (let j = 0; j < agendas.length; j++) {
				let particularAgenda = JSON.parse(JSON.stringify(agendas[j]));

				let agendasSpeakers = agendas[j].speakers.filter(e => !e.isBlocked);
				particularAgenda.speakers = agendasSpeakers;
				let findBookmark = {
					userId: data.req.auth.id,
					agendaId: agendas[j]._id,
					isDeleted: false,
					isActive: true
				};
				let isBookMarked = await Bookmarks.findOne(findBookmark);
				if (isBookMarked) particularAgenda["isBookMarked"] = true
				else particularAgenda["isBookMarked"] = false;

				agendasToSend.push(particularAgenda);
			}

		}
		DTS.agendas = agendasToSend;

		// console.log("Specifc Speaker =>", DTS)
		return cb(null, responseUtilities.sendResponse(200, "Speaker fetched by id", "getSpeakerById", DTS, null));
	});
};

async function downloadFileFromS3(s3Url, localFilePath) {
	try {
	  const response = await axios({
		method: 'get',
		url: s3Url,
		responseType: 'stream',
	  });
  
	  const writer = fs.createWriteStream(localFilePath);
	  response.data.pipe(writer);
  
	  return new Promise((resolve, reject) => {
		writer.on('finish', resolve);
		writer.on('error', reject);
	  });
	} catch (error) {
	  console.error('Error downloading file:', error.message);
	  throw error;
	}
}

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for downloading file
 */
exports.downloadMemberFile = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.url) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "downloadMemberFile", null, data.req.signature));
	}
	const s3Url = data.url;
	const fileName = path.basename(s3Url);
	const extension = path.extname(fileName).toLowerCase();
	console.log("extension ", extension);
	const localFilePath = 'public/downloaded-file'+ extension;
	console.log("localFilePath ", localFilePath);

	downloadFileFromS3(s3Url, localFilePath)
	.then(() => {
		console.log('File downloaded successfully!')
		return cb(null, responseUtilities.sendResponse(200, "File downloaded successfully", "downloadMemberFile", localFilePath, null));
	})
	.catch((error) => {
		 console.error('Download failed:', error)
		return cb(responseUtilities.sendResponse(500, "Unable to download file", "downloadMemberFile", null, null));
	});
};