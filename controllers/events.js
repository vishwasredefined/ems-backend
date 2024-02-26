const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

const path = require("path");

//helper
const responseUtilities = require("../helpers/sendResponse");
const { getUTCStartDate } = require("../helpers/security");
const notify = require("../helpers/notification");

//models
const Events = require("../models/events");
const Speakers = require("../models/speakers");
const Medias = require("../models/medias");
const Sponsors = require("../models/sponsors");
const Exhibitors = require("../models/exhibitors");
const Agendas = require("../models/agendas");
const Packages = require("../models/packages");
const Country = require("../models/countries");
const Visitors = require("../models/visitors");
const Requests = require("../models/requests");
const State = require("../models/states");
const City = require("../models/cities");
const teammembers = require("../models/teamMembers");
const EventInterests = require("../models/eventInterests");
const QRCode = require('qrcode');
const Users = require("../models/users");
const notifications = require("../models/notifications");


const role = JSON.parse(process.env.role);
let emailUtilities = require("../helpers/email");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Event Controller
 */
exports.addEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkUniqueEvent, data));
	waterfallFunctions.push(async.apply(createEvent, data));
	async.waterfall(waterfallFunctions, cb);
};

//check unique event name
const checkUniqueEventName = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	if (data.eventId && data.req.auth && data.req.auth.role == role.superadmin) {
		waterfallFunctions.push(async.apply(getEventById, data));
	}
	waterfallFunctions.push(async.apply(checkUniqueEvent, data));
	async.waterfall(waterfallFunctions, cb);
};
exports.checkUniqueEventName = checkUniqueEventName;

//check if event is unique
const checkUniqueEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let eventRes = null;
	if (response.data && response.data.data) {
		eventRes = response.data.data
	}
	if (!data.name || !data.startDate || !data.endDate) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"checkUniqueEvent",
				null,
				data.req.signature
			)
		);
	}
	let startDate = new Date(data.startDate);
	let endDate = new Date(data.endDate);

	let extendedStartDate = new Date(data.startDate);
	extendedStartDate = new Date((extendedStartDate.setDate(extendedStartDate.getDate() - 1) || 0));

	let extendedEndDate = new Date(data.endDate);
	extendedEndDate = new Date(extendedEndDate.setUTCHours(23, 59, 59, 999))
	console.log("==============date check======", extendedStartDate, extendedEndDate)
	let findData = {
		isDeleted: false,
		expired: false,
		name: data.name,
		$nor: [
			{
				$and: [
					{ startDate: { $gt: startDate } },
					{ startDate: { $gt: extendedEndDate } }
				]
			},
			{
				$and: [

					{ endDate: { $lt: endDate } },
					{ endDate: { $lt: startDate } }
				]
			}
		]
	}

	if (data.eventId) {
		findData._id = { $ne: data.eventId }
	}
	if (data.eventId && data.req.auth && data.req.auth.role == role.superadmin && eventRes && eventRes.managedBy) {

		findData.managedBy = eventRes.managedBy
	} else {
		findData.managedBy = data.req.auth.id
	}

	console.log("====find event data for unique name==", findData)
	Events.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "checkUniqueEvent", null, null)
				);
			}
			let unique = true
			if (res) {
				unique = false
			}
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Event is unique",
					"checkUniqueEvent",
					{ unique: unique },
					null
				)
			);

		});
}
exports.checkUniqueEvent = checkUniqueEvent;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add event basic Data
 */
const createEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.name || !data.startDate || !data.endDate || !data.venue || !data.venue.type) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"createEvent",
				null,
				data.req.signature
			)
		);
	}

	if (data.venue.type == "VIRTUAL" && !data.venue.platforms && (!data.venue.zoomLink && !data.venue.skypeLink && !data.venue.meetLink && !data.venue.youTubeLink)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Virtual platform link missing",
				"createEvent",
				null,
				data.req.signature
			)
		);
	};

	let insertData = data;

	insertData.managedBy = data.req.auth.id;

	Events.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create Event: ", err);
			if (err.code == "11000" && err.errmsg.indexOf("name_1") != -1) {
				return cb(responseUtilities.sendResponse(400, "Event name already exist", "addEvents", null, null))
			}
			return cb(responseUtilities.sendResponse(500, null, "createEvent", null, null));
		}
		let sendData = {
			eventId: (res && res._id) || null,
			eventSocial: (res && res.socials) || null
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"event created",
				"createEvent",
				sendData,
				data.req.signature
			)
		);
	});
};

//Contoller for getting all events for admin/superadmin
exports.getAllEventsForAdmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData._id = { $in: data.req.auth.filteredEvents }
	}

	let check = mongoose.Types.ObjectId;

	if (data.fromDate) {
		let startDate = {};
		let fromDate = new Date(data.fromDate)
		startDate["$gte"] = fromDate
		console.log("startDate", startDate)
		findData.startDate = startDate;
	};

	if (data.toDate) {
		let endDate = {};
		let toDate = new Date(data.toDate)
		endDate["$lte"] = toDate;
		findData.endDate = endDate;
	}

	if (JSON.stringify(data.status)) {
		findData.isActive = data.status
	}

	if (JSON.stringify(data.expired)) {
		findData.expired = data.expired
	}

	if (JSON.stringify(data.isFeatured)) {
		findData.isFeatured = data.isFeatured
	}

	if (data.agencyId && check.isValid(data.agencyId)) {
		findData.managedBy = data.agencyId
	}

	let startDate = getUTCStartDate(new Date());
	if (data.cronologicalStatus == "Ongoing") {
		findData.expired = false;
		findData.startDate = { $lte: startDate };
		findData.endDate = { $gte: startDate };
	};

	if (data.cronologicalStatus == "Past") {
		findData.expired = true;
	};

	if (data.cronologicalStatus == "Upcoming") {
		findData.expired = false;
		findData.startDate = { $gt: startDate };
		findData.endDate = { $gt: startDate };
	};

	if (data.cronologicalStatus == "Live") {
		findData.isActive = true;
		findData.expired = false;
		findData.startDate = { $lte: startDate };
		findData.endDate = { $gte: startDate };
	}

	console.log("Find all event data => ", findData)
	Events.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for events: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllEventsForAdmin",
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
		Events.find(findData)
			.populate('venue.country venue.city venue.state')
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get Events: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllEventsForAdmin",
							null,
							null
						)
					);
				}

				let DTS = JSON.parse(JSON.stringify(res));
				for (let i = 0; i < res.length; i++) {
					// console.log(res[i].startDate, getUTCStartDate(new Date()))
					if (res[i].expired) {
						DTS[i].status = "PAST";
					} else if (res[i].startDate > getUTCStartDate(new Date())) {
						DTS[i].status = "UPCOMING"
					} else {
						DTS[i].status = "ONGOING"
					}
				};
				// console.log("Events res => ", res)
				let sendData = {
					data: DTS,
					count: count,
					pageLimit: limit,
				};
				return cb(null, responseUtilities.sendResponse(200, "All Events fetched for admin", "getAllEventsForAdmin", sendData, null));
			});
	});
};

//controler for getting events for user
exports.getAllEventsForClient = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		isActive: true
	};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData._id = { $in: data.req.auth.filteredEvents }
	}
	if (data.all) {
		delete findData.isActive;
	}
	if (data.req.auth.role != "user" && JSON.stringify(data.excludePastEvents)) {
		findData.expired = false;
	};

	Events.find(findData)
		.populate('venue.country venue.city venue.state')
		.sort({ isFeatured: -1, createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getAllEventsForClient",
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
					"All events fetched",
					"getAllEventsForClient",
					sendData,
					null
				)
			);
		});
};

//controler for getting featured/non-featured events
const getAllEventsByFeatured = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	if (data.countries) {
		waterfallFunctions.push(async.apply(getCountriesByName, data));
	}
	waterfallFunctions.push(async.apply(getFeaturedEvents, data));
	waterfallFunctions.push(async.apply(getNonFeaturedEvents, data));
	async.waterfall(waterfallFunctions, cb);
};
exports.getAllEventsByFeatured = getAllEventsByFeatured;

const getCountriesByName = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let countries = data.countries
	let regexArray = []
	let ifCountriesArray = false
	if (typeof countries == "string") {
		let countries = JSON.parse(data.countries) || []
		if (typeof countries == "object") {
			ifCountriesArray = true
			regexArray = countries.map((query) => {
				return { name: { $regex: new RegExp(query, "i") } };
			});
		}
	}
	if (ifCountriesArray && regexArray.length) {
		console.log("=======con=untries=======", countries)
		let findData = { isDeleted: false, $or: regexArray };

		console.log("count find", findData)
		Country.distinct("_id", findData, (err, res) => {
			if (err) {
				console.error("Unable to get Countries: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getCountriesForClient",
						null,
						null
					)
				);
			}
			data.countriesRes = res || [];
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Countries fetched",
					"getCountriesByName",
					null,
					null
				)
			);
		});
	} else {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				null,
				"getCountriesByName",
				null,
				null
			)
		);
	}
};

//get featured events
const getFeaturedEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isFeatured: true,
		isActive: true
	};

	if (data.country) {
		findData["venue.country"] = data.country
	}

	console.log("===========featured finddata", findData)
	Events.find(findData)
		.populate('venue.country venue.city venue.state')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getFeaturedEvents",
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
					"All events fetched",
					"getFeaturedEvents",
					res,
					null
				)
			);
		});
}

//get non-featured events
const getNonFeaturedEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		isFeatured: false,
		isActive: true
	};

	// if(data.country){
	// 	findData["venue.country"] = data.country
	// }
	if (data.countriesRes) {
		findData["venue.country"] = data.countriesRes || []
	}

	if (data.search) {
		const regex = /^[^*|\":<>[\]{}`\\()';&$]+$/;
		if (!regex.test(data.search)) {
			console.log("Invalid input");
		} else {

			findData["$or"] = [
				{ "eventDescription": { "$regex": data.search, "$options": "i" } },
				{ "name": { "$regex": data.search, "$options": "i" } },
				{ "eventType": { "$regex": data.search, "$options": "i" } }
			]
		}
	}

	if (data.eventSections && JSON.parse(data.eventSections).length) {
		console.log("===event section======", data.eventSections)
		findData.eventSections = { $in: JSON.parse(data.eventSections) }
	}

	console.log("==========non-fea=====", findData)
	Events.find(findData)
		.populate('venue.country venue.city venue.state')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getNonFeaturedEvents",
						null,
						null
					)
				);
			}
			let sendData = {
				featuredEvents: response.data || [],
				NonFeaturedEvents: res,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All events fetched",
					"getNonFeaturedEvents",
					sendData,
					null
				)
			);
		});
}

//Contoller for events by id
const getEventById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getEventById",
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
				"getEventById",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.id || data.eventId,
		isDeleted: false,
	};

	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
	// 	findData.managedBy = data.req.auth.id
	// }
	// if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
	// 	findData._id = { $in : data.req.auth.filteredEvents },
	// 	findData.managedBy = data.req.auth.eventAdminId
	// }

	console.log("find data for event by id", findData)
	Events.findOne(findData)
		.populate("speakers medias exhibitors sponsors venue.country venue.city venue.state")
		.populate("managedBy", "title name email address profilePicture userMeta socials")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getEventsById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Event not found",
						"getEventById",
						null,
						null
					)
				);
			};

			if (data.checkIfExpiredEvent && res.expired) {
				return cb(responseUtilities.sendResponse(400, "Event expired", "getEventById", null, null));
			}
			let sendData = {
				data: res,
			};
			data.eventDetails = res;
			return cb(null, responseUtilities.sendResponse(200, "Event fetched by id", "getEventById", sendData, null));
		});
};
exports.getEventById = getEventById;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update event basic details and address
 */
exports.updateEventDetails = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "updateEventDetails", null, data.req.signature));
	};
	// console.log("dataaaaaa ", data);
	let eventDetails = await Events.findOne({ _id: data.eventId });

	if ([true, "true"].includes(data.isActive)) {

		console.log("Active Event.....")
		if (
			!eventDetails.name ||
			!eventDetails.startDate ||
			!eventDetails.endDate ||
			!eventDetails?.venue?.type ||
			!eventDetails.eventDescription
		) {
			return cb(responseUtilities.sendResponse(400, "Please fill all details of event before publishing.", "updateEventDetails", null, null));
		};

		if (
			eventDetails?.venue?.type == "OFFLINE" &&
			(!eventDetails.venue?.venueTitle || !eventDetails.venue?.country || !eventDetails.venue?.addressLineOne || !eventDetails.venue?.city)
		) {
			return cb(responseUtilities.sendResponse(400, "Please fill address details of event before publishing.", "updateEventDetails", null, null));
		};

	};

	//Only SA can edit Past Events
	if (eventDetails.expired && data.req.auth && data.req.auth.role != role.superadmin) {
		console.log("Expired Event....");
		return cb(responseUtilities.sendResponse(400, "Please contact super admin to edit past events", "updateEventDetails", null, null));
	};

	let isChangeDetected = "false";
	if(data.startDate && data.endDate){
		var dateFormat = (eventDetails.startDate.getFullYear() + "-" + (((eventDetails.startDate.getMonth()+1) < 10 ) ? ("0"+ (eventDetails.startDate.getMonth()+1)) : (eventDetails.startDate.getMonth()+1)) + "-" + ((eventDetails.startDate.getDate() < 10) ? ("0"+ eventDetails.startDate.getDate()) : eventDetails.startDate.getDate()));
		console.log("startDateFormat ", dateFormat)
		var enddateFormat = (eventDetails.endDate.getFullYear() + "-" + (((eventDetails.endDate.getMonth()+1) < 10 ) ? ("0"+ (eventDetails.endDate.getMonth()+1)) : (eventDetails.endDate.getMonth()+1)) + "-" + ((eventDetails.endDate.getDate() < 10) ? ("0"+ eventDetails.endDate.getDate()) : eventDetails.endDate.getDate()));
		console.log("enddateFormat ", enddateFormat)

		data.startDate = (new Date(data.startDate).getFullYear() + "-" + (((new Date(data.startDate).getMonth()+1) < 10 ) ? ("0"+ (new Date(data.startDate).getMonth()+1)) : (new Date(data.startDate).getMonth()+1)) + "-" + ((new Date(data.startDate).getDate() < 10) ? ("0"+ new Date(data.startDate).getDate()) : new Date(data.startDate).getDate()));
		data.endDate = (new Date(data.endDate).getFullYear() + "-" + (((new Date(data.endDate).getMonth()+1) < 10 ) ? ("0"+ (new Date(data.endDate).getMonth()+1)) : (new Date(data.endDate).getMonth()+1)) + "-" + ((new Date(data.endDate).getDate() < 10) ? ("0"+ new Date(data.endDate).getDate()) : new Date(data.endDate).getDate()));
	}
	// console.log("data.startDate ", data.startDate);
	// console.log("dateFormat ", dateFormat);
	// console.log("data.endDate ", data.endDate);
	// console.log("enddateFormat ", enddateFormat);
	// console.log("data.venue.venueTitle ", data?.venue?.venueTitle);
	// console.log("eventDetails.venue.venueTitle ", eventDetails?.venue?.venueTitle);
	// console.log("data.venue.country ", data?.venue?.country);
	// console.log("eventDetails.venue.country ", eventDetails?.venue?.country);
	// console.log("data.venue.city ", data?.venue?.city);
	// console.log("eventDetails.venue.city ", eventDetails?.venue?.city);
	// console.log("data.venue.addressLineOne ", data?.venue?.addressLineOne);
	// console.log("eventDetails.venue.addressLineOne ", eventDetails?.venue?.addressLineOne);
	// console.log("data.name ", data?.name);
	// console.log("eventDetails.name ", eventDetails?.name);

	if(data.startDate && data.endDate && data.venue){
		if(	(data.startDate != dateFormat) || (data.endDate != enddateFormat) || 
			(data.venue.venueTitle != eventDetails.venue.venueTitle) || (data.venue.country+"" != eventDetails.venue.country+"") || 
			(data.venue.city+"" != eventDetails.venue.city+"") || (data.venue.addressLineOne != eventDetails.venue.addressLineOne))
		{
			isChangeDetected = "true";
		}
	}
	console.log("isChangeDetected ", isChangeDetected);

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(updateEvent, data));

	data.eventDetails = eventDetails;

	if(isChangeDetected == "true"){
		waterfallFunctions.push(async.apply(sendNotificationAfterChangeDetected, data));
	}
	if (data.isActive && ([true, "true"].includes(data.isActive))) {
		waterfallFunctions.push(async.apply(sendNotficationAfterPublishToAllUsers, data));
	}
	async.waterfall(waterfallFunctions, cb);
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update event address
 */
exports.updateEventAddress = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventAddress",
				null,
				data.req.signature
			)
		);
	}

	data.addressUpdate = true
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(updateEvent, data));
	async.waterfall(waterfallFunctions, cb);
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update event socials
 */
exports.updateEventSocials = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventSocials",
				null,
				data.req.signature
			)
		);
	}

	if (data.eventId && !mongoose.Types.ObjectId.isValid(data.eventId)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid Parameter",
				"updateEventSocials",
				null,
				data.req.signature
			)
		);
	}

	let findData = { _id: data.eventId };
	let updateData = {}

	if (JSON.stringify(data.mail)) {
		updateData["socials.mail"] = data.mail
	}
	if (JSON.stringify(data.website)) {
		updateData["socials.website"] = data.website
	}
	if (JSON.stringify(data.twitter)) {
		updateData["socials.twitter"] = data.twitter
	}
	if (JSON.stringify(data.linkedin)) {
		updateData["socials.linkedin"] = data.linkedin
	}
	if (JSON.stringify(data.facebook)) {
		updateData["socials.facebook"] = data.facebook
	}
	if (JSON.stringify(data.telegram)) {
		updateData["socials.telegram"] = data.telegram
	}
	if (JSON.stringify(data.yahoo)) {
		updateData["socials.yahoo"] = data.yahoo
	}
	if (JSON.stringify(data.youtube)) {
		updateData["socials.youtube"] = data.youtube
	}
	if (JSON.stringify(data.whatsApp)) {
		updateData["socials.whatsApp"] = data.whatsApp
	}

	if (JSON.stringify(data.instagram)) {
		updateData["socials.instagram"] = data.instagram
	}
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}

	Events.findOneAndUpdate(findData, updateData, { upsert: true }, (err, res) => {
		if (err) {
			console.error("Unable to update Events: ", err);
			return cb(responseUtilities.sendResponse(500, null, "updateEventSocials", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Event updated", "updateEventSocials", null, data.req.signature));
	});
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update event data
 */
const updateEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEvent",
				null,
				data.req.signature
			)
		);
	}

	let updateData = {};
	if (data.addressUpdate) {
		updateData["venue"] = data
	} else {
		updateData = data
	}
	let findData = { _id: data.eventId };

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}
	if ([role.eventmanager].includes(data.req.auth.role)) {
		findData._id = { $in: data.req.auth.filteredEvents };
		findData.managedBy = data.req.auth.eventAdminId;
	}
	console.log("data.req.auth.id ", data.req.auth.id);
	console.log("findData ", findData);

	Events.findOneAndUpdate(findData, updateData, { upsert: true, new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update Events: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateEvent", null, null)
			);
		}
		let sendData = {
			eventSocial: (res && res.socials) || null
		}
		return cb(null, responseUtilities.sendResponse(200, "Event updated", "updateEvent", sendData, data.req.signature));
	});
};
exports.updateEvent = updateEvent;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Publishing Event
 */
exports.publishEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(publishEventForAll, data));
	waterfallFunctions.push(async.apply(sendNotficationAfterPublishToAllUsers, data));	
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for publish event
 */
const publishEventForAll = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId || !JSON.stringify(data.isActive)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"publishEvent",
				null,
				data.req.signature
			)
		);
	}

	let updateData = {
		isActive: data.isActive
	};
	let findData = { _id: data.eventId };

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}
	Events.findOneAndUpdate(findData, updateData,{ new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update Event: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "publishEvent", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Event not found",
					"publishEvent",
					null,
					data.req.signature
				)
			);
		}
		data.eventDetails = res;
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event publish updated",
				"publishEvent",
				null,
				data.req.signature
			)
		);
	});
};
exports.publishEventForAll = publishEventForAll;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for send notification
 */
const sendNotficationAfterPublishToAllUsers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	// console.log("inside publish event method ", data.eventDetails);
	let find_data = { role: "user", isActive: true, isBlocked: false, "deviceInfo.0": { "$exists": true } };

	Users.find(find_data, { deviceInfo: 1, _id: 1 }).exec((errU, resU)  => {
		if (errU) {
			console.error("Unable to find users: ", errU);
			return cb(
				responseUtilities.sendResponse(500, null, "fetchUsers", null, null)
			);
		}
		console.log('All active users: ', resU.length)
		if(resU && resU.length > 0){
			let users = [];
			users = resU;
			let titleData = "New Event Added";
			for (let i in users) {
				let messageData = `${data?.eventDetails?.name} is now live! Take a peek and see what's exciting about it.`;
				
				let insertNotification = {
					alertType: "PUSH_NOTIFICATION",
					targetUser : "ALL_USERS",
					message: messageData,
					title: titleData,
					createdBy:  data.req.auth.eventAdminId || data.req.auth.id,
					userId: users[i]._id,
					eventAdminId:  data.req.auth.eventAdminId || data.req.auth.id,
				}

				notifications.create(insertNotification, (errN, resN) => {
					if (errN) {
						console.log('Error', errN);
					}
					console.log("insert response ", resN);
					if(resN){
						let deviceTokens = users[i].deviceInfo;

						let payload = {};
						
						let notification = {
							message: messageData,
							title: titleData,
							imageUrl: "",
						};
						deviceTokens.forEach(async (element) => {
							if (element.platform == "ios" || element.platform == "android") {
								console.log("token android ios", element);
								
								let notifRes = await notify.sendSingleNotification(
									element.token,
									notification,
									payload
								);
								console.log("Event notification resp====", typeof notifRes, typeof i, notifRes.response.response);
								if (notifRes.success) {
									console.log("Event notification sent");	
									if(notifRes.response.response.successCount == 1){
										console.log("notificationIds at end ")
										await notifications.findOneAndUpdate({ _id: resN._id },{ $set: {isSent: true } });
									}
									if((Number(i) + 1) == users.length){
										return cb(
											null,
											responseUtilities.sendResponse(
												200,
												"Event published",
												"eventPublished",
												null,
												data.req.signature
											)
										);
									}
								}
							}
						});
					}else{
						return cb(
							null,
							responseUtilities.sendResponse(
								200,
								"Event published",
								"eventPublished",
								null,
								data.req.signature
							)
						);
					}
				});
			}
		}else{
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Event published",
					"eventPublished",
					null,
					data.req.signature
				)
			);
		}
	})
};
exports.sendNotficationAfterPublishToAllUsers = sendNotficationAfterPublishToAllUsers;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for send notification after change detected
 */
const sendNotificationAfterChangeDetected = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	// console.log("data.eventDetails ", data.eventDetails);

	let find_data = { role: "user", isActive: true, isBlocked: false, "deviceInfo.0": { "$exists": true } };

	Users.find(find_data, { deviceInfo: 1, _id: 1 }).exec((errU, resU)  => {
		if (errU) {
			console.error("Unable to find users: ", errU);
			return cb(
				responseUtilities.sendResponse(500, null, "fetchUsers", null, null)
			);
		}
		console.log('All active users: ', resU.length)
		if(resU && resU.length > 0){
			let users = [];
			users = resU;
			let titleData = "Event Date/Location changed!";
			let messageData = `Notice: The location for ${data?.eventDetails?.name} has been updated. Check the app for the new spot!`;

			for (let i in users) {
				// console.log("userList...", users);
				let insertNotification = {
					alertType: "PUSH_NOTIFICATION",
					targetUser : "ALL_USERS",
					message: messageData,
					title: titleData,
					createdBy:  data.req.auth.eventAdminId || data.req.auth.id,
					userId: users[i]._id,
					eventAdminId:  data.req.auth.eventAdminId || data.req.auth.id,
				}

				notifications.create(insertNotification, (errN, resN) => {
					if (errN) {
						console.log('Error', errN);
					}
					// console.log("insert response ", resN);
					if(resN){
						let deviceTokens = users[i].deviceInfo;

						let payload = {};
						let notification = {
							message: messageData,
							title: titleData,
							imageUrl: "",
						};
						deviceTokens.forEach(async (element) => {
							console.log("user token");
							if (element.platform == "ios" || element.platform == "android") {
								console.log("token android ios", element);
								
								let notifRes = await notify.sendSingleNotification(
									element.token,
									notification,
									payload
								);
								console.log("Event notification resp====", typeof notifRes, typeof i, notifRes.response.response);
								if (notifRes.success) {
									console.log("Event notification sent");	
									if(notifRes.response.response.successCount == 1){
										console.log("notificationIds at end ")
										await notifications.findOneAndUpdate({ _id: resN._id },{ $set: {isSent: true } });
									}
									if((Number(i)+1) == users.length){
										return cb(
											null,
											responseUtilities.sendResponse(
												200,
												"Event notification sent",
												"sendNotificationAfterChangeDetected",
												null,
												data.req.signature
											)
										);
									}
								}
							}
						});
					}else{
						return cb(
							null,
							responseUtilities.sendResponse(
								200,
								"Event notification sent",
								"sendNotificationAfterChangeDetected",
								null,
								data.req.signature
							)
						);
					}
				});
			}
		}else{
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Event notification sent",
					"sendNotificationAfterChangeDetected",
					null,
					data.req.signature
				)
			);
		}
	})
};
exports.sendNotificationAfterChangeDetected = sendNotificationAfterChangeDetected;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Deleting Event
 */
exports.deleteEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(400, "Missing params", "deleteEvent", null, null)
		);
	}
	let findData = {
		_id: data.id,
		managedBy: data.req.auth.id
	};
	let updateData = {
		isDeleted: true,
	};
	Events.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to delete Events", err);
			return cb(
				responseUtilities.sendResponse(500, null, "deleteEvent", null, null)
			);
		}

		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					404,
					"Event not found",
					"deleteEvent",
					null,
					data.req.signature
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event deleted",
				"deleteEvent",
				null,
				null
			)
		);
	});
};

//Contoller for changing Events status
exports.updateEventStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventStatus",
				null,
				null
			)
		);
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkExpireEvent, data));
	waterfallFunctions.push(async.apply(changeEventStatus, data));
	async.waterfall(waterfallFunctions, cb);
};

//check if event expired
const checkExpireEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"checkExpireEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: data.id,
		managedBy: data.req.auth.id
	};
	Events.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to find event", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"checkExpireEvent",
					null,
					null
				)
			);
		}
		if (!res || res.expired) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Event is expired",
					"checkExpireEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event is not expired updated",
				"checkExpireEvent",
				null,
				null
			)
		);

	});
}

//update event status
const changeEventStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventStatus",
				null,
				null
			)
		);
	}
	let findData = {
		_id: data.id,
		managedBy: data.req.auth.id
	};
	let updateData = {
		isActive: data.isActive,
	};
	Events.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update status", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateEventStatus",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event status updated",
				"updateEventStatus",
				null,
				null
			)
		);
	});
}

//Contoller for find admin events
const findAdminEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		managedBy: data.req.auth.id,
		isDeleted: false
	};

	Events.distinct("_id", findData, (err, res) => {
		if (err) {
			console.error("Unable to find event", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"findAdminEvents",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Events fetched",
				"findAdminEvents",
				res,
				null
			)
		);
	});
};
exports.findAdminEvents = findAdminEvents

//Contoller for mark event featured
exports.markEventFeatured = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId || !JSON.stringify(data.isFeatured)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"markEventFeatured",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(markEventForFeature, data));
	async.waterfall(waterfallFunctions, cb);

};

//mark /unmark event featured
const markEventForFeature = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId || !JSON.stringify(data.isFeatured)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"markEventForFeature",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.eventId
	};
	if (data.req.auth.role == role.eventadmin) {
		findData.managedBy = data.req.auth.id
	}
	let updateData = { "$set": { isFeatured: data.isFeatured } };
	Events.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update featured Events: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "markEventForFeature", null, null)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event updated",
				"markEventForFeature",
				null,
				data.req.signature
			)
		);
	});
}

//Contoller for assigning event members(medias/speakers.....) to event
exports.assignMembersToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"assignMembersToEvent",
				null,
				data.req.signature
			)
		);
	}

	console.log("=====in assign member to event")

	let waterfallFunctions = [];
	if (data.speakerIds || data.unSelectedSpeakerIds) {

		if (data.unSelectedSpeakerIds) {
			waterfallFunctions.push(async.apply(unAssignSpeakersToEvent, data));
		}
		if (data.speakerIds) {
			waterfallFunctions.push(async.apply(assignSpeakersToEvent, data));
		}

	} else if (data.mediaIds || data.unSelectedMediaIds) {
		console.log("=============media ids========>", data.mediaIds, data.unSelectedMediaIds)

		if (data.unSelectedMediaIds) {
			waterfallFunctions.push(async.apply(unAssignMediasToEvent, data));
		}
		if (data.mediaIds) {
			waterfallFunctions.push(async.apply(assignMediasToEvent, data));
		}

	} else if (data.sponsorIds || data.unSelectedSponsorIds) {

		if (data.unSelectedSponsorIds) {
			waterfallFunctions.push(async.apply(unAssignSponsorsToEvent, data));
		}
		if (data.sponsorIds) {
			waterfallFunctions.push(async.apply(findSponsorPackageCount, data));
			waterfallFunctions.push(async.apply(assignSponsorsToEvent, data));
		}

	} else if (data.exhibitorIds || data.unSelectedExhibitorIds) {

		if (data.unSelectedExhibitorIds) {
			waterfallFunctions.push(async.apply(unAssignExhibitorsToEvent, data));
		}
		if (data.exhibitorIds) {
			waterfallFunctions.push(async.apply(findExhibitorPackageCount, data));
			waterfallFunctions.push(async.apply(assignExhibitorsToEvent, data));
		}

	} else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Inavalid member",
				"assignMembersToEvent",
				null,
				data.req.signature
			)
		);
	}

	async.waterfall(waterfallFunctions, cb);

};

//controler for get Existing Members By Email
exports.getExistingMembersByEmail = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.member || !data.email) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getExistingMembersByEmail",
				null,
				data.req.signature
			)
		);
	}

	let member = data.member
	if (!["speakers", "sponsors", "medias", "exhibitors"].includes(member)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid member",
				"getExistingMembersByEmail",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	if (member == "speakers") {

		waterfallFunctions.push(async.apply(getSpeakersDetails, data));
	} else if (member == "medias") {

		waterfallFunctions.push(async.apply(getMediaPartnersDetails, data));
	} else if (member == "sponsors") {

		waterfallFunctions.push(async.apply(getSponsorsDetails, data));
	} else if (member == "exhibitors") {

		waterfallFunctions.push(async.apply(getExhibitorsDetails, data));
	} else {

		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid member",
				"getExistingMembersByEmail",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterfallFunctions, cb);

};

//fetch speakers details
const getSpeakersDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email && !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getSpeakersDetails",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		isDeleted: false
	}

	if (data.email) {
		findData.email = data.email
	}
	if (data.eventId && data.assigned) {
		findData.eventId = data.eventId
		findData.status = "ASSIGNED"
	}
	// findData.eventAdminId = data.req.auth.id
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	console.log('========', findData)
	Speakers.find(findData)
		.populate('country eventId')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getSpeakersDetails",
						null,
						null
					)
				);
			}

			let speakerRes = JSON.parse(JSON.stringify(res))
			if (data.eventId && !data.assigned && speakerRes && speakerRes.length) {
				if (speakerRes.find((o) => {
					let exist = false
					if (o.eventId && o.eventId._id) {
						exist = (o.eventId._id.toString() == data.eventId.toString())
					}
					return exist
				})
				) {
					return cb(
						responseUtilities.sendResponse(
							400,
							"Speaker Already added for the event",
							"getSpeakersDetails",
							null,
							data.req.signature
						)
					);
				}
			}
			let sendData = {
				data: speakerRes,
			};

			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Speakers fetched",
					"getSpeakersDetails",
					sendData,
					null
				)
			);
		});
}

//fetch media-partners details
const getMediaPartnersDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email && !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getMediaPartnersDetails",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		isDeleted: false
	}

	if (data.email) {
		findData.email = data.email
	}
	if (data.eventId && data.assigned) {
		findData.eventId = data.eventId
		findData.status = "ASSIGNED"
	}
	// findData.eventAdminId = data.req.auth.id
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	Medias.find(findData)
		.populate('country eventId')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getMediaPartnersDetails",
						null,
						null
					)
				);
			}
			let mediaRes = JSON.parse(JSON.stringify(res))
			if (data.eventId && !data.assigned && mediaRes && mediaRes.length) {
				if (mediaRes.find(o => o.eventId && o.eventId._id && o.eventId._id.toString() == data.eventId.toString())) {
					return cb(
						responseUtilities.sendResponse(
							400,
							"Media Already added for the event",
							"getMediaPartnersDetails",
							null,
							data.req.signature
						)
					);
				}
			}
			let sendData = {
				data: mediaRes,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Media-partners fetched",
					"getMediaPartnersDetails",
					sendData,
					null
				)
			);
		});
}

//fetch sponsors details
const getSponsorsDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email && !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getSponsorsDetails",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		isDeleted: false
	}

	if (data.email) {
		findData.email = data.email
	}
	if (data.eventId && data.assigned) {
		findData.eventId = data.eventId
		findData.status = "ASSIGNED"
	}

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	Sponsors.find(findData)
		.populate('country eventId')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Speakers: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getSponsorsDetails",
						null,
						null
					)
				);
			}
			let sponsorRes = JSON.parse(JSON.stringify(res))
			if (data.eventId && !data.assigned && sponsorRes && sponsorRes.length) {
				if (sponsorRes.find(o => o.eventId && o.eventId._id && o.eventId._id.toString() == data.eventId.toString())) {
					return cb(
						responseUtilities.sendResponse(
							400,
							"Sponsor Already added for the event",
							"getSponsorsDetails",
							null,
							data.req.signature
						)
					);
				}
			}
			let sendData = {
				data: sponsorRes,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Sponsors fetched",
					"getSponsorsDetails",
					sendData,
					null
				)
			);
		});
}

//fetch exhibitors details
const getExhibitorsDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email && !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getExhibitorsDetails",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		isDeleted: false
	}

	if (data.email) {
		findData.email = data.email
	}
	if (data.eventId && data.assigned) {
		findData.eventId = data.eventId
		findData.status = "ASSIGNED"
	}

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	Exhibitors.find(findData)
		.populate('country eventId')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Exhibitors: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getExhibitorsDetails",
						null,
						null
					)
				);
			}
			let exhibitorRes = JSON.parse(JSON.stringify(res))
			if (data.eventId && !data.assigned && exhibitorRes && exhibitorRes.length) {
				if (exhibitorRes.find(o => o.eventId && o.eventId._id && o.eventId._id.toString() == data.eventId.toString())) {
					return cb(
						responseUtilities.sendResponse(
							400,
							"Exhibitor Already added for the event",
							"getExhibitorsDetails",
							null,
							data.req.signature
						)
					);
				}
			}
			let sendData = {
				data: exhibitorRes,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Ehibitors fetched",
					"getExhibitorsDetails",
					sendData,
					null
				)
			);
		});
}

//controler for getting event member details
exports.getMembersDetail = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.member || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getMembersDetail",
				null,
				data.req.signature
			)
		);
	}

	let member = data.member
	if (!["speakers", "sponsors", "medias", "exhibitors"].includes(member)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid member",
				"getMembersDetail",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	if (member == "speakers") {
		waterfallFunctions.push(async.apply(getSpeakersDetails, data));
	} else if (member == "medias") {

		waterfallFunctions.push(async.apply(getMediaPartnersDetails, data));
	} else if (member == "sponsors") {

		waterfallFunctions.push(async.apply(getSponsorsDetails, data));
	} else if (member == "exhibitors") {

		waterfallFunctions.push(async.apply(getExhibitorsDetails, data));
	} else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid member",
				"getMembersDetail",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterfallFunctions, cb);
}

//for future use
const getAssignedSpeakers = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		status: 'ASSIGNED',
		isDeleted: false
	};

	findData.eventAdminId = data.req.auth.id

	let limit = parseInt(process.env.pageLimit)
	let skip = 0;
	if (data.limit) {
		limit = parseInt(data.limit)
	}

	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}

	Speakers.find(findData)
		.populate("eventId")
		// .sort(sortOrder)
		.skip(skip)
		.limit(limit)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getAssignedSpeakers",
						null,
						null
					)
				);
			}

			let eventRes = JSON.parse(JSON.stringify(res))
			let sendData = {
				data: eventRes
			};
			sendData["count"] = eventRes.count || 0
			delete eventRes.count

			sendData["pageLimit"] = limit;
			sendData["currentPage"] = parseInt(data.currentPage) || 1
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All events fetched",
					"getAssignedSpeakers",
					sendData,
					null
				)
			);
		});
}

//for future use
const getAssignedMedias = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		status: 'ASSIGNED',
		isDeleted: false
	};

	findData.eventAdminId = data.req.auth.id

	let limit = parseInt(process.env.pageLimit)
	let skip = 0;
	if (data.limit) {
		limit = parseInt(data.limit)
	}

	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}

	Medias.find(findData)
		.populate("eventId")
		// .sort(sortOrder)
		.skip(skip)
		.limit(limit)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getAssignedMedias",
						null,
						null
					)
				);
			}

			let eventRes = JSON.parse(JSON.stringify(res))
			let sendData = {
				data: eventRes
			};
			sendData["count"] = eventRes.count || 0
			delete eventRes.count

			sendData["pageLimit"] = limit;
			sendData["currentPage"] = parseInt(data.currentPage) || 1
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All events fetched",
					"getAssignedMedias",
					sendData,
					null
				)
			);
		});
}

//for future use
const getAssignedSponsors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		status: 'ASSIGNED',
		isDeleted: false
	};

	findData.eventAdminId = data.req.auth.id

	let limit = parseInt(process.env.pageLimit)
	let skip = 0;
	if (data.limit) {
		limit = parseInt(data.limit)
	}

	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}

	Sponsors.find(findData)
		.populate("eventId")
		.skip(skip)
		.limit(limit)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getAssignedSponsors",
						null,
						null
					)
				);
			}

			let eventRes = JSON.parse(JSON.stringify(res))
			let sendData = {
				data: eventRes
			};
			sendData["count"] = eventRes.count || 0
			delete eventRes.count

			sendData["pageLimit"] = limit;
			sendData["currentPage"] = parseInt(data.currentPage) || 1
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All events fetched",
					"getAssignedSponsors",
					sendData,
					null
				)
			);
		});
}

//for future use
const getAssignedExhibitors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		status: 'ASSIGNED',
		isDeleted: false
	};

	findData.eventAdminId = data.req.auth.id

	let limit = parseInt(process.env.pageLimit)
	let skip = 0;
	if (data.limit) {
		limit = parseInt(data.limit)
	}

	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}


	Exhibitors.find(findData)
		.populate("eventId")
		.skip(skip)
		.limit(limit)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Events: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getAssignedExhibitors",
						null,
						null
					)
				);
			}

			let eventRes = JSON.parse(JSON.stringify(res))
			let sendData = {
				data: eventRes
			};
			sendData["count"] = eventRes.count || 0
			delete eventRes.count

			sendData["pageLimit"] = limit;
			sendData["currentPage"] = parseInt(data.currentPage) || 1
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All events fetched",
					"getAssignedExhibitors",
					sendData,
					null
				)
			);
		});
}

//assign speakers from event
const assignSpeakersToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		_id: { $in: data.speakerIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED"
		}
	}
	Speakers.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"assignSpeakersToEvent",
					null,
					null
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Speaker updated",
				"assignSpeakersToEvent",
				null,
				null
			)
		);
	});
}

//unassign speakers from event
const unAssignSpeakersToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.unSelectedSpeakerIds || !data.unSelectedSpeakerIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Mising params",
				"unAssignSpeakersToEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $in: data.unSelectedSpeakerIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW"
		}
	}
	Speakers.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"unAssignSpeakersToEvent",
					null,
					null
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Speakers updated",
				"unAssignSpeakersToEvent",
				null,
				null
			)
		);
	});
}

//assign medias from event
const assignMediasToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.mediaIds || !data.mediaIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Mising params",
				"assignMediasToEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $in: data.mediaIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED"
		}
	}
	Medias.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update media partner", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"assignMediasToEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Media-partner updated",
				"assignMediasToEvent",
				null,
				null
			)
		);
	});
}

//unassign medias from event
const unAssignMediasToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	console.log("============in unassign media")
	if (!data.unSelectedMediaIds || !data.unSelectedMediaIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Mising params",
				"unAssignMediasToEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $in: data.unSelectedMediaIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW"
		}
	}
	console.log("===========find and update data for media==========", findData, updateData)
	Medias.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update media", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"unAssignMediasToEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Media updated",
				"unAssignMediasToEvent",
				null,
				null
			)
		);
	});
}

//assign sponsors from event
const assignSponsorsToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		_id: { $in: data.sponsorIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED"
		}
	}
	Sponsors.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update sponsor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"assignSponsorsToEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Sponsors updated",
				"assignSponsorsToEvent",
				null,
				null
			)
		);
	});
}

// unassign sponsors from event
const unAssignSponsorsToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.unSelectedSponsorIds || !data.unSelectedSponsorIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Mising params",
				"unAssignSponsorsToEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $in: data.unSelectedSponsorIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW"
		}
	}
	Sponsors.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"unAssignSponsorsToEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Sponsors updated",
				"unAssignSponsorsToEvent",
				null,
				null
			)
		);
	});
}

// assign exhibitors from event
const assignExhibitorsToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		_id: { $in: data.exhibitorIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED"
		}
	}
	Exhibitors.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"assignExhibitorsToEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Exhibitor updated",
				"assignExhibitorsToEvent",
				null,
				null
			)
		);
	});
}

//unassign exhibitors from event
const unAssignExhibitorsToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.unSelectedExhibitorIds || !data.unSelectedExhibitorIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Missing params",
				"unAssignExhibitorsToEvent",
				null,
				null
			)
		);
	}
	let findData = {
		_id: { $in: data.unSelectedExhibitorIds },
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW"
		}
	}
	Exhibitors.updateMany(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update exhibitor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"unAssignExhibitorsToEvent",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Exhibitors updated",
				"unAssignExhibitorsToEvent",
				null,
				null
			)
		);
	});
}

//find sponsor and package details
const findSponsorPackageCount = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.sponsorIds || !data.sponsorIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Mising params",
				"checkSponsorPackages",
				null,
				null
			)
		);
	}

	console.log("=====in assign sponsor to event")
	let findData = {
		_id: { $in: data.sponsorIds }
	}

	Sponsors.find(findData)
		.populate('packageId')
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to update sponsor", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"checkSponsorPackages",
						null,
						null
					)
				);
			}

			// console.log("Finding sponsors to assign => ", res)
			let packageIds = []
			let packageDetails = []
			let sponsorRes = JSON.parse(JSON.stringify(res))
			for (let i in res) {
				let packageData = { allSponsorIds: data.sponsorIds };

				if (!res[i].packageId || !res[i].packageId.isActive) {
					return cb(
						responseUtilities.sendResponse(
							400,
							"Package not found",
							"getAssignedSponsorPackageCount",
							null,
							data.req.signature
						)
					);
				}
				console.log("=======package id====", res[i].packageId._id, res[i].packageId.isActive)
				if (!packageIds.includes((res[i].packageId._id).toString())) {
					console.log("=======matched package id====", res[i].packageId._id)
					packageIds.push((res[i].packageId._id).toString())
					packageData.packageId = (res[i].packageId._id).toString()
					let sponsorsCount = []
					sponsorsCount = res.filter(el => (el.packageId && ((el.packageId._id).toString() == (res[i].packageId._id).toString())))
					sponsorsCount = (sponsorsCount.length) || 0
					packageData["sponsorsCount"] = sponsorsCount
					packageData["quantity"] = (res[i].packageId && res[i].packageId.quantity) || 0
					packageDetails.push(packageData)
				}
			}

			console.log("=====sponsor and package data=======", packageDetails)
			if (packageDetails.length) {
				for (let i in packageDetails) {
					let sponsorCheckRes = await checkSponsorCount({ package: packageDetails[i] })
					if (!sponsorCheckRes.success) {
						return cb(
							responseUtilities.sendResponse(
								400,
								sponsorCheckRes.message || "Package not enough",
								"getAssignedSponsorPackageCount",
								null,
								data.req.signature
							)
						);
					}
					if (parseInt(i) + 1 == packageDetails.length) {
						return cb(
							null,
							responseUtilities.sendResponse(
								200,
								"Sponsor package found",
								"checkSponsorPackages",
								null,
								null
							)
						);
					}
				}
			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"Sponsor package enough",
						"checkSponsorPackages",
						null,
						null
					)
				);
			}
		});
}

// check sponsor and package count to assign to an event
const checkSponsorCount = function (data) {
	return new Promise(function (resolve, reject) {
		//find assigned sponsor count
		let packageRes = data.package
		let allSponsorIds = packageRes.allSponsorIds
		let findData = {
			packageId: packageRes.packageId,
			"$or": [
				{
					status: "ASSIGNED"
				},
				{
					_id: { $in: allSponsorIds }
				}
			]
		};

		let requiredPackages = +(packageRes.sponsorsCount) || 0
		Sponsors.countDocuments(findData, (err, count) => {
			if (err) {
				console.error("Unable to get sponsors: ", err);
				return resolve({
					success: false,
					message: "error getting packages"
				});
			}
			let assignedPackageCount = count || 0;
			let totalToAssign = count || 0;
			assignedPackageCount = +assignedPackageCount;

			let quantity = +(packageRes.quantity) || 0

			console.log("==========total package count, assigned, total required to assign====", quantity, assignedPackageCount, totalToAssign)
			if (quantity && (totalToAssign <= quantity)) {
				return resolve({
					success: true,
				});
			} else {
				return resolve({
					success: false,
					message: "Package not enough"
				});
			}
		});
		//check quantity
	});
};

//find exhibitor and package details
const findExhibitorPackageCount = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.exhibitorIds || !data.exhibitorIds.length) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Params mising",
				"findExhibitorPackageCount",
				null,
				null
			)
		);
	}

	let findData = {
		_id: { $in: data.exhibitorIds }
	}

	Exhibitors.find(findData)
		.populate('packageId')
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to get exhibitor", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"findExhibitorPackageCount",
						null,
						null
					)
				);
			}

			let packageIds = []
			let packageDetails = []
			let exhibitorRes = JSON.parse(JSON.stringify(res))
			for (let i in res) {
				console.log("Exhbibitor => ", res[i])
				let packageData = { allExhibitorIds: data.exhibitorIds };

				if (!res[i].packageId) {
					return cb(responseUtilities.sendResponse(400, "Package not found", "findExhibitorPackageCount", null, data.req.signature));
				}
				if (!res[i].packageId.isActive) {
					return cb(responseUtilities.sendResponse(400, "Package not active", "findExhibitorPackageCount", null, data.req.signature));
				};


				if (!packageIds.includes((res[i].packageId._id).toString())) {
					console.log("=======matched package id====", res[i].packageId._id)
					packageIds.push((res[i].packageId._id).toString())
					packageData.packageId = (res[i].packageId._id).toString()
					let exhibitorsCount = []
					console.log("========exhibitor count=====", res.length)
					exhibitorsCount = res.filter(el => (el.packageId && ((el.packageId._id).toString() == (res[i].packageId._id).toString())))
					exhibitorsCount = (exhibitorsCount.length) || 0
					packageData["exhibitorsCount"] = exhibitorsCount
					packageData["quantity"] = (res[i].packageId && res[i].packageId.quantity) || 0
					packageDetails.push(packageData)
				}
			}

			console.log("Sponsor and package data => ", packageDetails)
			if (packageDetails.length) {
				for (let i in packageDetails) {
					let exhibitorCheckRes = await checkExhibitorCount({ package: packageDetails[i] })
					if (!exhibitorCheckRes.success) {
						return cb(
							responseUtilities.sendResponse(
								400,
								exhibitorCheckRes.message || "Package not enough",
								"findExhibitorPackageCount",
								null,
								data.req.signature
							)
						);
					}
					if (parseInt(i) + 1 == packageDetails.length) {
						return cb(
							null,
							responseUtilities.sendResponse(
								200,
								"Exhibitor package found",
								"findExhibitorPackageCount",
								null,
								null
							)
						);
					}
				}
			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"Exhibitor package enough",
						"findExhibitorPackageCount",
						null,
						null
					)
				);
			}
		});
}

//check exhibitor and package count to assign to an event
const checkExhibitorCount = function (data) {
	return new Promise(function (resolve, reject) {

		//find assigned sponsor count
		let packageRes = data.package
		let allExhibitorIds = packageRes.allExhibitorIds
		let findData = {
			packageId: packageRes.packageId,
			"$or": [
				{
					status: "ASSIGNED"
				},
				{
					_id: { $in: allExhibitorIds }
				}
			]
		};

		let requiredPackages = +(packageRes.exhibitorsCount) || 0
		Exhibitors.countDocuments(findData, (err, count) => {
			if (err) {
				console.error("Unable to get Exhibitors: ", err);
				return resolve({
					success: false,
					message: "error getting Exhibitors"
				});
			}
			let assignedPackageCount = count || 0;
			let totalToAssign = count || 0;
			assignedPackageCount = +assignedPackageCount;

			let quantity = +(packageRes.quantity) || 0

			console.log("==========total package count, assigned, total required to assign====", quantity, assignedPackageCount, totalToAssign)
			if (quantity && (totalToAssign <= quantity)) {
				return resolve({
					success: true,
				});
			} else {
				return resolve({
					success: false,
					message: "Package not enough"
				});
			}
		});
		//check quantity
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting event count for dashboard
 */
const getEventCountForDashboard = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.managedBy = mongoose.Types.ObjectId(data.req.auth.id)
	}
	if (data.req.auth && [role.eventmanager, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {

		let filteredEvents = (data.req.auth.filteredEvents || [])
		filteredEvents = filteredEvents.map((el) => mongoose.Types.ObjectId(el))
		findData._id = { $in: filteredEvents };
		findData.managedBy = mongoose.Types.ObjectId(data.req.auth.eventAdminId);
	};

	let startDate = getUTCStartDate(new Date());

	console.log("FindData for Events in Dashbard =>", findData, startDate)
	Events.aggregate([
		{
			"$match": findData
		},
		{
			"$facet": {
				"allEvents": [
					{ "$count": "allEvents" },
				],
				"allOngoingEvents": [
					{ "$match": { "isActive": true, "expired": false, "startDate": { $lte: startDate }, endDate: { $gte: startDate } } },
					{ "$count": "allOngoingEvents" },
				],
				"allCompletedEvents": [
					{ "$match": { "expired": true } },
					{ "$count": "allCompletedEvents" }
				],
				"allUpcomingEvents": [
					{ "$match": { expired: false, "startDate": { $gt: startDate }, endDate: { $gt: startDate } } },
					{ "$count": "allUpcomingEvents" }
				],
			}
		},
		{
			$project: {
				"allEvents": { "$arrayElemAt": ["$allEvents.allEvents", 0] },
				"allOngoingEvents": { "$arrayElemAt": ["$allOngoingEvents.allOngoingEvents", 0] },
				"allCompletedEvents": { "$arrayElemAt": ["$allCompletedEvents.allCompletedEvents", 0] },
				"allUpcomingEvents": { "$arrayElemAt": ["$allUpcomingEvents.allUpcomingEvents", 0] },
			}
		}
	]).exec((err, res) => {
		if (err) {
			console.error("Unable to get User: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getEventCountForDashboard", null, null));
		}
		console.log(res[0]);

		let DTS = { ...res[0] };
		if (!DTS.allEvents) DTS.allEvents = 0;
		if (!DTS.allOngoingEvents) DTS.allOngoingEvents = 0;
		if (!DTS.allCompletedEvents) DTS.allCompletedEvents = 0;
		if (!DTS.allUpcomingEvents) DTS.allUpcomingEvents = 0;

		return cb(null, responseUtilities.sendResponse(200, "Event count fetched", "getEventCountForDashboard", DTS, null));
	});
};
exports.getEventCountForDashboard = getEventCountForDashboard;

//Contoller for update event floorplan
exports.updateEventFloorPlan = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId || !data.type || !data.link) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventFloorPlan",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.eventId
	};

	let updateData = {
		floorPlan: {
			type: data.type,
			link: data.link
		}
	};
	console.log("find data for event by id", findData)
	Events.findOneAndUpdate(findData, updateData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "updateEventFloorPlan", null, null)
				);
			}
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Event floorplan updated",
					"updateEventFloorPlan",
					null,
					null
				)
			);
		});
}

//controler for getting staff events
const getStaffEvents = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];

	waterfallFunctions.push(async.apply(getOngoingEventsForStaff, data));
	// waterfallFunctions.push(async.apply(getUpcomingEventsForStaff, data));
	async.waterfall(waterfallFunctions, cb);

};
exports.getStaffEvents = getStaffEvents;

// // get Ongoing Events For Staff
// const getOngoingEventsForStaff = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}

// 	let userId = mongoose.Types.ObjectId(data.userId) || mongoose.Types.ObjectId(data.req.auth.id)
// 	let currentDate = new Date();
// 	currentDate = new Date(currentDate.setUTCHours(0, 0, 0, 0))

// 	let pipeline = [
// 		{ $match: { role: "eventmanager", assigned: true, userId: userId } },
// 		{ $project: { eventId: "$eventId" } },
// 		{
// 			$lookup: {
// 				from: "events",
// 				localField: "eventId",
// 				foreignField: "_id",
// 				as: "eventId"
// 			}
// 		},
// 		{
// 			$unwind: { path: "$eventId" }
// 		},
// 		{
// 			'$facet':
// 			{
// 				ongoingEvent: [
// 					{
// 						$match:
// 						{
// 							"eventId.isDeleted": false,
// 							"eventId.startDate": { $lte: currentDate },
// 							"eventId.endDate": { $gt: currentDate }
// 						}
// 					}
// 				],
// 				upcomingEvents: [
// 					{
// 						$match:
// 						{
// 							"eventId.isDeleted": false,
// 							"eventId.startDate": { $gt: currentDate },
// 							"eventId.endDate": { $gt: currentDate }
// 						}
// 					}
// 				]
// 			}
// 		}
// 	]

// 	console.log("===========pipeline", pipeline)

// 	teammembers.aggregate(pipeline)
// 		.exec((err, res) => {
// 			if (err) {
// 				console.error("Unable to get Events: ", err);
// 				return cb(
// 					responseUtilities.sendResponse(
// 						500,
// 						null,
// 						"getOngoingEventsForStaff",
// 						null,
// 						null
// 					)
// 				);
// 			}

// 			return cb(
// 				null,
// 				responseUtilities.sendResponse(
// 					200,
// 					"Ongoing events fetched",
// 					"getOngoingEventsForStaff",
// 					res,
// 					null
// 				)
// 			);
// 		});
// }

// //get Upcoming Events For Staff
// const getUpcomingEventsForStaff = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}

// 	let currentDate = new Date();
// 	currentDate = new Date(currentDate.setUTCHours(0, 0, 0, 0));

// 	let findData = {
// 		isDeleted: false,
// 		startDate: { $gt: currentDate },
// 		endDate: { $gt: currentDate },
// 		staff: data.req.auth.id
// 	};

// 	Events.find(findData)
// 		.populate('venue.country venue.city venue.state')
// 		.sort({ createdAt: -1 })
// 		.exec((err, res) => {
// 			if (err) {
// 				console.error("Unable to get Events: ", err);
// 				return cb(
// 					responseUtilities.sendResponse(
// 						500,
// 						null,
// 						"getUpcomingEventsForStaff",
// 						null,
// 						null
// 					)
// 				);
// 			}
// 			let sendData = {
// 				ongoingEvent: response.data || null,
// 				upcomingEvents: res,
// 			};
// 			return cb(
// 				null,
// 				responseUtilities.sendResponse(
// 					200,
// 					"All events fetched for staff",
// 					"getUpcomingEventsForStaff",
// 					sendData,
// 					null
// 				)
// 			);
// 		});
// }

// const getOngoingEventsForStaff2 = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}
// 	Events.find(findData)
// 		.populate('venue.country venue.city venue.state')
// 		.sort({ createdAt: -1 })
// 		.exec((err, res) => {
// 			if (err) {
// 				console.error("Unable to get Events: ", err);
// 				return cb(
// 					responseUtilities.sendResponse(
// 						500,
// 						null,
// 						"getUpcomingEventsForStaff",
// 						null,
// 						null
// 					)
// 				);
// 			}
// 			let sendData = {
// 				ongoingEvent: response.data || null,
// 				upcomingEvents: res,
// 			};
// 			return cb(
// 				null,
// 				responseUtilities.sendResponse(
// 					200,
// 					"All events fetched for staff",
// 					"getUpcomingEventsForStaff",
// 					sendData,
// 					null
// 				)
// 			);
// 		});
// }

/**
 * 
 * @param {*} data 
 * @param {*} response 
 * @param {*} cb 
 * @description Get events on basis of chronological order
 */
const getEventsInChronologicalOrder = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	};

	try {
		if (data.user) findData.isActive = true;
		if (data.req && data.req.auth && data.req.auth.role == role.eventadmin) {
			findData.managedBy = mongoose.Types.ObjectId(data.req.auth.id)
		};

		if (data.req && data.req.auth && [role.eventmanager, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {

			let filteredEvents = (data.req.auth.filteredEvents || [])
			filteredEvents = filteredEvents.map((el) => mongoose.Types.ObjectId(el))
			findData._id = { $in: filteredEvents };
			findData.managedBy = mongoose.Types.ObjectId(data.req.auth.eventAdminId)
		};

		let startDate = moment(new Date()).startOf('day');
		startDate = new Date(startDate);
		startDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000); // Convert my server timezone to UTC TimeZone
		console.log("startDate => ", startDate);

		//Ongoing Events
		let matchActiveEvents = {
			...findData,
			// isActive: true,
			expired: false,
			startDate: { $lte: startDate },
			endDate: { $gte: startDate }
		};
		// let ongoingEvents = Events.aggregate([
		// 	{
		// 		"$match": matchActiveEvents
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "countries",
		// 			localField: "venue.country",
		// 			foreignField: "_id",
		// 			as: "venue.country"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.country",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "cities",
		// 			localField: "venue.city",
		// 			foreignField: "_id",
		// 			as: "venue.city"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.city",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "states",
		// 			localField: "venue.state",
		// 			foreignField: "_id",
		// 			as: "venue.state"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.state",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$sort: {
		// 			startDate: 1, createdAt: -1
		// 		}
		// 	}
		// ]);

		
		let ongoingEvents = Events.find(matchActiveEvents)
			.populate('venue.country')
			.populate('venue.state')
			.populate('venue.city')
			.sort({ startDate: 1, createdAt: -1 });
		
		//Past Events
		let matchPastEvents = {
			...findData,
			// isActive: true,
			expired: true,
			endDate: { $lt: startDate }
		};
		if (data.search) {
			matchPastEvents.name = { "$regex": data.search }
		}
		console.log("matchPastEvents => ", matchPastEvents)

		// let pastEvents = Events.aggregate([
		// 	{
		// 		"$match": matchPastEvents
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "countries",
		// 			localField: "venue.country",
		// 			foreignField: "_id",
		// 			as: "venue.country"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.country",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "cities",
		// 			localField: "venue.city",
		// 			foreignField: "_id",
		// 			as: "venue.city"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.city",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "states",
		// 			localField: "venue.state",
		// 			foreignField: "_id",
		// 			as: "venue.state"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.state",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$sort: {
		// 			endDate: -1, createdAt: -1
		// 		}
		// 	}
		// ])

		let pastEvents = Events.find(matchPastEvents)
			.populate('venue.country')
			.populate('venue.state')
			.populate('venue.city')
			.sort({ endDate: -1, createdAt: -1 });

		//Future Events
		let matchFutureEvents = {
			...findData,
			startDate: { $gt: startDate }
		};
		// let futureEvents = Events.aggregate([
		// 	{
		// 		"$match": matchFutureEvents
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "countries",
		// 			localField: "venue.country",
		// 			foreignField: "_id",
		// 			as: "venue.country"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.country",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "cities",
		// 			localField: "venue.city",
		// 			foreignField: "_id",
		// 			as: "venue.city"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.city",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$lookup: {
		// 			from: "states",
		// 			localField: "venue.state",
		// 			foreignField: "_id",
		// 			as: "venue.state"
		// 		}
		// 	},
		// 	{
		// 		$unwind: {
		// 			path: "$venue.state",
		// 			preserveNullAndEmptyArrays: true
		// 		}
		// 	},
		// 	{
		// 		$sort: {
		// 			startDate: 1, createdAt: -1
		// 		}
		// 	}
		// ]);
		console.log("matchFutureEvents => ", matchFutureEvents)

		let futureEvents = Events.find(matchFutureEvents)
			.populate('venue.country')
			.populate('venue.state')
			.populate('venue.city')
			.sort({ startDate: 1, createdAt: -1 });

		Promise.all([
			ongoingEvents,
			pastEvents,
			futureEvents
		])
			.then(async (res) => {
				let allOngoingEvents = JSON.parse(JSON.stringify(res[0]));
				allOngoingEvents = allOngoingEvents.map(e => {
					return { ...e, status: "ONGOING" };
				});

				let pastEvents = JSON.parse(JSON.stringify(res[1]));
				pastEvents = pastEvents.map(e => {
					return { ...e, status: "PAST" };
				});

				let futureEvents = JSON.parse(JSON.stringify(res[2]));
				futureEvents = futureEvents.map(e => {
					return { ...e, status: "UPCOMING" };
				});

				if (data.req && data.req.auth && data.req.auth.role == role.user) {
					console.log("Here....")
					for (let i = 0; i < res[0].length; i++) {
						let findData = {
							eventId: res[0][i]._id,
							userId: data.req.auth.id || null,
							interestType: "INTERESTED"
						};
						let checkIfShownAnyInterest = await EventInterests.findOne(findData);
						if (checkIfShownAnyInterest) { allOngoingEvents[i].isInterested = true }
						else { allOngoingEvents[i].isInterested = false; }

					};

					for (let i = 0; i < res[1].length; i++) {
						let findData = {
							eventId: res[1][i]._id,
							userId: data.req.auth.id || null,
							interestType: "INTERESTED"

						};
						let checkIfShownAnyInterest = await EventInterests.findOne(findData);
						if (checkIfShownAnyInterest) { pastEvents[i].isInterested = true }
						else { pastEvents[i].isInterested = false; }

					}

					for (let i = 0; i < res[2].length; i++) {
						let findData = {
							eventId: res[2][i]._id,
							userId: data.req.auth.id || null,
							interestType: "INTERESTED"

						};
						let checkIfShownAnyInterest = await EventInterests.findOne(findData);
						if (checkIfShownAnyInterest) { futureEvents[i].isInterested = true }
						else { futureEvents[i].isInterested = false; }

					}
				};
				let DTS = {
					ongoingEvents: allOngoingEvents,
					pastEvents: pastEvents,
					futureEvents: futureEvents
				};
				// console.log("DTS => ", DTS);
				return cb(null, responseUtilities.sendResponse(200, "Events in categorical order fetched", "getEventsInChronologicalOrder", DTS, null));
			})
			.catch(err => {
				return cb(responseUtilities.sendResponse(400, "Events cannot be fetched", "getEventsInChronologicalOrder", null, null));
			});
	} catch (err) {
		return cb(responseUtilities.sendResponse(400, "Events in categorical order not fetched", "getEventsInChronologicalOrder", null, null));
	}
};
exports.getEventsInChronologicalOrder = getEventsInChronologicalOrder;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Event Controller
 */
exports.getEventForDeafultDropDownSelect = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventsInChronologicalOrder, data));
	waterfallFunctions.push(async.apply(getDefaultEvent, data));
	async.waterfall(waterfallFunctions, cb);
};

const getDefaultEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!response || !response.data) {
		return cb(null, responseUtilities.sendResponse(200, "Events fetched", "getEventsInChronologicalOrder", {}, null));
	}

	let eventToSend = {};

	let ongoingEvents = response.data.ongoingEvents || [];
	let upcomingEvents = response.data.futureEvents || [];

	if (ongoingEvents.length) {
		eventToSend = ongoingEvents[0];
	} else if (upcomingEvents.length) {
		eventToSend = upcomingEvents[0];
	}
	return cb(null, responseUtilities.sendResponse(200, "Event fetched", "getEventForDeafultDropDownSelect", eventToSend, null));
};

/**
 * 
 * @param {*} data 
 * @param {*} response 
 * @param {*} cb 
 * @description Get Attendeess Stats
 */
exports.getTotalAttendeesStats = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {};

	if (data.req && data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = mongoose.Types.ObjectId(data.req.auth.id)
	};

	if (data.req && data.req.auth && [role.eventmanager, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {

		let filteredEvents = (data.req.auth.filteredEvents || [])
		filteredEvents = filteredEvents.map((el) => mongoose.Types.ObjectId(el))
		findData.eventId = { $in: filteredEvents };
		findData.eventAdminId = mongoose.Types.ObjectId(data.req.auth.eventAdminId)
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	//Speakers
	let matchSpeakers = { ...findData, isDeleted: false, status: "ASSIGNED" };
	console.log("matchSpeakers => ", matchSpeakers)
	let speakers = Speakers.countDocuments(matchSpeakers)

	let matchSpeakersRequest = { ...findData, joinAs: "SPEAKER", status: "PENDING" };
	console.log("matchSpeakersRequest => ", matchSpeakersRequest)
	let speakersRequests = Requests.countDocuments(matchSpeakersRequest)
	let underReviewSpeakers = Speakers.countDocuments({ ...findData, isDeleted: false, status: "UNDER_REVIEW" });

	//Sponsors
	let matchSponsors = { ...findData, isDeleted: false, status: "ASSIGNED" }; //Onboardeded
	console.log("matchSponsors => ", matchSponsors)
	let sponsors = Sponsors.countDocuments(matchSponsors);
	let underReviewSponsors = Sponsors.countDocuments({ ...findData, isDeleted: false, status: "UNDER_REVIEW" }); //Applied 

	let matchSponsorsRequest = { ...findData, joinAs: "SPONSOR", status: "PENDING" };
	console.log("matchSponsorsRequest => ", matchSponsorsRequest)
	let sponsorRequests = Requests.countDocuments(matchSponsorsRequest)

	//Exhibitors
	let matchExhibitor = { ...findData, isDeleted: false, status: "ASSIGNED" };
	console.log("matchExhibitor => ", matchExhibitor)
	let exhibitors = Exhibitors.countDocuments(matchExhibitor);
	let underReviewExhibitors = Exhibitors.countDocuments({ ...findData, isDeleted: false, status: "UNDER_REVIEW" });

	let matchExhibitorRequest = { ...findData, joinAs: "EXHIBITOR", status: "PENDING" };
	console.log("matchExhibitorRequest => ", matchExhibitorRequest)
	let exhibitorsRequests = Requests.countDocuments(matchExhibitorRequest)

	//Media
	let matchMediaPartners = { ...findData, isDeleted: false, status: "ASSIGNED" };
	console.log("matchMediaPartners => ", matchMediaPartners)
	let medias = Medias.countDocuments(matchMediaPartners)
	let underReviewMedias = Medias.countDocuments({ ...findData, isDeleted: false, status: "UNDER_REVIEW" });

	let matchMediaPartnersRequest = { ...findData, joinAs: "MEDIA_PARTNER", status: "PENDING" };
	console.log("matchMediaPartnersRequest => ", matchMediaPartnersRequest)
	let mediaPartnersRequests = Requests.countDocuments(matchMediaPartnersRequest)

	//Visitors
	let matchVisitors = { ...findData, isDeleted: false, isBlocked: false, isPackagePurchased: true };
	console.log("matchVisitors => ", matchVisitors)
	let visitors = Visitors.countDocuments(matchVisitors)

	Promise.all([
		speakers,
		sponsors,
		exhibitors,
		medias,
		visitors,

		speakersRequests,
		sponsorRequests,
		exhibitorsRequests,
		mediaPartnersRequests,

		underReviewSpeakers,
		underReviewSponsors,
		underReviewExhibitors,
		underReviewMedias
	])
		.then((res) => {
			// console.log("Res => ", res)
			let totalAttendeessCount = res[0] + res[1] + res[2] + res[3] + res[4];

			let DTS = {
				totalAttendeessCount: totalAttendeessCount,

				speakers: res[0],
				sponsors: res[1],
				exhibitors: res[2],
				medias: res[3],
				visitors: res[4],
				speakersRequests: res[5] + res[9],
				sponsorRequests: res[6] + res[10],
				exhibitorsRequests: res[7] + res[11],
				mediaPartnersRequests: res[8] + res[12]
			}
			// let totalCount = res.reduce((sum, count) => {
			// 	return sum + count
			// }, sum)
			return cb(null, responseUtilities.sendResponse(200, "getTotalAttendeesStats", "getTotalAttendeesStats", DTS, null));
		});
};


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting event entity(speakers/medias/sponsors/exhibitors/packages/agenda) count
 */
const getEventEntityStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	let findData = {};

	//Get events Data of your agency only.
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	//Event Specific Data
	if (data.eventId) {
		findData.eventId = data.eventId
	};


	let allPromises = [];
	let speakerCount = Speakers.countDocuments({ ...findData, isBlocked: false, isDeleted: false, status: "ASSIGNED" });
	let sponsorCount = Sponsors.countDocuments({ ...findData, isBlocked: false, isDeleted: false, status: "ASSIGNED" });
	let mediaCount = Medias.countDocuments({ ...findData, isBlocked: false, isDeleted: false, status: "ASSIGNED" });
	let exhibitorCount = Exhibitors.countDocuments({ ...findData, isBlocked: false, isDeleted: false, status: "ASSIGNED" });
	let agendaCount = Agendas.countDocuments({ ...findData, isDeleted: false });
	let sponsorPackageCount = Packages.countDocuments({ ...findData, type: "Sponsor", isActive: true, isDeleted: false });
	let exhibitorPackageCount = Packages.countDocuments({ ...findData, type: "Exhibitor", isActive: true, isDeleted: false });
	let visitorsPackageCount = Packages.countDocuments({ ...findData, type: "Visitor", isActive: true, isDeleted: false });
	let visitorsCount = Visitors.countDocuments({ ...findData, isDeleted: false, status: "Approved", $or: [{source:"ADMIN_PANEL"},{source:"APP",isPackagePurchased:true}] });

	allPromises = [
		speakerCount,
		sponsorCount,
		mediaCount,
		exhibitorCount,
		agendaCount,
		sponsorPackageCount,
		exhibitorPackageCount,
		visitorsPackageCount,
		visitorsCount
	]

	Promise.all(allPromises).then((res) => {
		console.log("Res", res);

		let sendData = {
			speakers: res[0] || 0,
			sponsors: res[1] || 0,
			medias: res[2] || 0,
			exhibitors: res[3] || 0,
			agendas: res[4] || 0,
			sponsorPackages: res[5] || 0,
			exhibitorPackages: res[6] || 0,
			visitorsPackages: res[7] || 0,
			visitorsCount: res[8] || 0
		}

		return cb(null, responseUtilities.sendResponse(200, "Event enitity status fetched", "getEventEntityStatus", sendData, data.req.signature));
	})
		.catch((err) => {
			console.log("Err", err);
			return cb(
				responseUtilities.sendResponse(400, "Unable to get event entity", "getEventEntityStatus", err, null)
			);
		})
}
exports.getEventEntityStatus = getEventEntityStatus;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Checks If  Exhibitor Already Exist For Event
 */
const checkIfInvalidEvent = async function (data, response, cb) {

	if (!cb) {
		cb = response;
	};

	let findEvent = {
		_id: data.eventId,
		isDeleted: false
	};

	if (data.req.auth.role == role.eventadmin || data.req.auth.role == role.eventmanager) {
		findEvent.managedBy = data.req.auth.eventAdminId || data.req.auth.id
	};

	console.log("FindEvent => ", findEvent);

	let event = await Events.findOne(findEvent);

	if (!event) {
		return cb(responseUtilities.sendResponse(400, `Event not found`, "checkIfInvalidEvent", null, data.req.signature));

	} else if (event.expired) {
		return cb(responseUtilities.sendResponse(400, "Event expired!", "checkIfInvalidEvent", null, data.req.signature));

	} else if (data.req.auth.role == "user" && !event.isActive) {
		return cb(responseUtilities.sendResponse(400, `Inactive event`, "checkIfInvalidEvent", null, data.req.signature));

	} else if (data.createPendingRequest) { //Can add to inactive events too

		let joinAs = data.joinAs;
		let requestsAllowed = event.requestsAllowed;
		console.log("Allowed Entites Requests => ", requestsAllowed);

		if (!requestsAllowed[joinAs]) {
			console.log("Not Allowed in this event....", requestsAllowed);
			return cb(responseUtilities.sendResponse(400, `${data.joinAs} are not allowed for this event currently.`, "checkIfInvalidEvent", null, data.req.signature));

		} else {
			data.eventDetails = event;
			return cb(null, responseUtilities.sendResponse(200, "Valid", "checkIfInvalidEvent", null, data.req.signature));
		}

	} else {
		data.eventDetails = event;
		data.eventAdminId = event.managedBy;
		return cb(null, responseUtilities.sendResponse(200, "Valid", "checkIfInvalidEvent", null, data.req.signature));
	}
}
exports.checkIfInvalidEvent = checkIfInvalidEvent;

