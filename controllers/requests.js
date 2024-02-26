const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

const path = require("path");
const _ = require("lodash");

//helper
const responseUtilities = require("../helpers/sendResponse");

//models
const Requests = require("../models/requests");
const Events = require("../models/events");
const Medias = require("../models/medias");
const Sponsors = require("../models/sponsors");
const Exhibitors = require("../models/exhibitors");
const Speakers = require("../models/speakers");
const Packages = require("../models/packages");
const Countries = require("../models/countries");
const notifications = require("../models/notifications");
const Visitors = require("../models/visitors");

const role = JSON.parse(process.env.role);
const notify = require("../helpers/notification");

//controllers
const events = require("../controllers/events");
const speakers = require("../controllers/speakers");
// const sponsors = require("../controllers/sponsors");
const medias = require("../controllers/medias");
const { checkIfSpeakerAlreadyExistForEvent, updateSpeaker } = require("../controllers/speakers");
const { checkIfSponsorAlreadyExistForEvent, updateSponsor } = require("../controllers/sponsors");
const { checkIfMediaPartnerAlreadyExistForEvent, updateMedia } = require("../controllers/medias");
const { checkIfExhibitorAlreadyExistForEvent, updateExhibitor } = require("../controllers/exhibitors");
const { checkIfInvalidEvent } = require("../controllers/events");

const { updateVisitor } = require("../controllers/visitors");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding speaker Requests
 */
const applyAsSpeaker = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Please select event", "applyAsSpeaker", null, data.req.signature));
	};

	if (!data.email || !data.businessEmail) {
		return cb(responseUtilities.sendResponse(400, "Please provide email", "applyAsSpeaker", null, data.req.signature));
	};

	if (!JSON.stringify(data.isApplyingForSelf)) {
		return cb(responseUtilities.sendResponse(400, "Please specify if applying for self or other", "applyAsSpeaker", null, data.req.signature));
	}
	if (!data.profilePicture || !data.title || !data.name || !data.about || !data.country || !data.interestTopics || !data.interestTopics.length) {
		return cb(responseUtilities.sendResponse(400, "1. Please provide complete details", "applyAsSpeaker", null, data.req.signature));
	}
	if (!data.designation || !data.organization || !data.orgWebsite || !data.businessSector) {
		return cb(responseUtilities.sendResponse(400, "2. Please provide complete details", "applyAsSpeaker", null, data.req.signature));
	}

	if (!data.linkedin || !data.twitter) {
		return cb(responseUtilities.sendResponse(400, "3. Please provide complete social details", "applyAsSpeaker", null, data.req.signature));
	}

	data.email = data.email.toLowerCase();
	data.businessEmail = data.businessEmail.toLowerCase();
	data.joinAs = 'SPEAKER';
	data.joinRequest = "Speaker";
	let waterfallFunctions = [];
	let insertRequestData = {};
	if (data.designation) {
		insertRequestData.designation = data.designation
	}
	if (data.businessSector) {
		insertRequestData.businessSector = data.businessSector
	}
	if (data.profilePicture) {
		insertRequestData.profilePicture = data.profilePicture
	}
	if (data.organization) {
		insertRequestData.organization = data.organization
	}
	if (data.orgWebsite) {
		insertRequestData.orgWebsite = data.orgWebsite
	}
	if (data.about) {
		insertRequestData.about = data.about
	}
	if (data.interestTopics) {
		insertRequestData.interestTopics = data.interestTopics
	}
	if (data.mobile) {
		insertRequestData.mobile = data.mobile
	}
	if (data.whatsAppMobile) {
		insertRequestData.whatsAppMobile = data.whatsAppMobile
	}
	if (data.linkedin) {
		insertRequestData.linkedin = data.linkedin
	}
	if (data.twitter) {
		insertRequestData.twitter = data.twitter
	}
	if (data.telegram) {
		insertRequestData.telegram = data.telegram
	};
	if (data.title) {
		insertRequestData.title = data.title
	};

	if (data.mobileCode) {
		insertRequestData.mobileCode = data.mobileCode
	}
	if (data.phoneCode) {
		insertRequestData.phoneCode = data.phoneCode
	}
	if (data.whatsAppMobileCode) {
		insertRequestData.whatsAppMobileCode = data.whatsAppMobileCode
	}
	if (data.country) {
		insertRequestData.country = data.country
	}
	if (data.attachedDocuments) {
		insertRequestData.attachedDocuments = data.attachedDocuments
	}
	data.insertRequestData = insertRequestData

	let ifSpeakerExists = await Speakers.findOne({ email: data.email, eventId: data.eventId });
	if (ifSpeakerExists) {
		return cb(responseUtilities.sendResponse(400, "Speaker already exist with this email.", "applyAsSpeaker", null, data.req.signature));
	};
	// console.log("Speaker Request Data => ", data);
	// console.log("InsertData => ", data.insertRequestData)
	waterfallFunctions.push(async.apply(createJoinRequest, data));
	async.waterfall(waterfallFunctions, cb);

}
exports.applyAsSpeaker = applyAsSpeaker;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding Media Requests
 */
const applyAsMedia = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Please select event", "applyAsMedia", null, data.req.signature));
	}

	if (!data.logo || !data.mediaHouse || !data.website) {
		return cb(responseUtilities.sendResponse(400, "1. Please provide complete details", "applyAsMedia", null, data.req.signature));
	}
	if (!data.title || !data.contactPerson || !data.email || !data.designation || !data.businessEmail) {
		return cb(responseUtilities.sendResponse(400, "2. Please provide complete personal details", "applyAsMedia", null, data.req.signature));
	}
	if (!data.linkedin || !data.twitter) {
		return cb(responseUtilities.sendResponse(400, "3. Please provide complete social details", "applyAsSpeaker", null, data.req.signature));
	}

	data.joinAs = 'MEDIA_PARTNER';
	data.joinRequest = "Media Partner";


	let insertRequestData = {};
	if (data.contactPerson) {
		insertRequestData.contactPerson = data.contactPerson
	}
	if (data.mediaHouse) {
		insertRequestData.mediaHouse = data.mediaHouse
	}
	if (data.logo) {
		insertRequestData.logo = data.logo
	}
	if (data.mobile) {
		insertRequestData.mobile = data.mobile
	}
	if (data.whatsAppMobile) {
		insertRequestData.whatsAppMobile = data.whatsAppMobile
	}
	if (data.mobileCode) {
		insertRequestData.mobileCode = data.mobileCode
	}
	if (data.whatsAppMobileCode) {
		insertRequestData.whatsAppMobileCode = data.whatsAppMobileCode
	}
	if (data.website) {
		insertRequestData.website = data.website
	}

	if (data.title) {
		insertRequestData.title = data.title
	};
	if (data.designation) {
		insertRequestData.designation = data.designation
	}
	if (data.telegram) {
		insertRequestData.telegram = data.telegram
	}
	if (data.linkedin) {
		insertRequestData.linkedin = data.linkedin
	}
	if (data.twitter) {
		insertRequestData.twitter = data.twitter
	}
	data.insertRequestData = insertRequestData


	let ifMediaExists = await Medias.findOne({ email: data.email, eventId: data.eventId });
	if (ifMediaExists) {
		return cb(responseUtilities.sendResponse(400, "Media email already exist for this event.", "applyAsMedia", null, data.req.signature));
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(createJoinRequest, data));
	async.waterfall(waterfallFunctions, cb);

}
exports.applyAsMedia = applyAsMedia;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding sponsor requests
 */
const applyAsSponsor = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId || !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Please select package", "applyAsSponsor", null, data.req.signature));
	}

	if (!data.logo || !data.businessSector || !data.company || !data.website || !data.companyDescription || !data.country || !data.goal) {
		return cb(responseUtilities.sendResponse(400, "1. Please provide complete details", "applyAsSponsor", null, data.req.signature));
	}
	if (!data.email || !data.title || !data.name || !data.designation || !data.businessEmail) {
		return cb(responseUtilities.sendResponse(400, "2. Please provide complete details", "applyAsSponsor", null, data.req.signature));
	}
	if (!data.linkedin || !data.twitter) {
		return cb(responseUtilities.sendResponse(400, "3. Please provide complete details", "applyAsSponsor", null, data.req.signature));
	}

	data.joinAs = 'SPONSOR';
	data.joinRequest = "Sponsor";

	let insertRequestData = {};
	if (data.goal) {
		insertRequestData.goal = data.goal
	}
	if (data.businessSector) {
		insertRequestData.businessSector = data.businessSector
	}
	if (data.title) {
		insertRequestData.title = data.title
	}
	if (data.designation) {
		insertRequestData.designation = data.designation
	}
	if (data.company) {
		insertRequestData.company = data.company
	}
	if (data.phone) {
		insertRequestData.phone = data.phone
	}
	if (data.whatsAppMobile) {
		insertRequestData.whatsAppMobile = data.whatsAppMobile
	}
	if (data.phoneCode) {
		insertRequestData.phoneCode = data.phoneCode
	}
	if (data.whatsAppMobileCode) {
		insertRequestData.whatsAppMobileCode = data.whatsAppMobileCode
	}
	if (data.country) {
		insertRequestData.country = data.country
	}
	if (data.website) {
		insertRequestData.website = data.website
	}
	if (data.logo) {
		insertRequestData.logo = data.logo
	}
	if (data.companyDescription) {
		insertRequestData.companyDescription = data.companyDescription
	}
	if (data.linkedin) {
		insertRequestData.linkedin = data.linkedin
	}
	if (data.telegram) {
		insertRequestData.telegram = data.telegram
	}
	if (data.twitter) {
		insertRequestData.twitter = data.twitter
	}
	data.insertRequestData = insertRequestData


	let ifSponsorExists = await Sponsors.findOne({ email: data.email, eventId: data.eventId });
	if (ifSponsorExists) {
		return cb(responseUtilities.sendResponse(400, "Sponsor email already exist for this event.", "applyAsSponsor", null, data.req.signature));
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getSponsorPackageCount, data));
	waterfallFunctions.push(async.apply(createJoinRequest, data));
	async.waterfall(waterfallFunctions, cb);
}
exports.applyAsSponsor = applyAsSponsor;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding exhibitor requests
 */
const applyAsExhibitor = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Please select package", "applyAsSponsor", null, data.req.signature));
	}

	if (!data.packageId) {
		return cb(responseUtilities.sendResponse(400, "Please select package", "applyAsSponsor", null, data.req.signature));
	}

	if (!data.logo || !data.businessSector || !data.company || !data.website || !data.companyDescription || !data.country || !data.goal) {
		return cb(responseUtilities.sendResponse(400, "1. Please provide complete details", "applyAsSponsor", null, data.req.signature));
	}
	if (!data.email || !data.title || !data.name || !data.designation || !data.businessEmail) {
		return cb(responseUtilities.sendResponse(400, "2. Please provide complete details", "applyAsSponsor", null, data.req.signature));
	}
	if (!data.linkedin || !data.twitter) {
		return cb(responseUtilities.sendResponse(400, "3. Please provide complete details", "applyAsSponsor", null, data.req.signature));
	}

	data.joinAs = 'EXHIBITOR';
	data.joinRequest = "Exhibitor";
	let insertRequestData = {};
	if (data.goal) {
		insertRequestData.goal = data.goal
	}
	if (data.businessSector) {
		insertRequestData.businessSector = data.businessSector
	}
	if (data.title) {
		insertRequestData.title = data.title
	}
	if (data.designation) {
		insertRequestData.designation = data.designation
	}
	if (data.companyDescription) {
		insertRequestData.companyDescription = data.companyDescription
	}

	if (data.company) {
		insertRequestData.company = data.company
	}
	if (data.phone) {
		insertRequestData.phone = data.phone
	}
	if (data.whatsAppMobile) {
		insertRequestData.whatsAppMobile = data.whatsAppMobile
	}
	if (data.phoneCode) {
		insertRequestData.phoneCode = data.phoneCode
	}
	if (data.whatsAppMobileCode) {
		insertRequestData.whatsAppMobileCode = data.whatsAppMobileCode
	}
	if (data.country) {
		insertRequestData.country = data.country
	}
	if (data.website) {
		insertRequestData.website = data.website
	}
	if (data.logo) {
		insertRequestData.logo = data.logo
	};
	if (data.linkedin) {
		insertRequestData.linkedin = data.linkedin
	}
	if (data.telegram) {
		insertRequestData.telegram = data.telegram
	}
	if (data.twitter) {
		insertRequestData.twitter = data.twitter
	}
	data.insertRequestData = insertRequestData;

	let ifExhibitorExists = await Exhibitors.findOne({ email: data.email, eventId: data.eventId });
	if (ifExhibitorExists) {
		return cb(responseUtilities.sendResponse(400, "Exhibitor email already exist for this event.", "applyAsSponsor", null, data.req.signature));
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getExhibitorPackageCount, data));
	waterfallFunctions.push(async.apply(createJoinRequest, data));
	async.waterfall(waterfallFunctions, cb);
}
exports.applyAsExhibitor = applyAsExhibitor;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Already Applied As Entity
 */
const checkIfAlreadyAppliedAsEntity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	console.log("dataaaa ", data);

	let findData = {
		joinAs: data.joinAs,
		userId: data.req.auth.id,
		eventId: data.eventId,
		email: data.email,
		status: { $ne: "REJECTED" }
	};

	Requests.findOne(findData, (err, res) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkIfAlreadyAppliedAsEntity", null, null));
		}
		if (res) {
			return cb(responseUtilities.sendResponse(400, "Oops! you have already made the request", "checkIfAlreadyAppliedAsEntity", null, data.req.signature));
		}
		return cb(null, responseUtilities.sendResponse(200, "Proceed", "checkIfAlreadyAppliedAsEntity", null, data.req.signature));
	});
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding requests
 */
const createJoinRequest = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.joinAs || !data.email) {
		return cb(responseUtilities.sendResponse(400, "Msiing Params", "createJoinRequest", null, data.req.signature));
	};

	data.createPendingRequest = true;

	let waterfallFunctions = [];
	if (data.eventId) {
		waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	};
	if (data.packageId) {
		waterfallFunctions.push(async.apply(findPackage, data));
	}

	waterfallFunctions.push(async.apply(checkIfAlreadyAppliedAsEntity, data)); //Check if that user has already applied
	waterfallFunctions.push(async.apply(checkIfRequestExist, data)); //Check Email Availbility for that event as that entity.
	waterfallFunctions.push(async.apply(createRequest, data));

	waterfallFunctions.push(async.apply(sendNotificationAfterApplyEvent, data));

	async.waterfall(waterfallFunctions, cb);
};
exports.createJoinRequest = createJoinRequest;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Send notification after applying event
 */
const sendNotificationAfterApplyEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.joinAs && !data.email && !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "sendNotificationAfterApplyEvent", null, data.req.signature));
	};

	let findData = {
		joinAs: data.joinAs,
		email: data.email,
		eventId: data.eventId,
		status: { $in: ["UNDER_REVIEW", "PENDING"] }
	}
	
	Requests.findOne(findData).populate('eventAdminId eventId userId')
		.exec((err, resR)  => {
		if (err) {
			console.error("Unable to find Request", err);
			return cb(responseUtilities.sendResponse(500, null, "sendNotificationAfterApplyEvent", null, null));
		}
		if (resR && resR.eventAdminId  && resR.userId && resR.userId.deviceInfo[0] && resR.eventId) {
			let titleData = "Application being reviewed!";
			let messageData = `Heads up! Your application for ${resR.eventId.name} is being reviewed. Stay tuned.`;
			let insertNotification = {
				alertType: "PUSH_NOTIFICATION",
				targetUser : "ALL_USERS",
				message: messageData,
				title: titleData,
				createdBy:  resR.userId._id,
				userId: resR.userId._id,
				eventAdminId:  resR.eventAdminId._id,
			}
			notifications.create(insertNotification, (errN, resN) => {
				if (errN) {
					console.log('Error', errN);
				}
				console.log(resN)
				if(resN){
					let deviceTokens = resR.userId.deviceInfo;
	
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
							console.log("Ticket purchase notification resp====", notifRes);
							if (notifRes.success) {
								console.log("Ticket purchase notification sent");		
								
								notifications.findOneAndUpdate({ _id: resN._id },{ isSent: true }, (err, response) => {
									if (err) {
										console.error("Unable to update notification: ", err);
									}
									console.log("Success, Notification updated successfully", response)
								});
							}
						}
					});
						
				}
			});
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				null,
				"sendNotificationAfterApplyEvent",
				null,
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
 * @description Contoller for checking if request already exists
 */
const checkIfRequestExist = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		joinAs: data.joinAs,
		email: data.email,
		eventId: data.eventId,
		status: { $in: ["UNDER_REVIEW", "PENDING"] }
	}

	if (data.packageId) {
		findData.packageId = data.packageId
	}

	console.log("Finding existing request =>", findData)
	Requests.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get request: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "checkIfRequestExist", null, null)
				);
			};

			if (res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Request already exist",
						"checkIfRequestExist",
						null,
						data.req.signature
					)
				);
			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"Creating Request",
						"checkIfRequestExist",
						response.data,
						null
					)
				);
			}
		});
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding requests data
 */
const createRequest = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let insertData = {
		joinAs: data.joinAs,
		name: data.name,
		email: data.email
	}

	console.log("Response.data", response.data)
	if (data.eventId) {
		insertData.eventId = data.eventId;
		insertData.eventAdminId = data.eventDetails.managedBy;
	}

	if (data.packageId) {
		insertData.packageId = data.packageId
	}

	if (JSON.stringify(data.isApplyingForSelf)) {
		insertData.isApplyingForSelf = data.isApplyingForSelf
	}
	if (data.insertRequestData) {
		insertData.joiningDetails = data.insertRequestData
	};

	if (data.req.auth && data.req.auth.id) {
		insertData.userId = data.req.auth.id
	}
	if (data.country) {
		insertData.country = data.country
	}

	if (data.appRequest) {
		insertData.appRequest = data.appRequest
	};
	if(data.businessEmail){
		insertData.businessEmail = data.businessEmail
	}

	console.log("Pending request create data => ", insertData)
	Requests.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create Request: ", err);
			return cb(responseUtilities.sendResponse(500, null, "createRequest", null, null));
		}
		let sendData = null;
		if (response.data) {
			sendData = response.data
		};
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Request Created",
				"createRequest",
				null,
				data.req.signature
			)
		);
	});
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Find Package by id
 */
const findPackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		_id: data.packageId
	}

	let assignedPackageCount = data.assignedPackageCount || 0;
	Packages.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to find package: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "findPackage", null, null)
			);
		}
		if (response.data) {
			response.data.packageRes = res
		};

		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Package not found",
					"findPackage",
					null,
					data.req.signature
				)
			);
		}
		if (!res.isActive) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Package Not Active",
					"findPackage",
					null,
					data.req.signature
				)
			);
		};

		if (data.joinRequest && data.joinRequest != res.type) {
			return cb(responseUtilities.sendResponse(400, `Package not valid for ${data.joinRequest}`, "findPackage", null, data.req.signature));
		}
		console.log("package function res ", res);
		if((res.type == "Sponsor" || res.type == "Exhibitor") && (res?.isSoldOut == true)){
			return cb(
				responseUtilities.sendResponse(
					400,
					"Package sold out",
					"findPackage",
					null,
					data.req.signature
				)
			);
		}else{
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Package quantity available",
					"findPackage",
					response.data,
					data.req.signature
				)
			);
		}
		// let quantity = res.quantity
		// if (quantity && quantity > assignedPackageCount) {
		// 	return cb(
		// 		null,
		// 		responseUtilities.sendResponse(
		// 			200,
		// 			"Package quantity enough",
		// 			"findPackage",
		// 			response.data,
		// 			data.req.signature
		// 		)
		// 	);
		// } else {
		// 	return cb(
		// 		responseUtilities.sendResponse(
		// 			400,
		// 			"Package Quantity Exceeded",
		// 			"findPackage",
		// 			null,
		// 			data.req.signature
		// 		)
		// 	);
		// }
	});
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all requests
 */
exports.getAllJoiningRequestsForAdmin = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		status: "PENDING"
	};

	if (data.status) {
		findData.status = data.status
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	} else if (data.req.auth.role == role.eventmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
		findData.eventId = { "$in": data.req.auth.filteredEvents }
	}

	if (data.joinAs) {
		findData.joinAs = data.joinAs
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}
	// console.log("find data for rquest=================", findData)
	Requests.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for Requests: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllJoiningRequestsForAdmin",
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
		// if (!data.currentPage) {
		// 	data.currentPage = Math.ceil(count / limit);
		// }

		if (data.currentPage) {
			skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
		}
		Requests.find(findData)
			.populate("eventId packageId country")
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get Requests: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllJoiningRequestsForAdmin",
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
						"All Requests fetched for admin",
						"getAllJoiningRequestsForAdmin",
						sendData,
						null
					)
				);
			});
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update requests status
 */
exports.updateRequestStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.status || !data.requestId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"updateRequestStatus",
				null,
				data.req.signature
			)
		);
	}
	console.log("Status and requestId =>", data.status, data.requestId)
	if (data.status == "APPROVED") {
		data.status = "UNDER_REVIEW"
	}
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(events.findAdminEvents, data));
	waterfallFunctions.push(async.apply(findRequest, data));
	if (data.status == "UNDER_REVIEW") {
		waterfallFunctions.push(async.apply(checkEmailAvailibiltyForAddingEntity, data));
	};
	waterfallFunctions.push(async.apply(updateRequest, data));
	if (data.status == "UNDER_REVIEW") {
		waterfallFunctions.push(async.apply(updateCorrespondingRequest, data));
	}
	async.waterfall(waterfallFunctions, cb);
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for find request
 */
const findRequest = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.requestId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"findRequest",
				null,
				data.req.signature
			)
		);
	}
	let adminEventIds = response.data
	let findData = {
		_id: data.requestId,
		// eventId: { $in: adminEventIds }
	};

	data.adminEventIds = adminEventIds;
	console.log("event ids for the admin", response.data)
	Requests.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Request: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "findRequest", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Request not found",
					"findRequest",
					null,
					data.req.signature
				)
			);
		}
		if (res && (res.status == "UNDER_REVIEW" || res.status == "REJECTED")) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Already approved or rejected",
					"findRequest",
					null,
					data.req.signature
				)
			);
		};
		data.joinAs = res.joinAs;
		data.requestData = res;
		console.log("Request Fetched => ", data.requestData)
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Request Found",
				"findRequest",
				res,
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
 * @description Contoller for update request status
 */
const updateRequest = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.requestId || !data.status) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"updateRequest",
				null,
				data.req.signature
			)
		);
	}
	let adminEventIds = data.adminEventIds
	let findData = {
		_id: data.requestId,
		// eventId: { $in: adminEventIds }
	};

	let updateData = {
		status: data.status || "UNDER_REVIEW"
	};

	let options = {
		new: true
	};

	let updateLogs = {
		action: data.status,
		performedBy: data.req.auth.id
	}
	updateData["$addToSet"] = {
		logs: updateLogs
	}

	Requests.findOneAndUpdate(findData, updateData, options, (err, res) => {
		if (err) {
			console.error("Unable to update Request: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateRequest", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					404,
					"Request not found",
					"updateRequest",
					null,
					data.req.signature
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Request updated",
				"updateRequest",
				res,
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
 * @description Contoller for checkEmailAvailibiltyForAddingEntity
 */
const checkEmailAvailibiltyForAddingEntity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = data.requestData;
	if (!requestData) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Request not found",
				"updateCorrespondingRequest",
				null,
				data.req.signature
			)
		);
	}

	data.requestData = requestData;
	data.eventIds = [requestData.eventId];
	data.email = requestData.email;

	let waterfallFunctions = [];

	if (requestData.joinAs == "SPEAKER") {
		waterfallFunctions.push(async.apply(checkIfSpeakerAlreadyExistForEvent, data));
	} else if (requestData.joinAs == "SPONSOR") {
		waterfallFunctions.push(async.apply(checkIfSponsorAlreadyExistForEvent, data));
	} else if (requestData.joinAs == "MEDIA_PARTNER") {
		waterfallFunctions.push(async.apply(checkIfMediaPartnerAlreadyExistForEvent, data));
	} else if (requestData.joinAs == "EXHIBITOR") {
		waterfallFunctions.push(async.apply(checkIfExhibitorAlreadyExistForEvent, data));
	} else {
		//invalid request
		return cb(responseUtilities.sendResponse(400, "Invalid Request", "updateCorrespondingRequest", null, data.req.signature));
	}
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding entitties if request gets approved speaker/sponsor
 */
const updateCorrespondingRequest = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = response.data
	if (!requestData) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Request not found",
				"updateCorrespondingRequest",
				null,
				data.req.signature
			)
		);
	}

	data.requestData = requestData;
	data.eventIds = [requestData.eventId];

	let waterfallFunctions = [];

	if (requestData.joinAs == "SPEAKER") {
		waterfallFunctions.push(async.apply(addSpeaker, data));

	} else if (requestData.joinAs == "SPONSOR") {
		waterfallFunctions.push(async.apply(addSponsor, data));

	} else if (requestData.joinAs == "MEDIA_PARTNER") {
		waterfallFunctions.push(async.apply(addMediaPartner, data));
	} else if (requestData.joinAs == "EXHIBITOR") {
		waterfallFunctions.push(async.apply(addExhibitor, data));
	} else {
		//invalid request
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid Request",
				"updateCorrespondingRequest",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding speaker after approving request
 */
const addSpeaker = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = data.requestData;
	console.log("request data => ", requestData)

	let findData = {
		email: requestData.email
	}

	let insertData = {};
	insertData.name = requestData.name
	insertData.eventId = requestData.eventId;
	insertData.eventAdminId = requestData.eventAdminId;
	insertData.country = requestData.country;
	insertData.status = "UNDER_REVIEW";

	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
	// 	insertData.eventAdminId = data.req.auth.id
	// }
	// if (data.req.auth.role == role.eventmanager) {
	// 	insertData.eventAdminId = data.req.auth.eventAdminId
	// }

	let options = {
		upsert: false,
		new: true,
		setDefaultsOnInsert: true,
	}

	if (requestData.userId) {
		insertData.userId = requestData.userId
	}
	if (requestData.businessEmail) {
		insertData.businessEmail = requestData.businessEmail
	}
	if (requestData.joiningDetails) {
		options.upsert = true
		let joiningDetails = requestData.joiningDetails

		if (joiningDetails.about) {
			insertData.about = joiningDetails.about
		}

		if (joiningDetails.businessSector) {
			insertData.businessSector = joiningDetails.businessSector
		}

		if (joiningDetails.interestTopics) {
			insertData.interestTopics = joiningDetails.interestTopics
		}

		if (joiningDetails.linkedin) {
			insertData.linkedin = joiningDetails.linkedin
		}

		if (joiningDetails.mobile) {
			insertData.mobile = joiningDetails.mobile
		}

		if (joiningDetails.profilePicture) {
			insertData.profilePicture = joiningDetails.profilePicture
		}

		if (joiningDetails.twitter) {
			insertData.twitter = joiningDetails.twitter
		}

		if (joiningDetails.telegram) {
			insertData.telegram = joiningDetails.telegram
		}

		if (joiningDetails.organization) {
			insertData.organization = joiningDetails.organization
		}
		if (joiningDetails.orgWebsite) {
			insertData.orgWebsite = joiningDetails.orgWebsite
		}

		if (joiningDetails.whatsAppMobile) {
			insertData.whatsAppMobile = joiningDetails.whatsAppMobile
		}
		if (joiningDetails.designation) {
			insertData.designation = joiningDetails.designation
		}
		if (joiningDetails.title) {
			insertData.title = joiningDetails.title
		};
		if (joiningDetails.mobileCode) {
			insertData.mobileCode = joiningDetails.mobileCode
		}
		if (joiningDetails.phoneCode) {
			insertData.phoneCode = joiningDetails.phoneCode
		}
		if (joiningDetails.whatsAppMobileCode) {
			insertData.whatsAppMobileCode = joiningDetails.whatsAppMobileCode
		}
		if (joiningDetails.attachedDocuments) {
			insertData.attachedDocuments = joiningDetails.attachedDocuments
		}
	}

	Speakers.findOneAndUpdate(findData, insertData, options, (err, res) => {
		if (err) {
			console.error("Unable to add media: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "addMedia", null, null)
			);
		}
		return cb(null, responseUtilities.sendResponse(200, "Speaker Added", "addSpeaker", null, null));
	});
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding sponsor after approving request
 */
const addSponsor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = data.requestData

	let insertData = {
		email: requestData.email,
		eventId: requestData.eventId
	};

	insertData.name = requestData.name
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		insertData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		insertData.eventAdminId = data.req.auth.eventAdminId
	}

	if (requestData.userId) {
		insertData.userId = requestData.userId
	}
	if (requestData.packageId) {
		insertData.packageId = requestData.packageId
	}
	if (requestData.businessEmail) {
		insertData.businessEmail = requestData.businessEmail
	}
	if (requestData.joiningDetails) {
		let joiningDetails = requestData.joiningDetails

		if (joiningDetails.goal) {
			insertData.goal = joiningDetails.goal
		}

		if (joiningDetails.businessSector) {
			insertData.businessSector = joiningDetails.businessSector
		}

		if (joiningDetails.designation) {
			insertData.designation = joiningDetails.designation
		}

		if (joiningDetails.company) {
			insertData.company = joiningDetails.company
		}

		if (joiningDetails.phone) {
			insertData.phone = joiningDetails.phone
		}

		if (joiningDetails.whatsAppMobile) {
			insertData.whatsAppMobile = joiningDetails.whatsAppMobile
		}

		if (joiningDetails.country) {
			insertData.country = joiningDetails.country
		}

		if (joiningDetails.website) {
			insertData.website = joiningDetails.website
		}
		if (joiningDetails.logo) {
			insertData.logo = joiningDetails.logo
		}
		if (joiningDetails.title) {
			insertData.title = joiningDetails.title
		}
		if (joiningDetails.companyDescription) {
			insertData.companyDescription = joiningDetails.companyDescription
		}
		if (joiningDetails.linkedin) {
			insertData.linkedin = joiningDetails.linkedin
		}
		if (joiningDetails.telegram) {
			insertData.telegram = joiningDetails.telegram
		}
		if (joiningDetails.twitter) {
			insertData.twitter = joiningDetails.twitter
		}
		if (joiningDetails.mobileCode) {
			insertData.mobileCode = joiningDetails.mobileCode
		}
		if (joiningDetails.phoneCode) {
			insertData.phoneCode = joiningDetails.phoneCode
		}
		if (joiningDetails.whatsAppMobileCode) {
			insertData.whatsAppMobileCode = joiningDetails.whatsAppMobileCode
		}
	}
	// insertData.eventAdminId = data.req.auth.id;

	Sponsors.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to add sponsor: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "addNewSponsor", null, null)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"New Sponsor Added",
				"addNewSponsor",
				res,
				null
			)
		);
	});
}

const updateExistingSponsor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = data.requestData    //request data from previous waterfall
	console.log("requested data => ", requestData)


	let findData = {
		email: requestData.email,
		_id: data.sponsorId
	}
	if (data.req.auth.role == "eventadmin") {
		findData.eventAdminId = data.req.auth.id;
	}

	let updateData = {};
	updateData["$addToSet"] = { requestIds: data.requestId };

	let options = {
		new: true,
		setDefaultsOnInsert: true,
	}
	console.log("Find Speaker => ", findData);
	console.log("Update/insert Speaker => ", updateData);

	Sponsors.findOneAndUpdate(findData, updateData, options, (err, res) => {
		if (err) {
			console.error("Unable to add sponsor: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateExistingSponsor", null, null)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Sponsor data updated",
				"updateExistingSponsor",
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
 * @description Contoller for adding media partner after approving request
 */
const addMediaPartner = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = data.requestData

	let insertData = {
		email: requestData.email,
		eventId: requestData.eventId,
		isActive: true
	};
	// delete insertData._id

	if (requestData.userId) {
		insertData.userId = requestData.userId
	}
	if (requestData.name) {
		insertData.name = requestData.name
	}
	if (requestData.businessEmail) {
		insertData.businessEmail = requestData.businessEmail
	}
	
	if (requestData.joiningDetails && requestData.joiningDetails.mediaHouse) {
		let joiningDetails = requestData.joiningDetails

		if (joiningDetails.mediaHouse) {
			insertData.mediaHouse = joiningDetails.mediaHouse
		}

		if (joiningDetails.website) {
			insertData.website = joiningDetails.website
		}

		if (joiningDetails.logo) {
			insertData.logo = joiningDetails.logo
		}

		if (joiningDetails.mobile) {
			insertData.mobile = joiningDetails.mobile
		}

		if (joiningDetails.whatsAppMobile) {
			insertData.whatsAppMobile = joiningDetails.whatsAppMobile
		}

		if (joiningDetails.contactPerson) {
			insertData.contactPerson = joiningDetails.contactPerson
		}

		if (joiningDetails.title) {
			insertData.title = joiningDetails.title
		};
		if (joiningDetails.designation) {
			insertData.designation = joiningDetails.designation
		}
		if (joiningDetails.telegram) {
			insertData.telegram = joiningDetails.telegram
		}

		if (joiningDetails.mobileCode) {
			insertData.mobileCode = joiningDetails.mobileCode
		}
		if (joiningDetails.phoneCode) {
			insertData.phoneCode = joiningDetails.phoneCode
		}
		if (joiningDetails.whatsAppMobileCode) {
			insertData.whatsAppMobileCode = joiningDetails.whatsAppMobileCode
		}
		if (joiningDetails.linkedin) {
			insertData.linkedin = joiningDetails.linkedin
		}
		if (joiningDetails.twitter) {
			insertData.twitter = joiningDetails.twitter
		}
	}

	// insertData.eventAdminId = data.req.auth.id;
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		insertData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		insertData.eventAdminId = data.req.auth.eventAdminId
	}

	Medias.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to add media: ", err);
			if (err.code == "11000" && err.errmsg.indexOf("mediaHouse_1") != -1) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Media-house already exist with the email",
						"addMediaPartner",
						null,
						null
					)
				);
			}
			return cb(
				responseUtilities.sendResponse(500, null, "addMediaPartner", null, null)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Media-speaker Added",
				"addMediaPartner",
				null,
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
 * @description Contoller for adding exhibitor after approving request
 */
const addExhibitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let requestData = data.requestData;

	let insertData = {
		email: requestData.email,
		eventId: requestData.eventId
	};
	insertData.name = requestData.name
	if (requestData.userId) {
		insertData.userId = requestData.userId
	}
	if (requestData.packageId) {
		insertData.packageId = requestData.packageId
	}
	if (requestData.businessEmail) {
		insertData.businessEmail = requestData.businessEmail
	}
	if (requestData.joiningDetails) {
		let joiningDetails = requestData.joiningDetails

		if (joiningDetails.goal) {
			insertData.goal = joiningDetails.goal
		}

		if (joiningDetails.businessSector) {
			insertData.businessSector = joiningDetails.businessSector
		}

		if (joiningDetails.title) {
			insertData.title = joiningDetails.title
		}

		if (joiningDetails.designation) {
			insertData.designation = joiningDetails.designation
		}

		if (joiningDetails.company) {
			insertData.company = joiningDetails.company
		}

		if (joiningDetails.phone) {
			insertData.phone = joiningDetails.phone
		}

		if (joiningDetails.whatsAppMobile) {
			insertData.whatsAppMobile = joiningDetails.whatsAppMobile
		}

		if (joiningDetails.country) {
			insertData.country = joiningDetails.country
		}

		if (joiningDetails.website) {
			insertData.website = joiningDetails.website
		}
		if (joiningDetails.logo) {
			insertData.logo = joiningDetails.logo
		}
		if (joiningDetails.linkedin) {
			insertData.linkedin = joiningDetails.linkedin
		}
		if (joiningDetails.telegram) {
			insertData.telegram = joiningDetails.telegram
		}
		if (joiningDetails.twitter) {
			insertData.twitter = joiningDetails.twitter
		}

		if (joiningDetails.mobileCode) {
			insertData.mobileCode = joiningDetails.mobileCode
		}
		if (joiningDetails.phoneCode) {
			insertData.phoneCode = joiningDetails.phoneCode
		}
		if (joiningDetails.whatsAppMobileCode) {
			insertData.whatsAppMobileCode = joiningDetails.whatsAppMobileCode
		}
	}
	// insertData.eventAdminId = data.req.auth.id;
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		insertData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		insertData.eventAdminId = data.req.auth.eventAdminId
	}
	Exhibitors.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to add media: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "addMedia", null, null)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Exhibitor Added",
				"addExhibitor",
				null,
				null
			)
		);
	});
}

const getSponsorPackageCount = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		packageId: data.packageId,
		status: "ASSIGNED"
	};

	Sponsors.find(findData, (err, res) => {
		if (err) {
			console.error("Unable to get sponsors: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "getSponsorPackageCount", null, null)
			);
		}
		data.assignedPackageCount = (res && res.length) || 0;
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Sponsors package count fetched",
				"getSponsorPackageCount",
				null,
				null
			)
		);
	});
}

const getExhibitorPackageCount = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		packageId: data.packageId,
		status: "ASSIGNED"
	};
	Exhibitors.find(findData, (err, res) => {
		if (err) {
			console.error("Unable to get exhibitors: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "getExhibitorPackageCount", null, null)
			);
		}
		data.assignedPackageCount = (res && res.length) || 0;
		console.log("===assigned exibitors for package======", res.length)

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Exhibitor package count fetched",
				"getExhibitorPackageCount",
				null,
				null
			)
		);
	});
}

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Export all requests 
 */
exports.exportAllRequests = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};
	if (data.req.auth.role == role.eventmanager) {
		// findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	};

	if (data.joinAs) {
		findData.joinAs = data.joinAs
	}
	if (data.status) {
		findData.status = data.status
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	};


	if (data.agencyId) {
		findData.eventAdminId = data.agencyId
	};

	console.log("FindData Export=> ", findData);
	let populateData = " eventId eventAdminId packageId country userId ";

	Requests.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding exportAllSpeakers => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllRequests", err, null));
			}

			console.log("Requests => ", res)
			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllRequests", null, null));
			}
			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let request = res[i];
				if (data.eventId && !request.eventId) {
					continue;
				}
				if (data.agencyId && !request.eventAdminId) {
					continue;
				}

				let fieldObject = {
					"Requested By": request?.userId?.name,
					"Join As": request.joinAs,
					"Event": request?.eventId?.name,
					"Agency": request?.eventAdminId?.name,
					"Status": request?.status,
					"Email": request.email
				}
				dataArray.push(fieldObject);
			}

			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllRequests", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportAllRequests", dataArray, null));
		})
}


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update requests status
 */
exports.updateRequestData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.requestId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateRequestStatus", null, data.req.signature));
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(findRequest, data));
	waterfallFunctions.push(async.apply(updateRequestData, data));
	async.waterfall(waterfallFunctions, cb);
}

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update request data
 */
const updateRequestData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.requestId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateRequest", null, data.req.signature));
	};

	console.log("Data received to update request...");
	let findData = {
		_id: data.requestId,
	};

	let updateData = {};
	if (data.email) {
		updateData.email = data.email;
		updateData["joiningDetails.email"] = data.email;

	};
	if (data.name) {
		updateData.name = data.name
	}
	if(data.businessEmail){
		updateData.businessEmail = data.businessEmail
	}
	if (data.packageId) {
		updateData.packageId = data.packageId
	}
	if (data.designation) {
		updateData["joiningDetails.designation"] = data.designation
	}
	if (data.businessSector) {
		updateData["joiningDetails.businessSector"] = data.businessSector
	}
	if (data.profilePicture) {
		updateData["joiningDetails.profilePicture"] = data.profilePicture
	}
	if (data.organization) {
		updateData["joiningDetails.organization"] = data.organization
	}
	if (data.orgWebsite) {
		updateData["joiningDetails.orgWebsite"] = data.orgWebsite
	}
	if (data.about) {
		updateData["joiningDetails.about"] = data.about
	}
	if (data.interestTopics) {
		updateData["joiningDetails.interestTopics"] = data.interestTopics
	}
	if (data.mobile) {
		updateData["joiningDetails.mobile"] = data.mobile
	}
	if (data.whatsAppMobile) {
		updateData["joiningDetails.whatsAppMobile"] = data.whatsAppMobile
	}
	if (JSON.stringify(data.linkedin)) {
		updateData["joiningDetails.linkedin"] = data.linkedin
	}
	if (JSON.stringify(data.twitter)) {
		updateData["joiningDetails.twitter"] = data.twitter
	}
	if (JSON.stringify(data.telegram)) {
		updateData["joiningDetails.telegram"] = data.telegram
	};
	if (data.title) {
		updateData["joiningDetails.title"] = data.title
	};

	if (data.country) {
		updateData["joiningDetails.country"] = data.country
		updateData.country = data.country;
	}

	if (data.contactPerson) {
		updateData["joiningDetails.contactPerson"] = data.contactPerson
	}
	if (data.mediaHouse) {
		updateData["joiningDetails.mediaHouse"] = data.mediaHouse
	}
	if (data.logo) {
		updateData["joiningDetails.logo"] = data.logo
	}
	if (data.mobile) {
		updateData["joiningDetails.mobile"] = data.mobile
	}

	if (data.website) {
		updateData["joiningDetails.website"] = data.website
	}

	if (data.designation) {
		updateData["joiningDetails.designation"] = data.designation
	}

	if (data.goal) {
		updateData["joiningDetails.goal"] = data.goal
	}

	if (data.company) {
		updateData["joiningDetails.company"] = data.company
	}
	if (data.phone) {
		updateData["joiningDetails.phone"] = data.phone
	}

	if (data.website) {
		updateData["joiningDetails.website"] = data.website
	}

	if (data.companyDescription) {
		updateData["joiningDetails.companyDescription"] = data.companyDescription
	}
	if (data.linkedin) {
		updateData["joiningDetails.linkedin"] = data.linkedin
	};

	if (data.mobileCode) {
		updateData["joiningDetails.mobileCode"] = data.mobileCode
	}
	if (data.phoneCode) {
		updateData["joiningDetails.phoneCode"] = data.phoneCode
	}
	if (data.whatsAppMobileCode) {
		updateData["joiningDetails.whatsAppMobileCode"] = data.whatsAppMobileCode
	}
	if (data.attachedDocuments) {
		updateData["joiningDetails.attachedDocuments"] = data.attachedDocuments
	}
	if (data.twitter) {
		updateData["joiningDetails.twitter"] = data.twitter
	};
	let options = {
		new: true
	};

	console.log("Update Data => ", updateData)
	Requests.findOneAndUpdate(findData, updateData, options, (err, res) => {
		if (err) {
			console.error("Unable to update Request: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateRequest", null, null)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Request updated",
				"updateRequest",
				res,
				null
			)
		);
	});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting specific request
 */
exports.getSpecificRequest = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.requestId) {
		return cb(responseUtilities.sendResponse(400, "Provide requestId", "getSpecificRequest", null, data.req.signature));
	};

	let findData = {
		_id: data.requestId,
	};

	Requests.findOne(findData)
		.populate(" eventId packageId country")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get request: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getSpecificRequest", null, null));
			}
			if (!res) {
				return cb(responseUtilities.sendResponse(400, "Request not found", "getSpecificRequest", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Request fetched for admin", "getSpecificRequest", res, null));

		});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for validating already applied entity or not
 */
const validateAlreadyAppliedEntity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.joinAs || !data.eventId || !data.email) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"validateAlreadyAppliedEntity",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	if (data.joinAs == "SPEAKER") {
		waterfallFunctions.push(async.apply(checkIfRequestExist, data));
		waterfallFunctions.push(async.apply(validateForAlreadyAppliedSpeaker, data));
	} else {
		//invalid request
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid entity type",
				"validateAlreadyAppliedEntity",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterfallFunctions, cb);
};
exports.validateAlreadyAppliedEntity = validateAlreadyAppliedEntity;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for validating already applied entity or not
 */
const validateForAlreadyAppliedSpeaker = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId || !data.email) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"validateAlreadyAppliedEntity",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		eventId: data.eventId,
		email: data.email,
		isDeleted: false,
	}
	
	Speakers.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get speaker: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "checkIfSpeakerExists", null, null)
				);
			};
			if (res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Speaker already exist",
						"checkIfSpeakerExists",
						null,
						data.req.signature
					)
				);
			} else {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"Speaker available to join",
						"checkIfSpeakerExists",
						null,
						data.req.signature
					)
				);
			}
		});
};
exports.validateAlreadyAppliedEntity = validateAlreadyAppliedEntity;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all requests for user
 */
exports.getAllJoiningRequestsForUser = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	data.allData = [];
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getAllUserAppliedRequests, data));
	waterfallFunctions.push(async.apply(getAllUserAppliedMedia, data));
	waterfallFunctions.push(async.apply(getAllUserAppliedSponsor, data));
	waterfallFunctions.push(async.apply(getAllUserAppliedSpeaker, data));
	waterfallFunctions.push(async.apply(getAllUserAppliedExhibitor, data));
	waterfallFunctions.push(async.apply(getAllUserAppliedVisitor, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for fetching requests for user
 */
const getAllUserAppliedRequests = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		status: { $in: ["REJECTED", "PENDING"] }
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	} else if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Requests.find(findData)
		.populate({ path: "eventId", select: "name startDate endDate coverImage eventType eventDescription venue",
			populate: [{
				path: "venue.city", select: "id name state_id country_id"
			},{
				path: "venue.state", select: "id name country_id"
			},{
				path: "venue.country", select: "currency id sortname name phoneCode flag flagIcon"
			}]
		})
		.populate({ path: "packageId", select: "type title description price quantity currency currencyId",
			populate:[{
				path: "currencyId", select: "code name symbol"
			}]
	  	})
		.populate("country")
		.exec((err, res) => {
			if (err) {
				console.log('error in finding requests => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "getAllUserRequests", err, null));
			}

			if(res && res.length > 0){
				for(let i=0; i < res.length; i++) {
					if(res[i].joinAs == "SPEAKER"){
						res[i].joinAs = "Speaker"
					}else if(res[i].joinAs == "SPONSOR"){
						res[i].joinAs = "Sponsor"
					}else if(res[i].joinAs == "MEDIA_PARTNER"){
						res[i].joinAs = "Media"
					}else if(res[i].joinAs == "EXHIBITOR"){
						res[i].joinAs = "Exhibitor"
					}
					data.allData.push(res[i]);
				}
			}
			return cb(null, responseUtilities.sendResponse(200, "Requests(s) found", "getAllUserRequests", null, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for fetching medias for user
 */
const getAllUserAppliedMedia = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	}

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = (data.req.auth.id || data.req.auth.eventAdminId)
	} else if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Medias.find(findData)
		.populate({ path: "eventId", select: "name startDate endDate coverImage eventType eventDescription venue",
			populate: [{
				path: "venue.city", select: "id name state_id country_id"
			},{
				path: "venue.state", select: "id name country_id"
			},{
				path: "venue.country", select: "currency id sortname name phoneCode flag flagIcon"
			}]
		})
		.lean()
		.exec((errM, resM) => {
			if (errM) {
				console.log('error in finding medias => ', errM)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "getAllUserMedias", err, null));
			}
			// let resM = JSON.parse(JSON.stringify(resM));
			let mediaList = [];
			if(resM.length > 0){
				mediaList = resM.map(el => ({...el, joinAs: "Media"}))
			}
			
			data.allData.push(...mediaList);
			return cb(null, responseUtilities.sendResponse(200, "Media(s) found", "getAllUserMedias", null, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for fetching sponsors for user
 */
const getAllUserAppliedSponsor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	}

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = (data.req.auth.id || data.req.auth.eventAdminId)
	} else if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Sponsors.find(findData)
		.populate({ path: "eventId", select: "name startDate endDate coverImage eventType eventDescription venue",
			populate: [{
				path: "venue.city", select: "id name state_id country_id"
			},{
				path: "venue.state", select: "id name country_id"
			},{
				path: "venue.country", select: "currency id sortname name phoneCode flag flagIcon"
			}]
		})
		.populate({ path: "packageId", select: "type title description price quantity currency currencyId",
			populate:[{
				path: "currencyId", select: "code name symbol"
			}]
	  	})
		.populate("country").lean()
		.exec((errS, resS) => {
			if (errS) {
				console.log('error in finding sponsors => ', errS)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "getAllUserSponsors", err, null));
			}
			let sponsorList = [];
			if(resS.length > 0){
				sponsorList = resS.map(el => ({...el, joinAs: "Sponsor"}))
			}
			
			data.allData.push(...sponsorList);
			return cb(null, responseUtilities.sendResponse(200, "Sponsor(s) found", "getAllUserSponsors", null, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for fetching speaker for user
 */
const getAllUserAppliedSpeaker = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	}

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = (data.req.auth.id || data.req.auth.eventAdminId)
	} else if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Speakers.find(findData)
		.populate({ path: "eventId", select: "name startDate endDate coverImage eventType eventDescription venue",
			populate: [{
				path: "venue.city", select: "id name state_id country_id"
			},{
				path: "venue.state", select: "id name country_id"
			},{
				path: "venue.country", select: "currency id sortname name phoneCode flag flagIcon"
			}]
		})
		.populate("country").lean()
		.exec((errSp, resSp) => {
			if (errSp) {
				console.log('error in finding speakers => ', errSp)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "getAllUserSpeakers", err, null));
			}			
			let speakerList = [];
			if(resSp.length > 0){
				speakerList = resSp.map(el => ({...el, joinAs: "Speaker"}))
			}
			
			data.allData.push(...speakerList);
			return cb(null, responseUtilities.sendResponse(200, "Speaker(s) found", "getAllUserSpeakers", null, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for fetching exhibitor for user
 */
const getAllUserAppliedExhibitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false
	}

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = (data.req.auth.id || data.req.auth.eventAdminId)
	} else if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Exhibitors.find(findData)
		.populate({ path: "eventId", select: "name startDate endDate coverImage eventType eventDescription venue",
			populate: [{
				path: "venue.city", select: "id name state_id country_id"
			},{
				path: "venue.state", select: "id name country_id"
			},{
				path: "venue.country", select: "currency id sortname name phoneCode flag flagIcon"
			}]
		})
		.populate({ path: "packageId", select: "type title description price quantity currency currencyId",
			populate:[{
				path: "currencyId", select: "code name symbol"
			}]
	  	})
		.populate("country").lean()
		.exec((errE, resE) => {
			if (errE) {
				console.log('error in finding exhibitor => ', errE)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "getAllUserExhibitor", err, null));
			}
			
			let exhibitorList = [];
			if(resE.length > 0){
				exhibitorList = resE.map(el => ({...el, joinAs: "Exhibitor"}))
			}
			
			data.allData.push(...exhibitorList);
			return cb(null, responseUtilities.sendResponse(200, "Exhibitor(s) found", "getAllUserExhibitor", null, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for fetching visitor for user
 */
const getAllUserAppliedVisitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false, 
		isPackagePurchased: true
	}

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = (data.req.auth.id || data.req.auth.eventAdminId)
	} else if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	Visitors.find(findData)
		.populate({ path: "eventId", select: "name startDate endDate coverImage eventType eventDescription venue additionalInfo",
			populate: [{
				path: "venue.city", select: "id name state_id country_id"
			},{
				path: "venue.state", select: "id name country_id"
			},{
				path: "venue.country", select: "currency id sortname name phoneCode flag flagIcon"
			}]
		})
		.populate({ path: "packageId", select: "type title description price quantity currency currencyId",
			populate:[{
				path: "currencyId", select: "code name symbol"
			}]
	  	})
		.lean()
		.exec((errV, resV) => {
			if (errV) {
				console.log('error in finding visitor => ', errV)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "getAllUserVisitor", err, null));
			}
			
			let visitorList = [];
			if(resV.length > 0){
				visitorList = resV.map(el => ({...el, joinAs: "Visitor"}))
			}
			
			data.allData.push(...visitorList);
			if(data.allData.length > 0){
				data.allData = _.orderBy(data.allData, 'createdAt','desc');
			}
			return cb(null, responseUtilities.sendResponse(200, "All requests fetched successfully", "getAllUserVisitor", data.allData, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for update joining request for user
 */
const updateJoiningRequestsForUser = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.joinAs || !data.id || !data.hasOwnProperty("appRequest")) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateJoiningRequestsForUser",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	if((data.appRequest == true) || (data.appRequest == "true")){
		data.requestId = data.id;
		waterfallFunctions.push(async.apply(updateRequestData, data));
	}else {
		if (data.joinAs == "Speaker") {
			data.speakerId = data.id;
			waterfallFunctions.push(async.apply(updateSpeaker, data));
		}else if (data.joinAs == "Sponsor") {
			data.sponsorId = data.id;
			waterfallFunctions.push(async.apply(updateSponsor, data));
		}else if (data.joinAs == "Media") {
			data.mediaId = data.id;
			waterfallFunctions.push(async.apply(updateMedia, data));
		}else if (data.joinAs == "Exhibitor") {
			data.exhibitorId = data.id;
			waterfallFunctions.push(async.apply(updateExhibitor, data));
		}else if (data.joinAs == "Visitor") {
			data.visitorId = data.id;
			waterfallFunctions.push(async.apply(updateVisitor, data));
		}else {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid entity type",
					"updateJoiningRequestsForUser",
					null,
					data.req.signature
				)
			);
		}
	}
	async.waterfall(waterfallFunctions, cb);
};
exports.updateJoiningRequestsForUser = updateJoiningRequestsForUser;
