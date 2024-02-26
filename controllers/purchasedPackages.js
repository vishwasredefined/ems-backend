const async = require("async");
//helper
const responseUtilities = require("../helpers/sendResponse");
const { getUTCStartDate, getUTCEndDate } = require("../helpers/security");
let emailUtilities = require("../helpers/email");

const role = JSON.parse(process.env.role);
const atob = require('atob');
const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
// const pdf = require('pdf-creator-node');
const pdf = require('html-pdf-node');
const AWS = require('aws-sdk');

//models
const PurchasedPackages = require("../models/purchasedPackages");
const Events = require("../models/events");
const Sponsors = require("../models/sponsors");
const Speakers = require("../models/speakers");
const Exhibitors = require("../models/exhibitors");
const Medias = require("../models/medias");
const Tickets = require("../models/tickets");
const Packages = require("../models/packages");
const Visitors = require("../models/visitors");

const events = require("../controllers/events");
const visitors = require("../controllers/visitors");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting Purchased Packages
 */
exports.getPurchasedPackages = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let allPackagesTypes = JSON.parse(process.env.PACKAGES_TYPES);

    let findData = {
        // isDeleted: false,
    };

    if (data.date) {
        findData.date = getUTCStartDate(data.date);
    };

    if (data.packageType) {
        findData.packageType = data.packageType
    };

    if (data.req.auth.role == role.user) {
        findData.userId = data.req.auth.id //User gets only his purchased passes
        findData.packageType = allPackagesTypes.VISITOR_PASS
    };
    console.log("FindData for Purchased Packages => ", findData)
    let populateData = [];
    populateData[0] = {
        path: "eventId",
        select: "name startDate endDate venue",
        populate: {
            path: "venue.country venue.state venue.city"
        },
        model: "event"
    }
    populateData[1] = {
        path: "userId",
        select: "name userMeta profilePicture",
        model: "User"
    }
    populateData[2] = {
        path: "packageId",
        select: "type title description currencyId price",
        populate: {
            path: "currencyId"
        },
        model: "packages"
    }
    populateData[3] = {
        path: "visitorId",
        select: "email name title profilePicture",
        model: "visitors"
    }
    populateData[4] = {
        path: "transactionId",
        select: "txnId transactionType amount createdAt invoiceNumber orderId",
        model: "transactions"
    }
    PurchasedPackages.find(findData)
        .populate(populateData)
        .sort({ createdAt: -1 })
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "getPurchasedPackages", null, null));
            }
            // console.log("Res => ", res)
            return cb(null, responseUtilities.sendResponse(200, "Purchased Packages(Passes) fetched", "getPurchasedPackages", res, null));
        });
};

//Contoller for event agenda by id
exports.getPurchasedPackageById = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.id) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "getPurchasedPackageById", null, data.req.signature));
    }

    let findData = {
        _id: data.id,
    };
    console.log("Find PuchasedPackage by id", findData)
    let populateData = [];
    populateData[0] = {
        path: "eventId",
        select: "name startDate endDate venue",
        populate: {
            path: "venue.country venue.state venue.city"
        },
        model: "event"
    }
    populateData[1] = {
        path: "userId",
        select: "name userMeta profilePicture",
        model: "User"
    }
    populateData[2] = {
        path: "packageId",
        select: "type title description currencyId price",
        populate: {
            path: "currencyId"
        },
        model: "packages"
    }
    populateData[3] = {
        path: "visitorId",
        select: "email name title profilePicture",
        model: "visitors"
    }
    populateData[4] = {
        path: "transactionId",
        select: "txnId transactionType amount createdAt invoiceNumber orderId",
        model: "transactions"
    }

    PurchasedPackages.findOne(findData)
        .populate(populateData)
        .exec((err, res) => {
            if (err) {
                console.error("Unable to get Event agenda: ", err);
                return cb(responseUtilities.sendResponse(500, null, "getEventAgenda", null, null));
            }
            if (!res) {
                return cb(responseUtilities.sendResponse(400, "Event pass not found", "getEventAgenda", null, data.req.signature));
            }
            return cb(null, responseUtilities.sendResponse(200, "Purchased Package(Pass) fetched", "getPurchasedPackages", res, null));
        });
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for activating Passes.
 */
const activatePurchasedPasses = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId || !data.packageType || !["Visitor", "Sponsor", "Exhibitor", "Speaker", "Media"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "activatePurchasedPasses", null, data.req.signature));
    };

    console.log("Incoming Data => ", data)

    data.checkIfExpiredEvent = true;
    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getEventById, data));
    // waterfallFunctions.push(async.apply(getAllPurchasedPassesForActivation, data));
    // waterfallFunctions.push(async.apply(activatePasses, data));
    async.waterfall(waterfallFunctions, cb);
}
exports.activatePurchasedPasses = activatePurchasedPasses;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting event data
 */
const getEventById = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "checkEventExists", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        expired: false,
        isActive: true,
        _id: data.eventId
    };

    Events.findOne(findData)
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "checkEventExists", null, null));
            }
            if(!res){
                return cb(responseUtilities.sendResponse(400, "Event does not exists", "checkEventExists", null, null));
            }
            return cb(null, responseUtilities.sendResponse(200, "Event data fetched successfully", "checkEventExists", res, null));
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting Purchased Packages to generate ticket
 */
const getAllPurchasedPassesForActivation = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    let findData = {
        isDeleted: false,
        packageType: data.packageType,
        isUpgraded: false
    };
    console.log("FindData for Purchased Packages => ", findData)
    PurchasedPackages.find(findData)
        .sort({ createdAt: -1 })
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "getPurchasedPackages", null, null));
            }
            return cb(null, responseUtilities.sendResponse(200, "Purchased Packages(Passes) fetched", "getPurchasedPackages", res, null));
        });
};
