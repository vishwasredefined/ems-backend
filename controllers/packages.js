const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

const path = require("path");

//helper
const responseUtilities = require("../helpers/sendResponse");

//models
const Packages = require("../models/packages");
const Visitors = require("../models/visitors");
const Exhibitors = require("../models/exhibitors");
const Sponsors = require("../models/sponsors");

const role = JSON.parse(process.env.role);

//controllers
const events = require("../controllers/events");
const { getEventById } = require("./events");


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Package Controller
 */
exports.addPackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.eventId || !data.type || !data.description) {  // || !JSON.stringify(data.isLimitedQuantity)
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addPackage", null, data.req.signature));
	};

	let allPackagesTypes = JSON.parse(process.env.PACKAGES_TYPES);
	console.log("allPackagesTypes => ", allPackagesTypes)
	if ((data.type != allPackagesTypes.VISITOR_PASS) && !JSON.stringify(data.quantity)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addPackage", null, data.req.signature));
	};

	if (![allPackagesTypes.EXHIBITOR, allPackagesTypes.SPONSOR, allPackagesTypes.VISITOR_PASS].includes(data.type)) {
		return cb(responseUtilities.sendResponse(400, "Invalid type of Package selected", "addPackage", null, data.req.signature));
	};

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(addMemberPackage, data));
	async.waterfall(waterfallFunctions, cb);

};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Add member package
 */
const addMemberPackage = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.type || !data.description) { 
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addMemberPackage", null, data.req.signature));
	};
	if(data.eventDetails && (data.eventDetails.category == "FREE") && (data.type == "Visitor") && (parseInt(data.price) > 0)){
		return cb(responseUtilities.sendResponse(400, "Price can't be more than zero for exclusive event", "addMemberPackage", null, data.req.signature));
	}

	if(data.eventDetails && (data.eventDetails.category == "PAID") && (!JSON.stringify(data.price) || !data.currencyId)){  // || !JSON.stringify(data.isLimitedQuantity)
		return cb(responseUtilities.sendResponse(400, "Price and currency is required", "addMemberPackage", null, data.req.signature));
	}

    let insertData = {
		title: data.title,
		eventId: data.eventId,
		type: data.type,
		description: data.description,
		price: data.price,
		currencyId: data.currencyId,
		isLimitedQuantity: data.isLimitedQuantity,
		eventAdminId: data.req.auth.eventAdminId || data.req.auth.id
	};

	if (data.quantity) {
		insertData.quantity = data.quantity
	};

	Packages.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create Package: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "addMemberPackage", null, null)
			);
		};
		console.log("Package inserted....")
		return cb(null, responseUtilities.sendResponse(200, "Package added successfully", "addMemberPackage", null, data.req.signature));
	});
};

//Contoller for getting all speakers
exports.getAllPackages = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	if (data.type) {
		findData.type = data.type
	};

	Packages.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Could not get count for speakers: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getAllPackages",
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
		console.log("packages findData => ", findData)
		Packages.find(findData)
			.populate(" currencyId ")
			// .skip(skip)
			// .limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					console.error("Unable to get packages: ", err);
					return cb(
						responseUtilities.sendResponse(
							500,
							null,
							"getAllPackages",
							null,
							null
						)
					);
				}
				// console.log("package res => ", res)
				let sendData = {
					data: res,
					// count: count,
					// pageLimit: limit,
				};
				return cb(null, responseUtilities.sendResponse(200, "All Packages fetched for admin", "getAllPackages", sendData, null));
			});
	});
};

//controler for users
exports.getpackages = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		isActive: true
	};

	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
	// 	findData.eventAdminId = data.req.auth.id
	// }

	if (data.eventId) {
		if (!mongoose.Types.ObjectId.isValid(data.eventId)) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Invalid event id",
					"getpackages",
					null,
					data.req.signature
				)
			);
		}
		findData.eventId = data.eventId
	}
	if (data.type) {
		findData.type = data.type
	}
	Packages.find(findData)
		.populate(" currencyId ")
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Packages: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getpackages",
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
					"All Packages fetched",
					"getpackages",
					sendData,
					null
				)
			);
		});
};

//controler for users
exports.getpackagesByType = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = {
		isDeleted: false,
		isActive: true
	};

	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
	// 	findData.eventAdminId = data.req.auth.id
	// }

	if (data.eventId) {
		findData.eventId = data.eventId
	}
	if (data.type) {
		findData.type = data.type
	}
	Packages.find(findData)
		.populate("currencyId eventId")
		.populate([
			{
				path:"currencyId",
				model:"currencies"
			},
			{
				path: "eventId",
				select: "name venue startDate endDate category",
				populate: [
					{
						path: 'venue.country',
						model: 'countries'
					},
					{
						path: 'venue.state',
						model: 'states'
					},
					{
						path: 'venue.city',
						model: 'cities'
					},
					{
						path: 'managedBy',
						model: 'User'
					}
				],
				// model: "event"
			}
		])
		.sort({ price: -1 })
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Packages: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getpackages",
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
					"All Packages by type fetched",
					"getpackages",
					sendData,
					null
				)
			);
		});
};

//Contoller for media by id
const getPackageById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.packageId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getPackageById",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.id || data.packageId,
		isDeleted: false,
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	Packages.findOne(findData)
		.populate("currencyId eventId")
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Media: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getPackageById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						404,
						"Package not found",
						"getPackageById",
						null,
						data.req.signature
					)
				);
			}
			if (data.initiateTransaction) {
				data.amount = res?.price;
				data.currency = res?.currencyId?.code;
				data.usdAmount = res?.price; //Later this key will hold only usd Amount as its base currency.
			}
			let sendData = {
				data: res,
			};
			data.packageDetails = res;
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Package fetched by id",
					"getPackageById",
					sendData,
					null
				)
			);
		});
};
exports.getPackageById = getPackageById;

//Contoller for update package
exports.updatePackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updatePackage",
				null,
				null
			)
		);
	}
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(getPackageById, data));
	if(data.type == "Exhibitor"){
		waterfallFunctions.push(async.apply(verifyExhibitorQuantity, data));
	}
	if(data.type == "Sponsor"){
		waterfallFunctions.push(async.apply(verifySponsorQuantity, data));
	}
	if(data.type == "Visitor"){
		waterfallFunctions.push(async.apply(verifyVisitorQuantity, data));
	}
	waterfallFunctions.push(async.apply(updateMemberPackage, data));
	async.waterfall(waterfallFunctions, cb);
};

const verifyExhibitorQuantity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"verifyExhibitorQuantity",
				null,
				null
			)
		);
	}
	let findData = {
		packageId: data.packageId,
		eventId: data.eventId,
		status: "ASSIGNED",
		isActive: true,
		isDeleted: false
	};
	Exhibitors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Unable to get exhibitors: ", err);
			return cb(
				responseUtilities.sendResponse(
					400,
					"error getting packages",
					"verifyExhibitorQuantity",
					null,
					null
				)
			);
		}
		let assignedPackageCount = count || 0;
		console.log("assignedPackageCount ", assignedPackageCount);
		console.log("data.packageDetails ", data.packageDetails.quantity);
		console.log("data.quantity ", data.quantity);

		if(Number(data.quantity) < assignedPackageCount){
			return cb(
				responseUtilities.sendResponse(
					400,
					"You can not set quantity less than assigned exhibitors",
					"verifyExhibitorQuantity",
					null,
					null
				)
			);
		}else{
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					null,
					"verifyExhibitorQuantity",
					null,
					null
				)
			);
		}
	});
};

const verifySponsorQuantity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"verifySponsorQuantity",
				null,
				null
			)
		);
	}
	let findData = {
		packageId: data.packageId,
		eventId: data.eventId,
		status: "ASSIGNED",
		isActive: true,
		isDeleted: false
	};
	Sponsors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Unable to get exhibitors: ", err);
			return cb(
				responseUtilities.sendResponse(
					400,
					"error getting packages",
					"verifySponsorQuantity",
					null,
					null
				)
			);
		}
		let assignedPackageCount = count || 0;
		console.log("assignedPackageCount ", assignedPackageCount);
		console.log("data.packageDetails ", data.packageDetails.quantity);
		console.log("data.quantity ", data.quantity);

		if(Number(data.quantity) < assignedPackageCount){
			return cb(
				responseUtilities.sendResponse(
					400,
					"You can not set quantity less than assigned sponsors",
					"verifySponsorQuantity",
					null,
					null
				)
			);
		}else{
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					null,
					"verifySponsorQuantity",
					null,
					null
				)
			);
		}
	});
};

const verifyVisitorQuantity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"verifyVisitorQuantity",
				null,
				null
			)
		);
	}
	let findData = {
		packageId: data.packageId,
		eventId: data.eventId,
		status: "Approved",
		isPackagePurchased: true,
		parentMember: { $in: ["Visitor", "Admin"] },
		isBlocked: false,
		isDeleted: false
	};
	Visitors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Unable to get exhibitors: ", err);
			return cb(
				responseUtilities.sendResponse(
					400,
					"error getting packages",
					"verifyVisitorQuantity",
					null,
					null
				)
			);
		}
		let assignedPackageCount = count || 0;
		console.log("assignedPackageCount ", assignedPackageCount);
		console.log("data.packageDetails ", data.packageDetails.quantity);
		console.log("data.quantity ", data.quantity);

		if(
			data.eventDetails && 
			(data.eventDetails?.category == "PAID") && 
			data.packageDetails && 
			data.packageDetails?.isLimitedQuantity && 
			data.packageDetails?.quantity &&
			(Number(data.quantity) < assignedPackageCount) 
		){
			return cb(
				responseUtilities.sendResponse(
					400,
					"You can not set quantity less than assigned sponsors",
					"verifyVisitorQuantity",
					null,
					null
				)
			);
		}else{
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					null,
					"verifyVisitorQuantity",
					null,
					null
				)
			);
		}
	});
};

const updateMemberPackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateMemberPackage",
				null,
				null
			)
		);
	}

	let findData = {
		_id: data.packageId
	};
	let updateData = data;
	if(data.packageDetails && data.packageDetails.eventId && (data.packageDetails.eventId.category == "FREE") && (data.packageDetails.type == "Visitor") && data.price && (data.price > 0)){
		return cb(responseUtilities.sendResponse(400, "Price can't be more than zero for exclusive event", "updateMemberPackage", null, data.req.signature));
	}
	Packages.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update package", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateMemberPackage",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Package updated",
				"updateMemberPackage",
				null,
				null
			)
		);
	});
};

//Contoller for update event package status
exports.updatePackageStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId || !JSON.stringify(data.isActive)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updatePackageStatus",
				null,
				data.req.signature
			)
		);
	}

	let updateData = {
		isActive: data.isActive
	};
	let findData = { _id: data.packageId };


	Packages.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Event package status: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updatePackageStatus", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Event package not found",
					"updatePackageStatus",
					null,
					data.req.signature
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event package status updated",
				"updatePackageStatus",
				null,
				data.req.signature
			)
		);
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Package Controller
 */
exports.verifyPackageQuantity = function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.packageId || !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "verifyPackageQuantity", null, data.req.signature));
	};
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getPackageById, data));
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(verifyPackageQuantityStatus, data));
	async.waterfall(waterfallFunctions, cb);

};

const verifyPackageQuantityStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.packageId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"verifyPackageQuantityStatus",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		isBlocked: false,
		isDeleted: false,
		isPackagePurchased: true,
		status: "Approved",
		packageId: data.packageId,
		eventId: data.eventId,
		parentMember: { $in: ["Visitor", "Admin"] }
	}
	Visitors.countDocuments(findData, (err, count) => {
		if (err) {
			console.error("Unable to get visitors count: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "verifyPackageQuantityStatus", null, null)
			);
		}
		// let quantity = data.packageDetails ? data.packageDetails.quantity : 0;
		console.log("visitors count ", count);
		console.log("data.packageDetails.isLimitedQuantity", data.packageDetails?.isLimitedQuantity);
		console.log("data.packageDetails.quantity", data.packageDetails?.quantity);
		console.log("data.eventDetails.category", data.eventDetails?.category);

		let packageQuantityAvailable = true;
		if(
			data.eventDetails && 
			(data.eventDetails?.category == "PAID") && 
			data.packageDetails && 
			data.packageDetails.isLimitedQuantity && 
			data.packageDetails.quantity && 
			(Number(data.packageDetails.quantity) <= count)
		){
			console.log("inside right condition---------")
			packageQuantityAvailable = false;
		}

		let DTS = {
			// availableQuantity : ((count < quantity) ? (parseInt(quantity) - parseInt(count)) : 0)
			packageQuantityAvailable
		}
		// let message =  (quantity && (count >= quantity)) ? "All package quantity sold" : "Package quantity available";
		console.log("packageQuantityAvailable ", packageQuantityAvailable);

		if(packageQuantityAvailable == true){
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Package quantity available",
					"verifyPackageQuantityStatus",
					DTS,
					data.req.signature
				)
			);
		}else{
			return cb(
				responseUtilities.sendResponse(
					400,
					"All package quantity sold",
					"verifyPackageQuantityStatus",
					DTS,
					data.req.signature
				)
			);
		}
	});
};
exports.verifyPackageQuantityStatus = verifyPackageQuantityStatus