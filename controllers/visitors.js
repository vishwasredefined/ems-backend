const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");
const QRCode = require('qrcode');

const path = require("path");

//helper
const responseUtilities = require("../helpers/sendResponse");
let emailUtilities = require("../helpers/email");

//models
const Visitors = require("../models/visitors");
const Events = require("../models/events");
const Country = require("../models/countries");
const Packages = require("../models/packages");

const role = JSON.parse(process.env.role);

//controllers
const events = require("./events");
const users = require("./users");
const { createTransaction } = require("./transactions");
const { checkIfInvalidEvent } = require("../controllers/events");
const { insertTransaction, generatePurchasePass } = require("./transactions")
const { getEventById } = require("../controllers/events");
const { verifyPackageQuantityStatus } = require("../controllers/packages")

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding Visitor
 */
exports.addVisitor = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId) {
		return cb(responseUtilities.sendResponse(400, "Provide selected package details", "addVisitor", null, data.req.signature));
	}

	if (!data.title || (!data.name && !data.firstName) || !data.nationality || !data.residenceCountry || !data.interestTopics || !data.interestTopics.length) {
		return cb(responseUtilities.sendResponse(400, "Provide complete personal details", "addVisitor", null, data.req.signature));
	}

	if (!data.company || !data.designation || !data.website) {
		return cb(responseUtilities.sendResponse(400, "Provide complete company details", "addVisitor", null, data.req.signature));
	}
	if (!data.email || !data.businessEmail) {
		return cb(responseUtilities.sendResponse(400, "Provide complete contact details", "addVisitor", null, data.req.signature));
	}

	data.adminTransaction = true;

	let insertData = {
		email: data.email,
		firstName: data.firstName,
		name: data.name || data.firstName,
		packageId: data.packageId,
		isPackagePurchased: true,
		source: "ADMIN_PANEL",
		eventAdminId: data.req.auth.eventAdminId || data.req.auth.id
	};

	if (data.eventId) {
		insertData.eventId = data.eventId
	};

	if (data.profilePicture) {
		insertData.profilePicture = data.profilePicture
	}
	if (data.title) {
		insertData.title = data.title
	}
	if (data.lastName) {
		insertData.lastName = data.lastName
	}

	if (data.nationality) {
		insertData.nationality = data.nationality
	}
	if (data.residenceCountry) {
		insertData.residenceCountry = data.residenceCountry
	}

	if (data.interestTopics) {
		insertData.interestTopics = data.interestTopics
	}

	if (data.company) {
		insertData.company = data.company
	}

	if (data.designation) {
		insertData.designation = data.designation
	}

	if (data.website) {
		insertData.website = data.website
	}

	if (data.eventId) {
		insertData.eventId = data.eventId
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
	};
	
	if (data.telegram) {
		insertData.telegram = data.telegram
	}
	
	if (data.additionalInfo) {
		insertData.additionalInfo = data.additionalInfo
	}
	if (data.linkedin) {
		insertData.linkedin = data.linkedin
	}
	if (data.twitter) {
		insertData.twitter = data.twitter
	}
	if (data.businessEmail) {
		insertData.businessEmail = data.businessEmail
	}

	let waterfallFunctions = [];

	waterfallFunctions.push(async.apply(checkIfInvalidPackage, data));
	// waterfallFunctions.push(async.apply(checkIfVisitorAlreadyExist, data));
	waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	waterfallFunctions.push(async.apply(users.findUserByEmail, data));
	waterfallFunctions.push(async.apply(verifyPackageQuantityStatus, data));
	waterfallFunctions.push(async.apply(createVisitor, data));
	//Generate Packaged Purchased Doc
	waterfallFunctions.push(async.apply(insertTransaction, data));
	waterfallFunctions.push(async.apply(generatePurchasePass, data));
	async.waterfall(waterfallFunctions, cb);
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Visitor package valid
 */
const checkIfInvalidPackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkIfInvalidPackage", null, data.req.signature));
	};

	let findData = {
		_id: data.packageId,
		eventAdminId: data.req.auth.eventAdminId || data.req.auth.id
	};

	if (data.req.auth.role == "user") delete findData.eventAdminId;

	if (data.eventId) {
		// findData.eventId = data.eventId
	};

	console.log("Find if package Valid => ", findData);
	Packages.findOne(findData).populate("currencyId").exec((err, package) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkIfInvalidPackage", null, null));
		}
		if (!package) {
			return cb(responseUtilities.sendResponse(400, "Package not found.", "checkIfInvalidPackage", null, data.req.signature));
		} else if (!package.isActive) {
			return cb(responseUtilities.sendResponse(400, "Package not active.", "checkIfInvalidPackage", null, data.req.signature));
		} else if (!package.type || package.type != "Visitor") {
			return cb(responseUtilities.sendResponse(400, "Invalid Package selected.", "checkIfInvalidPackage", null, data.req.signature));
		} else if (!package.eventId || package.eventId.toString() != data.eventId.toString()) {
			return cb(responseUtilities.sendResponse(400, "Package selected does not belong to this event.", "checkIfInvalidPackage", null, data.req.signature));
		}
		else {
			if (package.price == 0) {
				console.log("Zero price...");
				data.zeroPricePurchase = true;
			};
			data.amount = package.price;
			data.currency = package?.currencyId?.code;
			data.usdAmount = package.price; //Later this key will hold only usd Amount as its base currency.
			data.packageDetails = package;
			return cb(null, responseUtilities.sendResponse(200, "Package does not exist", "checkIfInvalidPackage", null, null));
		};
	});
}

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Visitor Already Exist
 */
const checkIfVisitorAlreadyExist = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkIfVisitorAlreadyExist", null, data.req.signature));
	}

	let findData = {
		email: data.email,
		eventAdminId: data.req.auth.eventAdminId || data.req.auth.id
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	if (data.req.auth.role == "user") delete findData.eventAdminId;

	Visitors.findOne(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Visitors: ", err);
			return cb(responseUtilities.sendResponse(500, null, "checkIfVisitorAlreadyExist", null, null));
		}
		if (res) {
			return cb(responseUtilities.sendResponse(400, "Visitor already exist", "checkIfVisitorAlreadyExist", null, data.req.signature));
		} else {
			return cb(null, responseUtilities.sendResponse(200, "Visitor does not exist", "checkIfVisitorAlreadyExist", null, null));
		}
	});
}

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding visitor
 */
const createVisitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.email) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "createVisitor", null, data.req.signature));
	}
	let eventRes = null;
	let eventAdminId = (data.req.auth && data.req.auth.id) || null
	let insertData = {
		email: data.email,
		firstName: data.firstName,
		name: data.name || data.firstName,
		packageId: data.packageId,
		isPackagePurchased: true,
		parentMember: 'Admin',
		source: "ADMIN_PANEL",
		status: "Approved"
	};

	if (data.userId) {
		insertData.userId = data.userId
	};
	if (data.eventId) {
		insertData.eventId = data.eventId
	};

	if (eventAdminId) {
		insertData.eventAdminId = eventAdminId
	}

	if (data.profilePicture) {
		insertData.profilePicture = data.profilePicture
	}
	if (data.title) {
		insertData.title = data.title
	}
	if (data.lastName) {
		insertData.lastName = data.lastName
	}

	if (data.nationality) {
		insertData.nationality = data.nationality
	}
	if (data.residenceCountry) {
		insertData.residenceCountry = data.residenceCountry
	}

	if (data.interestTopics) {
		insertData.interestTopics = data.interestTopics
	}

	if (data.company) {
		insertData.company = data.company
	}

	if (data.designation) {
		insertData.designation = data.designation
	}

	if (data.website) {
		insertData.website = data.website
	}

	if (data.eventId) {
		insertData.eventId = data.eventId
	}

	if (data.mobile) {
		insertData.mobile = data.mobile
	}

	if (data.whatsAppMobile) {
		insertData.whatsAppMobile = data.whatsAppMobile
	}

	if (data.telegram) {
		insertData.telegram = data.telegram
	}
	if (data.additionalInfo) {
		insertData.additionalInfo = data.additionalInfo
	}
	if (data.linkedin) {
		insertData.linkedin = data.linkedin
	}
	if (data.twitter) {
		insertData.twitter = data.twitter
	}
	if (data.businessEmail) {
		insertData.businessEmail = data.businessEmail
	}

	Visitors.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create Package: ", err);
			return cb(responseUtilities.sendResponse(500, null, "createVisitor", null, null));
		};
		data.visitorId = res._id;
		return cb(null, responseUtilities.sendResponse(200, "Visitor added", "createVisitor", null, data.req.signature));
	});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for APPLY as visitor
 */
exports.applyAsVisitor = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	//1. Validations
	if (!data.profilePicture || !data.title || !data.name || !data.nationality || !data.residenceCountry || !data.interestTopics || !data.interestTopics.length) {
		return cb(responseUtilities.sendResponse(400, "Provide complete details", "applyAsVisitor", null, data.req.signature));
	};

	if (!data.company || !data.designation || !data.website || !data.email || !data.businessEmail) {
		return cb(responseUtilities.sendResponse(400, "Provide complete professional details", "applyAsVisitor", null, data.req.signature));
	}

	if (!data.packageId || !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Please select package and event", "applyAsVisitor", null, data.req.signature));
	};
	if (!data.linkedin || !data.twitter) {
		return cb(responseUtilities.sendResponse(400, "Please provide complete social details", "applyAsVisitor", null, data.req.signature));
	}
	

	//2. Check if email exists
	let findData = {
		email: data.email,
		eventId: data.eventId,
		userId: data.req.auth.id,
		parentMember: "Visitor"
	};
	/**
	 *  (parentMember: "Visitor") added to detect weather this email has been added from app only
	 */
	let checkIfVisitorExist = await Visitors.findOne(findData);

	if (!checkIfVisitorExist) {
		console.log("Email donot exists, creating new record....")
		data.createNewRecord = true;
	};
	if (checkIfVisitorExist && checkIfVisitorExist.isPackagePurchased) {
		console.log("Email exists, but package purchased , so new record....", checkIfVisitorExist)
		data.createNewRecord = true;
	};

	if (checkIfVisitorExist && !checkIfVisitorExist.isPackagePurchased) {
		data.updateExistingRecord = true;
		data.existingVisitorId = checkIfVisitorExist._id;
		console.log("Email exists, but package not purchased , so update record....", data.existingVisitorId)
	};

	//3. Insert Data Create
	let insertData = {
		name: data.name,
		userId: data.req.auth.id,
		email: data.email,
		eventId: data.eventId
	};

	if (data.profilePicture) {
		insertData.profilePicture = data.profilePicture
	};

	if (data.packageId) {
		insertData.packageId = data.packageId
	};

	if (data.title) {
		insertData.title = data.title
	};

	if (data.name || data.firstName) {
		insertData.name = data.name || data.firstName
	};

	if (data.firstName || data.name) {
		insertData.firstName = data.firstName || data.name
	};
	if (data.lastName) {
		insertData.lastName = data.lastName
	};

	if (data.nationality) {
		insertData.nationality = data.nationality
	}
	if (data.residenceCountry) {
		insertData.residenceCountry = data.residenceCountry
	}

	if (data.interestTopics) {
		insertData.interestTopics = data.interestTopics
	};

	if (data.mobile) {
		insertData.mobile = data.mobile
	}

	if (data.whatsAppMobile) {
		insertData.whatsAppMobile = data.whatsAppMobile
	};

	if (data.whatsAppMobileCode) {
		insertData.whatsAppMobileCode = data.whatsAppMobileCode
	}
	if (data.mobileCode) {
		insertData.mobileCode = data.mobileCode
	};

	if (data.company) {
		insertData.company = data.company
	}
	if (data.designation) {
		insertData.designation = data.designation
	};

	if (data.website) {
		insertData.website = data.website
	}

	if (data.eventId) {
		insertData.eventId = data.eventId
	};

	if (data.telegram) {
		insertData.telegram = data.telegram
	};

	if (data.additionalInfo) {
		insertData.additionalInfo = data.additionalInfo
	};
	if (data.linkedin) {
		insertData.linkedin = data.linkedin
	}
	if (data.twitter) {
		insertData.twitter = data.twitter
	}
	if(data.businessEmail){
		insertData.businessEmail = data.businessEmail
	}
	insertData.source = "APP";
	console.log("Insert Visitor request => ", insertData);

	data.insertData = insertData;

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkIfInvalidPackage, data));
	waterfallFunctions.push(async.apply(checkIfInvalidEvent, data));
	// waterfallFunctions.push(async.apply(verifyPackageQuantityStatus, data));
	waterfallFunctions.push(async.apply(insertVisitorData, data));
	waterfallFunctions.push(async.apply(createTransaction, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for APPLY as visitor
 */
const insertVisitorData = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let insertData = data.insertData || {};

	// insertData.isPackagePurchased = true;

	if (data.eventAdminId) {
		insertData.eventAdminId = data.eventAdminId
	};

	if (data.req.auth.role != "user" && data.userId) {
		insertData.userId = data.userId
	};

	if(data.eventDetails && data.eventDetails.category && (data.eventDetails.category == "FREE")){
		if(data.zeroPricePurchase && data.zeroPricePurchase == true){
			insertData.status = "Waitlisted"
		}else{
			return cb(responseUtilities.sendResponse(400, "Package of zero price should be purchased for exclusive event", "insertVisitorData", null, data.req.signature));
		}
	}else{
		insertData.status = "Approved"
	}

	if (data.createNewRecord) {
		insertData.parentMember = "Visitor";

		Visitors.create(insertData, (err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "insertVisitorData", null, null));
			};
			data.visitorId = res._id;
			return cb(null, responseUtilities.sendResponse(200, "Data added", "insertVisitorData", null, data.req.signature));
		});
	};

	if (data.updateExistingRecord) {
		let findData = {
			_id: data.existingVisitorId
		};
		let options = {
			upsert: true,
			new: true,
			setDefaultsOnInsert: true
		}
		Visitors.findOneAndUpdate(findData, insertData, options, (err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "insertVisitorData", null, null));
			};
			data.visitorId = res._id;
			data.visitorData = res;
			return cb(null, responseUtilities.sendResponse(200, "Data added", "insertVisitorData", null, data.req.signature));
		});
	}
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all visitors paginated
 */
exports.getAllVisitors = function (data, response, cb) {

	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		// isPackagePurchased: true
		$or: [
			{
				source:"ADMIN_PANEL"
			},
			{
				source:"APP",
				isPackagePurchased:true
			}
		]
	};
	

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;

	}

	if (data.eventId) {
		findData.eventId = data.eventId
	}

	if (data.agencyId && check.isValid(data.agencyId)) {
		findData.eventAdminId = data.agencyId
	};

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = data.isBlocked
	};

	if (data.packageId) {
		findData.packageId = data.packageId
	}
	if (data.status) {
		findData.status = data.status
	}

	let limit = parseInt(process.env.pageLimit);
	if (data.limit) {
		limit = parseInt(data.limit)
	}
	let skip = 0;
	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}

	console.log("Visitor Find Data = > ", findData)
	Visitors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for speakers: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getAllVisitors", null, null));

		};

		Visitors.find(findData)
			.populate("residenceCountry packageId country eventId")
			.populate("additionalInfo.questionId", "question type options answer")
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get Visitors: ", err);
					return cb(responseUtilities.sendResponse(500, null, "getAllVisitors", null, null));
				}
				let sendData = {
					data: res,
					count: count,
					pageLimit: limit,
				};
				return cb(null, responseUtilities.sendResponse(200, "All Visitors fetched for admin", "getAllVisitors", sendData, null));

			});
	});


	// let limit = parseInt(process.env.pageLimit);
	// if (data.limit) {
	// 	limit = parseInt(data.limit)
	// }
	// let skip = 0;
	// if (data.currentPage) {
	// 	skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	// }
	// Visitors.aggregate([
	// 	{ $match: findData },
	// 	{
	// 		$lookup: {
	// 			from: "packages",
	// 			localField: "packageId",
	// 			foreignField: "_id",
	// 			as: "packageId"
	// 		}
	// 	},
	// 	{
	// 		$unwind: {
	// 			path: "$packageId",
	// 			preserveNullAndEmptyArrays: true
	// 		}
	// 	},
	// 	{
	// 		$lookup: {
	// 			from: "countries",
	// 			localField: "residenceCountry",
	// 			foreignField: "_id",
	// 			as: "residenceCountry"
	// 		}
	// 	},
	// 	{ $unwind: "$residenceCountry" },
	// 	{ $match: {} },
	// 	{
	// 		$facet: {
	// 			metadata: [{ $count: "totalCount" }, { $addFields: { pageLimit: limit } }],
	// 			data: [{ $sort: { "createdAt": -1 } }, { $skip: skip }, { $limit: limit }]
	// 		}
	// 	}
	// ]).exec((err, res) => {
	// 	if (err) {
	// 		console.error("Unable to get Visitors: ", err);
	// 		return cb(responseUtilities.sendResponse(500, null, "getAllVisitors", null, null));
	// 	}
	// 	return cb(null, responseUtilities.sendResponse(200, "All Visitors fetched for admin", "getAllVisitors", res, null));
	// })
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all visitors lisitng
 */
exports.getVisitorsList = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		isBlocked: false,
		isPackagePurchased: true
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth && data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventAdminId = data.req.auth.eventAdminId
		findData.eventId = { $in: data.req.auth.filteredEvents }
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	if (data.packageId) {
		findData.packageId = data.packageId
	};

	Visitors.find(findData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Visitors: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getAllVisitors", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "All Visitors fetched for admin", "getAllVisitors", res, null));
		});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting specific visitors
 */
exports.getVisitorById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id) {
		return cb(responseUtilities.sendResponse(400, "Provide visitorId", "getVisitorById", null, data.req.signature));
	}

	let findData = {
		_id: data.id,
		isDeleted: false,
		// isPackagePurchased: true
	};

	Visitors.findOne(findData)
		.populate(" residenceCountry packageId")
		.populate("additionalInfo.questionId", "question type options answer isRequired")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get visitor: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getVisitorById", null, null));
			}
			if (!res) {
				return cb(responseUtilities.sendResponse(400, "Visitor not found", "getVisitorById", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Visitor fetched for admin", "getVisitorById", res, null));

		});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking if visitor already exist
 */
const getExistingVisitorByEmail = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.email && !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getExistingVisitorByEmail", null, data.req.signature));
	}

	let findData = {
		isDeleted: false,
		// isBlocked: false,
	}

	if (data.email) {
		findData.email = data.email
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	Visitors.find(findData)
		.populate('residenceCountry eventId packageId')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Visitors: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getExistingVisitorByEmail", null, null));

			}

			let visitorRes = JSON.parse(JSON.stringify(res))
			if (data.eventId && visitorRes && visitorRes.length) {
				if (visitorRes.find((o) => {
					let exist = false
					if (o.eventId && o.eventId._id) {
						exist = (o.eventId._id.toString() == data.eventId.toString())
					}
					return exist
				})) {
					return cb(responseUtilities.sendResponse(400, "Visitor Already added for the event", "getExistingVisitorByEmail", null, data.req.signature));
				}
			};

			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"All Visitors fetched by email",
					"getExistingVisitorByEmail",
					visitorRes,
					null
				)
			);
		});
}
exports.getExistingVisitorByEmail = getExistingVisitorByEmail

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for updating visitor
 */
exports.updateVisitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.visitorId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitor", null, data.req.signature));
	};

	let findData = {
		_id: data.visitorId,
		// isPackagePurchased: true
	};
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents }
	}

	let keys = [
		'profilePicture', 'title',
		'name',
		'firstName', 'lastName',
		'mobile', 'whatsAppMobile',
		'residenceCountry', 'nationality',
		'interestTopics', 'linkedin',
		'twitter', 'telegram',
		'company', 'designation',
		'website',
		"packageId",
		"mobileCode", "whatsAppMobileCode",
		"additionalInfo","businessEmail"
	];
	
	let updateData = {};

	let updateKeysReceived = Object.keys(data);
	for (let i = 0; i < keys.length; i++) {
		if (updateKeysReceived.includes(keys[i])) {
			updateData[keys[i]] = data[keys[i]]
		}
	};

	if (updateData.firstName && !updateData.name) data.name = updateData.firstName;

	console.log("Update visitor Data => ", updateData)
	Visitors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Visitors", err);
			return cb(responseUtilities.sendResponse(500, null, "updateVisitor", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Visitor updated", "updateVisitor", null, null));
	});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for updating visitor block status
 */
exports.updateVisitorBlockStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.visitorId || !JSON.stringify(data.isBlocked)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitorBlockStatus", null, data.req.signature));

	}
	let findData = {
		_id: data.visitorId,
		isPackagePurchased: true
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = {
		isBlocked: data.isBlocked
	};

	Visitors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Visitors", err);
			return cb(responseUtilities.sendResponse(500, null, "updateVisitorBlockStatus", null, null));
		};
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "Visitor not found", "updateVisitorBlockStatus", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Visitor block status updated", "updateVisitorBlockStatus", null, null));
	});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Exporting all visitors
 */
exports.exportAllVisitors = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		isDeleted: false,
		$or: [
			{
				source:"ADMIN_PANEL"
			},
			{
				source:"APP",
				isPackagePurchased:true
			}
		]
	};
	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};
	if (data.req.auth.role == role.eventmanager) {
		// findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	};

	if (JSON.stringify(data.isBlocked)) {
		findData.isBlocked = JSON.parse(data.isBlocked)
	}

	if (data.agencyId) {
		findData.eventAdminId = data.agencyId
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}

	if (data.packageId) {
		findData.packageId = data.packageId
	}
	if (data.status) {
		findData.status = data.status
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

	let populateData = " eventId eventAdminId residenceCountry packageId"
	console.log("Populate Data => ", populateData);
	Visitors.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding visitors => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllVisitors", err, null));
			}
			// console.log("All user res length => ", res);

			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllVisitors", null, null));
			};

			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let visitor = res[i];
				if (data.eventId && !visitor.eventId) {
					continue;
				}
				if (data.eventAdminId && !visitor.eventAdminId) {
					continue;
				}

				let attendeeName = visitor.name || (visitor.firstName || "") + " " + (visitor.lastName || "");
				// console.log("visitor => ", visitor?.additionalInfo)
				let fieldObject = {
					"Event": visitor?.eventId?.name,
					"Agency": visitor?.eventAdminId?.name,
					"PassPurchased": visitor?.packageId?.title,
					"Title": visitor.title,
					"Name": attendeeName,
					"Email": visitor.email,
					"Nationality": visitor?.nationality?.name || visitor?.nationality,
					"Residence Country": visitor?.residenceCountry?.name,
					"Designation": visitor?.designation,
					"Company": visitor?.company,
					"Mobile": visitor?.mobile || visitor?.whatsAppMobile
				}
				console.log("fieldObject => ", fieldObject);

				dataArray.push(fieldObject);
			}

			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllVisitors", null, null));
			};

			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportAllVisitors", dataArray, null));
		})
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting all visitors lisitng
 */
exports.getAllVisitorsList = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		isBlocked: false,
		isPackagePurchased: true
	};

    let allPackagesTypes = JSON.parse(process.env.PACKAGES_TYPES);
	if (data.req.auth.role == role.user) {
        findData.userId = mongoose.Types.ObjectId(data.req.auth.id) //User gets only his purchased passes
        findData.parentMember = allPackagesTypes.VISITOR_PASS
    };

	if (data.eventId) {
		findData.eventId = mongoose.Types.ObjectId(data.eventId)
	};

	if (data.packageId) {
		findData.packageId = mongoose.Types.ObjectId(data.packageId)
	};
	console.log("findData ", findData);

	let fetchData = {
		"email": "$email",
		"userId": "$userId",
		"company": "$company",
		"createdAt": "$createdAt",
		"designation": "$designation",
		"interestTopics": "$interestTopics",
		"isPackagePurchased": "$isPackagePurchased",
		"isPassActivated": "$isPassActivated",
		"status": "$status",
		"name": "$name",
		"passUrl": "$passUrl",
		"packageId._id": "$packageId._id",
		"packageId.title": "$packageId.title",
		"packageId.type": "$packageId.type",
		"packageId.description": "$packageId.description",
		"packageId.price": "$packageId.price",
		"eventId._id": "$eventId._id",
		"eventId.venue": "$eventId.venue",
		"eventId.endDate": "$eventId.endDate",
		"eventId.startDate": "$eventId.startDate",
		"eventId.name": "$eventId.name",
		"eventId.coverImage": "$eventId.coverImage",
		"eventId.eventDescription": "$eventId.eventDescription",
		"transactionId._id": "$transactionId._id",
		"transactionId.txnId": "$transactionId.txnId",
		"transactionId.transactionType": "$transactionId.transactionType",
		"transactionId.status": "$transactionId.status",
		"transactionId.paymode": "$transactionId.paymode",
		"transactionId.gatewayName": "$transactionId.gatewayName",
		"transactionId.amount": "$transactionId.amount",
		"transactionId.orderId": "$transactionId.orderId",
		"transactionId.createdAt": "$transactionId.createdAt",
		"currencies._id": "$currencies._id",
		"currencies.code": "$currencies.code",
		"currencies.name": "$currencies.name",
		"currencies.symbol": "$currencies.symbol",
		"countries._id": "$countries._id",
		"countries.sortname": "$countries.sortname",
		"countries.phoneCode": "$countries.phoneCode",
		"countries.name": "$countries.name",
		"cities._id": "$cities._id",
		"cities.name": "$cities.name",
		"states._id": "$states._id",
		"states.name": "$states.name",
	}
			
		Visitors.aggregate([
			{ $match: findData },
			{
				$lookup: {
					from: "events",
					localField: "eventId",
					foreignField: "_id",
					as: "eventId"
				}
			},
			{
				$unwind: { path: "$eventId" }
			},
			{
				$lookup: {
					from: "packages",
					localField: "packageId",
					foreignField: "_id",
					as: "packageId"
				}
			},
			{
				$unwind: { path: "$packageId" }
			},
			{
				$lookup: {
					from: "transactions",
					localField: "_id",
					foreignField: "visitorId",
					as: "transactionId"
				}
			},
			{
				$unwind: { path: "$transactionId", preserveNullAndEmptyArrays: true  }
			},
			{
				$lookup: {
					from: "currencies",
					localField: "packageId.currencyId",
					foreignField: "_id",
					as: "currencies"
				}
			},
			{
				$unwind: { path: "$currencies", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "countries",
					localField: "eventId.venue.country",
					foreignField: "_id",
					as: "countries"
				}
			},
			{
				$unwind: { path: "$countries", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "states",
					localField: "eventId.venue.state",
					foreignField: "_id",
					as: "states"
				}
			},
			{
				$unwind: { path: "$states", preserveNullAndEmptyArrays: true }
			},
				
			{
				$lookup: {
					from: "cities",
					localField: "eventId.venue.city",
					foreignField: "_id",
					as: "cities"
				}
			},
			{
				$unwind: { path: "$cities", preserveNullAndEmptyArrays: true }
			},
			{
				$project: fetchData
			}
		]).sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Visitors: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getAllVisitorsList", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "All Visitors fetched for App", "getAllVisitorsList", res, null));
		});
};

exports.updateVisitorApproveStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.visitorId || !JSON.stringify(data.status)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitorApproveStatus", null, data.req.signature));

	}
	let findData = {
		_id: data.visitorId,
		isPackagePurchased: true
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = {
		status: data.status
	};

	Visitors.findOne(findData, (errV, resV) => {
		if (errV) {
			console.error("Could not get visitor: ", errV);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateVisitorApproveStatus",
					null,
					null
				)
			);
		}
		if (!resV) {
			return cb(responseUtilities.sendResponse(400, "Visitor not found", "updateVisitorApproveStatus", null, null));
		}
		if(data.status == "Waitlisted" && resV.isPassActivated == true){
			return cb(responseUtilities.sendResponse(400, "The pass for the visitor has already been activated", "updateVisitorApproveStatus", null, null));
		}

		Visitors.findOneAndUpdate(findData, updateData, (err, res) => {
			if (err) {
				console.error("Unable to update Visitors", err);
				return cb(responseUtilities.sendResponse(500, null, "updateVisitorApproveStatus", null, null));
			};
			if (!res) {
				return cb(responseUtilities.sendResponse(400, "Visitor not found", "updateVisitorApproveStatus", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Visitor status updated", "updateVisitorApproveStatus", null, null));
		});
	});
};

exports.getAllApprovedVisitorsList = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getAllApprovedVisitorsList", null, data.req.signature));

	}
	let findData = {
		eventId: data.eventId,
		isPackagePurchased: true,
		status: "Approved"
	};
	let fetchData = {
        interestTopics: 0,
		isBlocked: 0,
		isDeleted: 0,
    }

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	if(data.name){
		findData.name = { "$regex": data.name, "$options": "i" }
	}
	Visitors.countDocuments(findData, (errC, count) => {
		if (errC) {
			console.error("Could not get count for visitors: ", errC);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getQuestionResponses",
					null,
					null
				)
			);
		}
		console.log("count ", count);
		let limit = parseInt(process.env.pageLimit);
		if (data.limit) {
			limit = parseInt(data.limit)
		}
		let skip = 0;
		if (data.currentPage) {
			skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
		}

		Visitors.find(findData, fetchData)
			.populate({
				path: 'eventId',
				model: 'event',
				select: 'name startDate endDate coverImage eventDescription category',
				// match: { category: "FREE" },
			})
			.populate('eventAdminId', 'name')
			.populate('residenceCountry', 'name')
			.populate('packageId', 'title')
			.skip(skip)
			.limit(limit)
			.sort({ updatedAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to fetch Visitors", err);
					return cb(responseUtilities.sendResponse(500, null, "getAllApprovedVisitorsList", null, null));
				};
				if (!res) {
					return cb(responseUtilities.sendResponse(400, "Visitor not found", "getAllApprovedVisitorsList", null, null));
				}
				let DTS = {
					visitors: res,
					count: count,
					pageLimit: limit
				}
				return cb(null, responseUtilities.sendResponse(200, "Approved visitor list fetched", "getAllApprovedVisitorsList", DTS, null));
		});
	});
};

exports.activateApprovedVisitorsPass = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId || !data.visitorId || (data.visitorId.length == 0)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "activateApprovedVisitorsPass", null, data.req.signature));
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(activateVisitorsPass, data));
	waterfallFunctions.push(async.apply(updateVisitorsPassStatus, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for activate visitor pass
 */
const activateVisitorsPass = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId || !data.visitorId || (data.visitorId.length == 0)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "activateVisitorsPass", null, data.req.signature));
	}
	console.log("data.eventDetails ", data.eventDetails);
	if(data.eventDetails && data.eventDetails.passActivatedStatus && data.eventDetails.passActivatedStatus.isVisitorPassActivated == false){
		let DTS = {
			isVisitorPassActivated: data.eventDetails.passActivatedStatus.isVisitorPassActivated
		}
		return cb(responseUtilities.sendResponse(400, "Please activate visitors pass from event first", "activateVisitorsPass", DTS, data.req.signature));
	}
	let findData = {
		isDeleted: false,
        isBlocked: false,
        eventId: data.eventId,
        isPackagePurchased: true,
		status: "Approved",
		_id: { $in: data.visitorId }
	};
	let fetchData = {
        interestTopics: 0,
		isBlocked: 0,
		isDeleted: 0,
    }

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	console.log("findData ", findData);
	let visitorIds = [];
	Visitors.find(findData, fetchData)
		.populate({
			path: 'eventId',
			model: 'event',
			select: 'name startDate endDate coverImage eventDescription category',
		})
		.exec((err, res) => {
			if (err) {
				console.error("Unable to fetch Visitors", err);
				return cb(responseUtilities.sendResponse(500, null, "activateVisitorsPass", null, null));
			};
			if(res.length > 0){
                for (let i in res) {
                    emailUtilities.sendMailToVisitorsForPassActivation(res[i], (errE, resE) => {
                        if (errE) {
                            console.log("mail error ", errE);
                        }
                        if(resE && (resE.status == 200) && (resE.statusText == "OK")){
                            console.log("mail sent sucess.....")
                            visitorIds.push(res[i]._id);
                        }
                        if(Number(i)+1 == res.length){
                            console.log("visitorIds ", visitorIds);
                            data.visitorIds = visitorIds;
                            return cb(null, responseUtilities.sendResponse(200, "Mail sent to media", "activateVisitorsPass", null, null)); 
                        }
                    });
                }
            }else{
				data.visitorIds = visitorIds;
                return cb(null, responseUtilities.sendResponse(200, "No visitor left for activate pass", "activateVisitorsPass", null, null));
            }
	});
}
exports.activateVisitorsPass = activateVisitorsPass;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for update visitor pass status
 */
const updateVisitorsPassStatus = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    console.log("visitor data ", data.visitorIds);
    if(data.visitorIds && data.visitorIds.length > 0){
        let findData = {
            isDeleted: false,
            isBlocked: false,
            eventId: data.eventId,
            isPackagePurchased: true,
			status: "Approved",
            _id: { $in: data.visitorIds }
        };

        let updateData = {
            $set: {
                "isPassActivated": true
            }
        };
        console.log("findData ", findData);
        Visitors.updateMany(findData, updateData,{ multi:true })
            .exec((err, res) => {
                if (err) {
                    return cb(responseUtilities.sendResponse(500, null, "updateVisitorsPassStatus", null, null));
                }
                if (!res) {
                    return cb(responseUtilities.sendResponse(400, null, "updateVisitorsPassStatus", null, null));
                }
                return cb(null, responseUtilities.sendResponse(200, "Activated", "updateVisitorsPassStatus", null, null));
            })
    }else{
        return cb(null, responseUtilities.sendResponse(200, "Not activated", "updateVisitorsPassStatus", null, null));
    }
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for updating visitor purchase status
 */
exports.updateVisitorPurchaseStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.visitorId || !JSON.stringify(data.isPackagePurchased)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitorPurchaseStatus", null, data.req.signature));

	}
	let findData = {
		_id: data.visitorId
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	let updateData = {
		isPackagePurchased: data.isPackagePurchased
	};

	Visitors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Visitors", err);
			return cb(responseUtilities.sendResponse(500, null, "updateVisitorPurchaseStatus", null, null));
		};
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "Visitor not found", "updateVisitorPurchaseStatus", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Visitor purchase status updated", "updateVisitorPurchaseStatus", null, null));
	});
};