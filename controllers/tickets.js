const async = require("async");

//helper
const responseUtilities = require("../helpers/sendResponse");
let emailUtilities = require("../helpers/email");
let uploadFile = require("../helpers/uploadFile");

const atob = require('atob');
const mongoose = require("mongoose");
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const crypto = require("crypto");
const pdfGenerator = require('html-pdf-node');

//models
const Events = require("../models/events");
const Sponsors = require("../models/sponsors");
const Speakers = require("../models/speakers");
const Exhibitors = require("../models/exhibitors");
const Medias = require("../models/medias");
const Tickets = require("../models/tickets");
const Packages = require("../models/packages");
const Visitors = require("../models/visitors");

const events = require("../controllers/events");

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Controller for activating Passes.
 */
const activatePurchasedPasses = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId || !data.packageType || !["Visitor", "Sponsor", "Exhibitor", "Speaker", "Media"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "activatePurchasedPasses", null, data.req.signature));
    };
    // console.log("Incoming Data => ", data)

    data.checkIfExpiredEvent = true;

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getEventById, data));
    if (data.packageType == "Sponsor") {
		waterfallFunctions.push(async.apply(sendMailToSponsorsWithGeneratePassLink, data));
        waterfallFunctions.push(async.apply(activateSponsorPasses, data));
	}else if(data.packageType == "Speaker"){
        waterfallFunctions.push(async.apply(sendMailToSpeakersWithGeneratePassLink, data));
        waterfallFunctions.push(async.apply(activateSpeakersPasses, data));
    }else if(data.packageType == "Exhibitor"){
        waterfallFunctions.push(async.apply(sendMailToExhibitorsWithGeneratePassLink, data));
        waterfallFunctions.push(async.apply(activateExhibitorsPasses, data));
    }else if(data.packageType == "Media"){
        waterfallFunctions.push(async.apply(sendMailToMediaPartnersWithGeneratePassLink, data));
        waterfallFunctions.push(async.apply(activateMediaPartnerPasses, data));
    }else if(data.packageType == "Visitor"){
        waterfallFunctions.push(async.apply(sendMailToVisitors, data));
        waterfallFunctions.push(async.apply(activateVisitorPasses, data));
    }
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
        _id: data.eventId
    };

    Events.findOne(findData)
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "checkEventExists", null, null));
            }
            if(!res){
                return cb(responseUtilities.sendResponse(400, "Event expired", "checkEventExists", null, null));
            }
            data.eventDetails = res;
            return cb(null, responseUtilities.sendResponse(200, "Event data fetched successfully", "checkEventExists", res, null));
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for send mail with generate pass link
 */
const sendMailToSponsorsWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.packageType || !["Sponsor"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "activatePurchasedPasses", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        status: "ASSIGNED",
        eventId: data.eventId,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1
    }
    let sponsorIds = [];
    Sponsors.find(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToSponsors", null, null));
            }
            // console.log("sponsors ", res);
            if(res.length > 0){
                for (let i in res) {
                    res[i].memberType = "Sponsor"
                    emailUtilities.sendMailWithGeneratePassLink(res[i], (errE, resE) => {
                        if (errE) {
                            console.log("mail error ", errE);
                            // return cb(
                            //     responseUtilities.sendResponse(500, null, "sendMailToSponsors", null, null)
                            // );
                        }
                        if(resE && (resE.status == 200) && (resE.statusText == "OK")){
                            console.log("mail sent sucess.....")
                            sponsorIds.push(res[i]._id);
                        }
                        if(Number(i)+1 == res.length){
                            console.log("sponsorIds ", sponsorIds);
                            data.sponsorIds = sponsorIds;
                            return cb(null, responseUtilities.sendResponse(200, "Mail sent to sponsor", "sendMailToSponsors", null, null)); 
                        }
                    });
                }
            }else{
                data.sponsorIds = sponsorIds;
                return cb(null, responseUtilities.sendResponse(200, "No sponsor left for activate pass", "sendMailToSponsors", null, null));
            }
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for send mail with generate pass link
 */
const sendMailToSpeakersWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.packageType || !["Speaker"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "activatePurchasedPasses", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        status: "ASSIGNED",
        eventId: data.eventId,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1
    }
    let speakersIds = [];
    Speakers.find(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToSpeakers", null, null));
            }
            // console.log("speakers ", res);
            if(res.length > 0){
                for (let i in res) {
                    res[i].memberType = "Speaker"
                    emailUtilities.sendMailWithGeneratePassLink(res[i], (errE, resE) => {
                        if (errE) {
                            console.log("mail error ", errE);
                            // return cb(
                            //     responseUtilities.sendResponse(500, null, "sendMailToSpeakers", null, null)
                            // );
                        }
                        if(resE && (resE.status == 200) && (resE.statusText == "OK")){
                            console.log("mail sent sucess.....")
                            speakersIds.push(res[i]._id);
                        }
                        if(Number(i)+1 == res.length){
                            console.log("speakersIds ", speakersIds);
                            data.speakersIds = speakersIds;
                            return cb(null, responseUtilities.sendResponse(200, "Mail sent to speaker", "sendMailToSpeakers", null, null)); 
                        }
                    });
                }
            }else{
                data.speakersIds = speakersIds;
                return cb(null, responseUtilities.sendResponse(200, "No speaker left for activate pass", "sendMailToSpeakers", null, null));
            }
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for send mail with generate pass link
 */
const sendMailToExhibitorsWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.packageType || !["Exhibitor"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "activatePurchasedPasses", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        status: "ASSIGNED",
        eventId: data.eventId,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1
    }
    let exhibitorsIds = [];
    Exhibitors.find(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToExhibitors", null, null));
            }
            // console.log("exhibitor ", res);
            if(res.length > 0){
                for (let i in res) {
                    res[i].memberType = "Exhibitor"
                    emailUtilities.sendMailWithGeneratePassLink(res[i], (errE, resE) => {
                        if (errE) {
                            console.log("mail error ", errE);
                            // return cb(
                            //     responseUtilities.sendResponse(500, null, "sendMailToExhibitors", null, null)
                            // );
                        }
                        if(resE && (resE.status == 200) && (resE.statusText == "OK")){
                            console.log("mail sent sucess.....")
                            exhibitorsIds.push(res[i]._id);
                        }
                        if(Number(i)+1 == res.length){
                            console.log("exhibitorsIds ", exhibitorsIds);
                            data.exhibitorsIds = exhibitorsIds;
                            return cb(null, responseUtilities.sendResponse(200, "Mail sent to exhibitor", "sendMailToExhibitors", null, null)); 
                        }
                    });
                }
            }else{
                data.exhibitorsIds = exhibitorsIds;
                return cb(null, responseUtilities.sendResponse(200, "No exhibitor left for activate pass", "sendMailToExhibitors", null, null));
            }
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for send mail with generate pass link
 */
const sendMailToMediaPartnersWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.packageType || !["Media"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "activatePurchasedPasses", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        status: "ASSIGNED",
        eventId: data.eventId,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1
    }
    let mediaIds = [];
    Medias.find(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToMedia", null, null));
            }
            // console.log("media ", res);
            if(res.length > 0){
                for (let i in res) {
                    res[i].memberType = "Media"
                    emailUtilities.sendMailWithGeneratePassLink(res[i], (errE, resE) => {
                        if (errE) {
                            console.log("mail error ", errE);
                            // return cb(
                            //     responseUtilities.sendResponse(500, null, "sendMailToMedia", null, null)
                            // );
                        }
                        if(resE && (resE.status == 200) && (resE.statusText == "OK")){
                            console.log("mail sent sucess.....")
                            mediaIds.push(res[i]._id);
                        }
                        if(Number(i)+1 == res.length){
                            console.log("mediaIds ", mediaIds);
                            data.mediaIds = mediaIds;
                            return cb(null, responseUtilities.sendResponse(200, "Mail sent to media", "sendMailToMedia", null, null)); 
                        }
                    });
                }
            }else{
                data.mediaIds = mediaIds;
                return cb(null, responseUtilities.sendResponse(200, "No media left for activate pass", "sendMailToMedia", null, null));
            }
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for send mail with generate pass link
 */
const sendMailToVisitors = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.packageType || !["Visitor"].includes(data.packageType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "sendMailToVisitor", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        eventId: data.eventId,
        isPackagePurchased: true,
        parentMember: "Visitor",
        status: "Approved"
    };

    let dataToFetch = {
        firstName: 1,
        lastName: 1,
        email: 1,
        mobile:1,
    }
    let visitorIds = [];
    Visitors.find(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToVisitor", null, null));
            }
            // console.log("visitor ", res);
            if(res.length > 0){
                for (let i in res) {
                    emailUtilities.sendMailToVisitorsForPassActivation(res[i], (errE, resE) => {
                        if (errE) {
                            console.log("mail error ", errE);
                            // return cb(
                            //     responseUtilities.sendResponse(500, null, "sendMailToVisitor", null, null)
                            // );
                        }
                        if(resE && (resE.status == 200) && (resE.statusText == "OK")){
                            console.log("mail sent sucess.....")
                            visitorIds.push(res[i]._id);
                        }
                        if(Number(i)+1 == res.length){
                            console.log("visitorIds ", visitorIds);
                            data.visitorIds = visitorIds;
                            return cb(null, responseUtilities.sendResponse(200, "Mail sent to visitors", "sendMailToVisitor", null, null)); 
                        }
                    });
                }
            }else{
                data.visitorIds = visitorIds;
                return cb(null, responseUtilities.sendResponse(200, "No visitor left for activate pass", "sendMailToVisitor", null, null));
            }
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for getting Purchased Packages to generate ticket
 */
const activateSponsorPasses = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
    // console.log("DATA ", data);
    if(data.sponsorIds && data.sponsorIds.length > 0){
        console.log("inside sponsor ids ", data.sponsorIds);
        let findData = {
            isBlocked: false,
            isActive: true,
            status: "ASSIGNED",
            eventId: data.eventId,
            _id: { $in: data.sponsorIds }
        };
        
        let updateData = {
            $set: {
                "isPassActivated": true
            }
        };
        Sponsors.updateMany(findData, updateData, { multi: true })
            .exec((err, res) => {
                if (err) {
                    return cb(responseUtilities.sendResponse(500, null, "activateSponsorPasses", null, null));
                }
                if (!res) {
                    return cb(responseUtilities.sendResponse(400, null, "activateSponsorPasses", null, null));
                }

                Events.updateOne({ _id: data.eventId }, { "passActivatedStatus.isSponsorPassActivated": true })
                .exec((errE, resE) => {
                    if (errE) {
                        return cb(responseUtilities.sendResponse(500, null, "activateSponsorPasses", null, null));
                    }
                    return cb(null, responseUtilities.sendResponse(200, "Activated", "activateSponsorPasses", null, null));
                });
            });
    }else{
        return cb(null, responseUtilities.sendResponse(200, "Activated", "activateSponsorPasses", null, null));
    }
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for getting Purchased Packages to generate ticket
 */
const activateSpeakersPasses = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
    // console.log("DATA ", data);
    if(data.speakersIds && data.speakersIds.length > 0){
        let findData = {
            isBlocked: false,
            isActive: true,
            status: "ASSIGNED",
            eventId: data.eventId,
            _id: { $in: data.speakersIds }
        };
        
        let updateData = {
            $set: {
                "isPassActivated": true
            }
        };
        Speakers.updateMany(findData, updateData, { multi: true })
            .exec((err, res) => {
                if (err) {
                    return cb(responseUtilities.sendResponse(500, null, "activateSpeakerPasses", null, null));
                }
                if (!res) {
                    return cb(responseUtilities.sendResponse(400, null, "activateSpeakerPasses", null, null));
                }

                Events.updateOne({ _id: data.eventId }, { "passActivatedStatus.isSpeakerPassActivated": true })
                .exec((errE, resE) => {
                    if (errE) {
                        return cb(responseUtilities.sendResponse(500, null, "activateSpeakerPasses", null, null));
                    }
                    return cb(null, responseUtilities.sendResponse(200, "Activated", "activateSpeakerPasses", null, null));
                });
            });
    }else{
        return cb(null, responseUtilities.sendResponse(200, "Activated", "activateSpeakerPasses", null, null));
    }
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for getting Purchased Packages to generate ticket
 */
const activateExhibitorsPasses = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
    // console.log("DATA ", data);
    if(data.exhibitorsIds && data.exhibitorsIds.length > 0){
        let findData = {
            isBlocked: false,
            isActive: true,
            status: "ASSIGNED",
            eventId: data.eventId,
            _id: { $in: data.exhibitorsIds }
        };
        
        let updateData = {
            $set: {
                "isPassActivated": true
            }
        };
        Exhibitors.updateMany(findData, updateData, { multi: true })
            .exec((err, res) => {
                if (err) {
                    return cb(responseUtilities.sendResponse(500, null, "activateExhibitorPasses", null, null));
                }
                if (!res) {
                    return cb(responseUtilities.sendResponse(400, null, "activateExhibitorPasses", null, null));
                }

                Events.updateOne({ _id: data.eventId }, { "passActivatedStatus.isExhibitorPassActivated": true })
                .exec((errE, resE) => {
                    if (errE) {
                        return cb(responseUtilities.sendResponse(500, null, "activateExhibitorPasses", null, null));
                    }
                    return cb(null, responseUtilities.sendResponse(200, "Activated", "activateExhibitorPasses", null, null));
                });
            });
    }else{
        return cb(null, responseUtilities.sendResponse(200, "Activated", "activateExhibitorPasses", null, null));
    }
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for getting Purchased Packages to generate ticket
 */
const activateMediaPartnerPasses = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
    // console.log("DATA ", data);
    if(data.mediaIds && data.mediaIds.length > 0){
        let findData = {
            isBlocked: false,
            isActive: true,
            status: "ASSIGNED",
            eventId: data.eventId,
            _id: { $in: data.mediaIds }
        };
        
        let updateData = {
            $set: {
                "isPassActivated": true
            }
        };
        Medias.updateMany(findData, updateData, { multi: true })
            .exec((err, res) => {
                if (err) {
                    return cb(responseUtilities.sendResponse(500, null, "activateMediaPasses", null, null));
                }
                if (!res) {
                    return cb(responseUtilities.sendResponse(400, null, "activateMediaPasses", null, null));
                }

                Events.updateOne({ _id: data.eventId }, { "passActivatedStatus.isMediaPassActivated": true })
                .exec((errE, resE) => {
                    if (errE) {
                        return cb(responseUtilities.sendResponse(500, null, "activateMediaPasses", null, null));
                    }
                    return cb(null, responseUtilities.sendResponse(200, "Activated", "activateMediaPasses", null, null));
                });
            });
    }else{
        return cb(null, responseUtilities.sendResponse(200, "Activated", "activateMediaPasses", null, null));
    }
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for activate visitor pass
 */
const activateVisitorPasses = async function (data, response, cb) {
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
            parentMember: "Visitor",
            status: "Approved",
            _id: { $in: data.visitorIds }
        };

        let updateData = {
            $set: {
                "isPassActivated": true
            }
        };
        // console.log("findData ", findData);
        
        Visitors.updateMany(findData, updateData,{ multi:true })
            .exec((err, res) => {
                if (err) {
                    return cb(responseUtilities.sendResponse(500, null, "activateVisitorPasses", null, null));
                }
                if (!res) {
                    return cb(responseUtilities.sendResponse(400, null, "activateVisitorPasses", null, null));
                }

                Events.updateOne({ _id: data.eventId }, { "passActivatedStatus.isVisitorPassActivated": true })
                .exec((errE, resE) => {
                    if (errE) {
                        return cb(responseUtilities.sendResponse(500, null, "activateVisitorPasses", null, null));
                    }
                    if (!resE) {
                        return cb(responseUtilities.sendResponse(400, "Event not updated", "activateVisitorPasses", null, null));
                    }
                    return cb(null, responseUtilities.sendResponse(200, "Activated", "activateVisitorPasses", null, null));
                });
            })
    }else{
        Events.updateOne({ _id: data.eventId }, { "passActivatedStatus.isVisitorPassActivated": true })
        .exec((errEv, resEv) => {
            if (errEv) {
                return cb(responseUtilities.sendResponse(500, null, "activateVisitorPasses", null, null));
            }
            if (!resEv) {
                return cb(responseUtilities.sendResponse(400, "Event not updated", "activateVisitorPasses", null, null));
            }
            return cb(null, responseUtilities.sendResponse(200, "Activated", "activateVisitorPasses", null, null));
        });
    }
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for downloading Passes.
 */
const showDetailsAndDownloadPass = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId || !data.memberType || !data.packageId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showDetailsAndDownloadPass", null, data.req.signature));
    };
    // console.log("Incoming Data => ", data)

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(events.getEventById, data));
    waterfallFunctions.push(async.apply(checkForInvalidPackage, data));

    if(data.memberType == "Sponsor"){
        waterfallFunctions.push(async.apply(validateSponsorPackageTicket, data));
    }else if(data.memberType == "Speaker"){
        waterfallFunctions.push(async.apply(validateSpeakerPackageTicket, data));
    }else if(data.memberType == "Exhibitor"){
        waterfallFunctions.push(async.apply(validateExhibitorPackageTicket, data));
    }else if(data.memberType == "Media"){
        waterfallFunctions.push(async.apply(validateMediaPartnerPackageTicket, data));
    }

    waterfallFunctions.push(async.apply(createVisitorWhileGeneratePass, data));
    waterfallFunctions.push(async.apply(createTicketWhileGeneratePass, data));
    waterfallFunctions.push(async.apply(createPassPdf, data));
    waterfallFunctions.push(async.apply(updateVisitorPassUrl, data));
    async.waterfall(waterfallFunctions, cb);
}
exports.showDetailsAndDownloadPass = showDetailsAndDownloadPass;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Visitor package valid
 */
const checkForInvalidPackage = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId || !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkForInvalidPackage", null, null));
	};

	let findData = {
		_id: data.packageId,
        isDeleted: false
	};

	Packages.findOne(findData).populate("currencyId").exec((err, package) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkForInvalidPackage", null, null));
		}
		if (!package) {
			return cb(responseUtilities.sendResponse(400, "Package not found.", "checkForInvalidPackage", null, data.req.signature));
		} 
        if (!package.isActive) {
			return cb(responseUtilities.sendResponse(400, "Package not active.", "checkForInvalidPackage", null, data.req.signature));
		} 
        if (!package.type || package.type != "Visitor") {
			return cb(responseUtilities.sendResponse(400, "Invalid Package selected.", "checkForInvalidPackage", null, data.req.signature));
		} 
        if (!package.eventId || package.eventId.toString() != data.eventId.toString()) {
			return cb(responseUtilities.sendResponse(400, "Package selected does not belong to this event.", "checkForInvalidPackage", null, data.req.signature));
		}
        data.packageDetails = package;
        return cb(null, responseUtilities.sendResponse(200, "Package fetched successfully", "checkForInvalidPackage", null, null));
		
	});
}
exports.checkForInvalidPackage = checkForInvalidPackage;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Visitor package valid
 */
const validateSponsorPackageTicket = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId || !data.eventId || !data.memberType || !data.memberId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkForInvalidPackage", null, null));
	};
    // console.log("all data ", data);
	let findData = {
        eventId: data.eventId,
		_id: data.memberId,
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        allotedPackageDetails: { $exists: true, $ne: [] }
	};
    let fetchData = {
        allotedPackageDetails: 1,
        isPassActivated: 1
    }
	Sponsors.findOne(findData, fetchData).exec((err, sponsor) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkForInvalidSponsor", null, null));
		}
		if (!sponsor) {
			return cb(responseUtilities.sendResponse(400, "Sponsor not found.", "checkForInvalidSponsor", null, null));
		} 
        let findTicket = { 
            eventId: data.eventId,
            packageId: data.packageId,
            sponsorId: data.memberId
        }
        Tickets.countDocuments(findTicket).exec((errT, tickets) => {
            if (errT) {
                return cb(responseUtilities.sendResponse(500, null, "checkForTicketCount", null, null));
            }
            if(sponsor.allotedPackageDetails && (sponsor.allotedPackageDetails.length > 0)){
                for(let i=0; i < sponsor.allotedPackageDetails.length; i++){
                    // console.log("dataaaaaa ", sponsor.allotedPackageDetails[i])
                    if((sponsor.allotedPackageDetails[i].packageId+"") == (data.packageId+"")){
                        if(tickets >= (sponsor.allotedPackageDetails[i]?.noOfTickets)){
                            return cb(responseUtilities.sendResponse(400, "No tickets available in this package to book", "checkForTicketCount", null, null));
                        }
                    }
                    if((Number(i) + 1) == sponsor.allotedPackageDetails.length){
                        data.sponsorDetails = sponsor;
                        return cb(null, responseUtilities.sendResponse(200, "Sponsor fetched successfully", "checkForTicketCount", null, null));
                    }
                }
            }else{
                return cb(responseUtilities.sendResponse(400, "No package has been assigned ticket", "checkForTicketCount", null, null));
            }
        });
	});
}
exports.validateSponsorPackageTicket = validateSponsorPackageTicket;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Visitor package valid
 */
const validateSpeakerPackageTicket = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId || !data.eventId || !data.memberType || !data.memberId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkForInvalidPackage", null, null));
	};
    // console.log("all data ", data);
	let findData = {
        eventId: data.eventId,
		_id: data.memberId,
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        allotedPackageDetails: { $exists: true, $ne: [] }
	};
    let fetchData = {
        allotedPackageDetails: 1,
        isPassActivated: 1
    }
	Speakers.findOne(findData, fetchData).exec((err, speaker) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkForInvalidSponsor", null, null));
		}
		if (!speaker) {
			return cb(responseUtilities.sendResponse(400, "Speaker not found.", "checkForInvalidSponsor", null, null));
		} 
        let findTicket = { 
            eventId: data.eventId,
            packageId: data.packageId,
            speakerId: data.memberId
        }
        Tickets.countDocuments(findTicket).exec((errT, tickets) => {
            if (errT) {
                return cb(responseUtilities.sendResponse(500, null, "checkForTicketCount", null, null));
            }
            if(speaker.allotedPackageDetails && (speaker.allotedPackageDetails.length > 0)){
                for(let i=0; i < speaker.allotedPackageDetails.length; i++){
                    // console.log("dataaaaaa ", speaker.allotedPackageDetails[i])
                    if((speaker.allotedPackageDetails[i].packageId+"") == (data.packageId+"")){
                        if(tickets >= (speaker.allotedPackageDetails[i]?.noOfTickets)){
                            return cb(responseUtilities.sendResponse(400, "No tickets available in this package to book", "checkForTicketCount", null, null));
                        }
                    }
                    if((Number(i) + 1) == speaker.allotedPackageDetails.length){
                        data.speakerDetails = speaker;
                        return cb(null, responseUtilities.sendResponse(200, "Sponsor fetched successfully", "checkForTicketCount", null, null));
                    }
                }
            }else{
                return cb(responseUtilities.sendResponse(400, "No package has been assigned ticket", "checkForTicketCount", null, null));
            }
        });
	});
}
exports.validateSpeakerPackageTicket = validateSpeakerPackageTicket;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If exhibitor package valid
 */
const validateExhibitorPackageTicket = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId || !data.eventId || !data.memberType || !data.memberId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkForInvalidPackage", null, null));
	};
    // console.log("all data ", data);
	let findData = {
        eventId: data.eventId,
		_id: data.memberId,
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        allotedPackageDetails: { $exists: true, $ne: [] }
	};
    let fetchData = {
        allotedPackageDetails: 1,
        isPassActivated: 1
    }
	Exhibitors.findOne(findData, fetchData).exec((err, exhibitor) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkForInvalidSponsor", null, null));
		}
		if (!exhibitor) {
			return cb(responseUtilities.sendResponse(400, "Speaker not found.", "checkForInvalidSponsor", null, null));
		} 
        let findTicket = { 
            eventId: data.eventId,
            packageId: data.packageId,
            exhibitorId: data.memberId
        }
        Tickets.countDocuments(findTicket).exec((errT, tickets) => {
            if (errT) {
                return cb(responseUtilities.sendResponse(500, null, "checkForTicketCount", null, null));
            }
            if(exhibitor.allotedPackageDetails && (exhibitor.allotedPackageDetails.length > 0)){
                for(let i=0; i < exhibitor.allotedPackageDetails.length; i++){
                    // console.log("dataaaaaa ", exhibitor.allotedPackageDetails[i])
                    if((exhibitor.allotedPackageDetails[i].packageId+"") == (data.packageId+"")){
                        if(tickets >= (exhibitor.allotedPackageDetails[i]?.noOfTickets)){
                            return cb(responseUtilities.sendResponse(400, "No tickets available in this package to book", "checkForTicketCount", null, null));
                        }
                    }
                    if((Number(i) + 1) == exhibitor.allotedPackageDetails.length){
                        data.exhibitorDetails = exhibitor;
                        return cb(null, responseUtilities.sendResponse(200, "Exhibitor fetched successfully", "checkForTicketCount", null, null));
                    }
                }
            }else{
                return cb(responseUtilities.sendResponse(400, "No package has been assigned ticket", "checkForTicketCount", null, null));
            }
        });
	});
}
exports.validateExhibitorPackageTicket = validateExhibitorPackageTicket;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If exhibitor package valid
 */
const validateMediaPartnerPackageTicket = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.packageId || !data.eventId || !data.memberType || !data.memberId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkForInvalidPackage", null, null));
	};
    // console.log("all data ", data);
	let findData = {
        eventId: data.eventId,
		_id: data.memberId,
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        allotedPackageDetails: { $exists: true, $ne: [] }
	};
    let fetchData = {
        allotedPackageDetails: 1,
        isPassActivated: 1
    }
	Medias.findOne(findData, fetchData).exec((err, media) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkForInvalidSponsor", null, null));
		}
		if (!media) {
			return cb(responseUtilities.sendResponse(400, "Speaker not found.", "checkForInvalidSponsor", null, null));
		} 
        let findTicket = { 
            eventId: data.eventId,
            packageId: data.packageId,
            mediaPartnerId: data.memberId
        }
        Tickets.countDocuments(findTicket).exec((errT, tickets) => {
            if (errT) {
                return cb(responseUtilities.sendResponse(500, null, "checkForTicketCount", null, null));
            }
            if(media.allotedPackageDetails && (media.allotedPackageDetails.length > 0)){
                for(let i=0; i < media.allotedPackageDetails.length; i++){
                    // console.log("dataaaaaa ", media.allotedPackageDetails[i])
                    if((media.allotedPackageDetails[i].packageId+"") == (data.packageId+"")){
                        if(tickets >= (media.allotedPackageDetails[i]?.noOfTickets)){
                            return cb(responseUtilities.sendResponse(400, "No tickets available in this package to book", "checkForTicketCount", null, null));
                        }
                    }
                    if((Number(i) + 1) == media.allotedPackageDetails.length){
                        data.mediaDetails = media;
                        return cb(null, responseUtilities.sendResponse(200, "Media fetched successfully", "checkForTicketCount", null, null));
                    }
                }
            }else{
                return cb(responseUtilities.sendResponse(400, "No package has been assigned ticket", "checkForTicketCount", null, null));
            }
        });
	});
}
exports.validateMediaPartnerPackageTicket = validateMediaPartnerPackageTicket;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for create visitor while generate ticket
 */
const createVisitorWhileGeneratePass = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberType || !data.memberId  || !["Sponsor", "Exhibitor", "Speaker", "Media"].includes(data.memberType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "createVisitorWhileGeneratePass", null, null));
    };
	if (!data.packageId) {
		return cb(responseUtilities.sendResponse(400, "Provide package details", "createVisitorWhileGeneratePass", null, null));
	}
	if (!data.name || !data.email) {
		return cb(responseUtilities.sendResponse(400, "Provide name and email", "createVisitorWhileGeneratePass", null, null));
	}
    let firstName = data.name.split(' ')[0];
    let lastName = data.name.split(' ')[1];
    // console.log("data...... ", data);
	let insertData = {
		email: data.email,
		firstName: firstName,
		lastName: lastName,
		name: data.name,
		packageId: data.packageId,
		isPackagePurchased: true,
        isPassActivated: true,
		source: "ADMIN_PANEL",
        status: "Approved",
	};
    if (data.eventDetails && data.eventDetails.managedBy) {
		insertData.eventAdminId = data.eventDetails.managedBy
		insertData.eventId = data.eventDetails._id
	}

    if(data.memberType == "Sponsor"){
        insertData.sponsorId = data.memberId
        insertData.parentMember = "Sponsor"
    }else if(data.memberType == "Speaker"){
        insertData.speakerId = data.memberId
        insertData.parentMember = "Speaker"
    }else if(data.memberType == "Media"){
        insertData.mediaPartnerId = data.memberId
        insertData.parentMember = "Media"
    }else if(data.memberType == "Exhibitor"){
        insertData.exhibitorId = data.memberId
        insertData.parentMember = "Exhibitor"
    }

    // console.log("all data ", data);
    console.log("insertVisitorData ", insertData);
    Visitors.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create visitor: ", err);
			return cb(responseUtilities.sendResponse(500, null, "createVisitor", null, null));
		};
		data.visitorData = res;
		return cb(null, responseUtilities.sendResponse(200, "Visitor added successfully", "createVisitor", null, null));
	});
};
exports.createVisitorWhileGeneratePass = createVisitorWhileGeneratePass;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for create visitor while generate ticket
 */
const createTicketWhileGeneratePass = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberType || !data.memberId  || !["Sponsor", "Exhibitor", "Speaker", "Media"].includes(data.memberType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "createTicketWhileGeneratePass", null, null));
    };
	if (!data.packageId) {
		return cb(responseUtilities.sendResponse(400, "Provide package details", "createTicketWhileGeneratePass", null, null));
	}

    if (!data.visitorData && !data.visitorData._id) {
		return cb(responseUtilities.sendResponse(400, "Provide visitor details", "createTicketWhileGeneratePass", null, null));
	}
    let ticketId = crypto.randomBytes(8).toString('hex');
	ticketId = ticketId.toUpperCase();
	ticketId = `TC${ticketId}`

	let insertData = {
		eventId: data.eventId,
		packageId: data.packageId,
		visitorId: (data.visitorData?._id),
        ticketNo: ticketId
	};
    if(data.memberType == "Sponsor"){
        insertData.sponsorId = data.memberId
    }else if(data.memberType == "Speaker"){
        insertData.speakerId = data.memberId
    }else if(data.memberType == "Media"){
        insertData.mediaPartnerId = data.memberId
    }else if(data.memberType == "Exhibitor"){
        insertData.exhibitorId = data.memberId
    }

    // console.log("all data ", data);
    console.log("insertTicketData ", insertData);
    Tickets.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create ticket: ", err);
			return cb(responseUtilities.sendResponse(500, null, "createTicket", null, null));
		};
		data.ticketData = res;
		return cb(null, responseUtilities.sendResponse(200, "Ticket added successfully", "createTicket", null, null));
	});
};
exports.createTicketWhileGeneratePass = createTicketWhileGeneratePass;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for creating pass pdf
 */
const createPassPdf = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.memberType || !["Sponsor", "Exhibitor", "Speaker", "Media", "Visitor"].includes(data.memberType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "generateEventPass", null, null));
    };
    
    let qrData = {
        "eventName": (data.eventDetails ? data.eventDetails.name : ""),
        "packageName": (data.packageDetails ? data.packageDetails.title : ""),
        "packageType": (data.packageDetails ? data.packageDetails.type : ""),
        "visitorName": (data.name ? data.name : ""),
        "visitorEmail": (data.email ? data.email : ""),
        "memberType": (data.memberType ? data.memberType : ""),
        "eventStartDate": (data.eventDetails ? data.eventDetails.startDate : ""),
        "eventEndDate": (data.eventDetails ? data.eventDetails.endDate : ""),
    }
    let qrDataConverted = JSON.stringify(qrData);
    // console.log("qrDataConverted", qrDataConverted);

    const qrOption = { 
        margin : 7,
        width : 175,
        errorCorrectionLevel: 'H'
      };

    QRCode.toDataURL(qrDataConverted,qrOption, function (err, url) {
        // console.log(url)
        if(err){
            return cb(responseUtilities.sendResponse(400, "unable to create QR Code", "generateQRCode", null, null));
        }

        // console.log("qr data ", url);
        let htmlCreated = `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Event Pass</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
          <style>
            body {
              font-family: "Inter", sans-serif !important;
            }
            p {
              margin: 5px 0px;
              color: #6f6f84;
              font-size: 13px;
            }
            p b {
              font-weight: 600;
              color: #000;
            }
            table {
              width: 100%;
            }
            table tr td {
              border: 0px;
              padding: 5px 10px;
            }
            .product tr td {
              padding: 5px 0px;
              color: #6f6f84;
              font-weight: 600;
              border-style: hidden !important;
            }
            .product {
              margin-top: 15px;
              border-bottom: #f1ac1c 1px solid;
            }
            .product tr td span {
              color: #222234;
            }
            .bill tr td {
              border-bottom: #f1ac1c 1px solid;
              padding: 5px 0px;
              font-weight: 600;
              color: #6f6f84;
            }
            .bill tr td span {
              color: #222234;
            }
          </style>
        </head>
        <body>
          <html>
          <body style="
                  background-color: #e2e1e0;
                  font-family: Open Sans, sans-serif;
                  font-size: 100%;
                  font-weight: 400;
                  line-height: 1.4;
                  color: #000;
                ">
            <div style="
                    max-width: 600px;
                    margin: 20px auto 10px;
                    background-color: #fff;
                    padding: 25px;
                  ">
              <table>
                <tr>
                  <td style="text-align: left; width: 50%">
                    <img style="max-width: 70px" src="https://staging.femzi.in/assets/img/tdefi_logo-transparent.png"
                      alt="bachana tours" />
                  </td>
                  <td style="text-align: right; font-weight: 400; width: 50%">
                    <h4 style="
                            text-align: right;
        
                            color: #6f6f84;
                            margin: 0;
        
                            font-size: 34px;
                            font-style: normal;
                            font-weight: 600;
                            line-height: normal;
                          ">
                      Event Pass
                    </h4>
                    <p style="
                            text-align: right;
                            color: #6f6f84;
                            font-size: 15px;
                            font-style: normal;
                            font-weight: 400;
                            margin: 0;
                            line-height: normal;
                          ">
                      Todayevents@tech.com
                    </p>
                  </td>
                </tr>
              </table>
              <table>
                <tr>
                  <td style="width: 50%">
                    <p style="margin-top: 30px">Visitor Name</p>
                    <p><b>${data?.name}</b></p>
                  </td>
                  <td style="width: 30%">
                    <p style="margin-top: 30px">Visitor Email</p>
                    <p><b>${data?.email}</b></p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr style="background: #fff6e3">
                  <td style="width: 50%">
                    <p>Event Name</p>
                    <p><b>${data.eventDetails?.name}</b></p>
                  </td>
                  <td style="width: 30%">
                    <p>Event Date</p>
                    <p><b>${(moment(data.eventDetails?.startDate).format('MMMM Do YYYY'))} - ${(moment(data.eventDetails?.endDate).format('MMMM Do YYYY'))}</b></p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr style="background: #fff6e3">
                  <td style="width: 50%">
                    <p>Package Name</p>
                    <p><b>${data.packageDetails?.title}</b></p>
                  </td>
                  <td style="width: 30%">
                    <p>Package Type</p>
                    <p><b>${data.packageDetails?.type} </b></p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0">
                <tr style="background: #fff6e3">
                  <td style="width: 50%">
                    <p style="margin-top: 30px">Member Type</p>
                    <p><b>${data?.memberType}</b></p>
                  </td>
                </tr>
              </table>
              <div style="background: #f1ac1c; height: 1px"></div>
              <div>
                <table cellpadding="0" cellspacing="0">
                    <tr>
                    <td style="width: 50%;text-align: center">
                        <img src=${url} alt="QR Code" />
                    </td>
                    </tr>
                </table>
              </div>
            </div>
          </body>
          </html>
        </body>
        </html>`;
        let options = {
            format: "A4",
            orientation: "portrait",
            border: "10mm",
        };
        pdfGenerator.generatePdf({ content: htmlCreated }, options).then(pdfBuffer => {
            // stream.pipe(fs.createWriteStream(path.join(__dirname,"..", "eventPass.pdf")));
            // console.log("pdfBuffer ", pdfBuffer);
            let eventName = (data.eventDetails?.name) ? data.eventDetails?.name : "";
            let dataTosend = {
                pdfBuffer,
                eventName,
                folder: "ticket"
            }
            uploadFile.upload(dataTosend, (errU, response) => {
                if (errU) {
                    return cb(
                        responseUtilities.sendResponse(500, null, "uploadFile", null, null)
                    );
                }
                console.log("response url ", response);
                data.passUrl = response.Location;
                data.visitorId = data.visitorData._id
                return cb(null, responseUtilities.sendResponse(200, "Mail sent to sponsor", "uploadFile", null, null)); 
            });
            
        }).catch(err => {
            console.log("pass generate error ", err);
            return cb(responseUtilities.sendResponse(500, "Pass not generated", "generatePdf", null, null));
        })
    })  
};
exports.createPassPdf = createPassPdf;

/**
* @param {JSON} data 
* @param {JSON} response 
* @param {Functon} cb 
* @description Contoller to shw event pass details
*/
const showEventPassDetails = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventData) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showEventPassDetails", null, null));
    };

    console.log("Incoming Data => ", data.eventData)
    let decoded = atob(data.eventData);
    console.log("decodedData ", decoded);
    let ticketData = decoded.split(',');
    let memberId = mongoose.Types.ObjectId(ticketData[0]);
    let eventId = mongoose.Types.ObjectId(ticketData[1]);
    let memberType = ticketData[2];
    let origin = ticketData[3];
    console.log("origin ", origin);
    if (!origin || origin != `${process.env.CLIENT_URL}`) {
        return cb(responseUtilities.sendResponse(400, "Request from wrong source", "wrongOriginRequest", null, null));
    }   

    console.log("eventId ", eventId, "memberId ", memberId, "memberType ", memberType);
    let dataToSend = {
        eventId: eventId,
        memberId: memberId,
        memberType: memberType
    }
    let waterfallFunctions = [];
    // waterfallFunctions.push(async.apply(getEventById, dataToSend));
    // waterfallFunctions.push(async.apply(validateForEventExpire, dataToSend));
    if(memberType == "Sponsor"){
        waterfallFunctions.push(async.apply(showSponsorTicketDetails, dataToSend));
    }else if(memberType == "Speaker"){
        waterfallFunctions.push(async.apply(showSpeakerTicketDetails, dataToSend));
    }else if(memberType == "Exhibitor"){
        waterfallFunctions.push(async.apply(showExhibitorTicketDetails, dataToSend));
    }else if(memberType == "Media"){
        waterfallFunctions.push(async.apply(showMediaPartnerTicketDetails, dataToSend));
    }
    async.waterfall(waterfallFunctions, cb);
}
exports.showEventPassDetails = showEventPassDetails;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for validating event expire
 */
const validateForEventExpire = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId) {
        return cb(responseUtilities.sendResponse(400, "Invalid link", "validateEventPassLink", null, data.req.signature));
    };
    let today = new Date().toISOString().split('T')[0];

    let findData = {
        isDeleted: false,
        expired: false,
        isActive: true,
        _id: data.eventId,
        endDate: { $gte: new Date(today)}
    };

    Events.findOne(findData)
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "validateEventPassLink", null, null));
            }
            if (!res) {
                return cb(responseUtilities.sendResponse(400, "Event expired", "validateEventPassLink", null, null));
            }
            return cb(null, responseUtilities.sendResponse(200, "Event details fetched successfully", "validateEventPassLink", null, null)); 
        });
};
exports.validateForEventExpire = validateForEventExpire;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Show sponsor ticket details
 */
const showSponsorTicketDetails = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showSponsorTicketDetails", null, null));
    };

    let findData = {
        _id: data.memberId,
        eventId: data.eventId,
        status: "ASSIGNED",
        isActive: true,
        isBlocked: false,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };
    let fetchData = {
        eventId: 1,
        allotedPackageDetails: 1,
        isPassActivated: 1
    };

    Sponsors.findOne(findData, fetchData)
        .populate('eventId', 'name currency startDate endDate saleStartDate saleEndDate coverImage eventType eventDescription expired')
        .populate('allotedPackageDetails.packageId', 'type title description')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "showSponsorTicketDetails", null, null));
            }
            if(!res){
                return cb(responseUtilities.sendResponse(400, "Invalid event pass link", "showSponsorTicketDetails", null, null));
            }

            let dataToSend = {
                memberData : res,
                memberType: data.memberType,
                packageData: []
            }
            if(res.allotedPackageDetails.length > 0){
                Tickets.aggregate([
                    {
                        $match : { eventId: res.eventId._id, sponsorId: res._id }
                    },
                    {
                        $group: {
                            _id: "$packageId",
                            ticketCount: { $sum: 1 }
                        } 
                    }
                ]).exec((errE, resE) => {
                    if (errE) {
                        return cb(
                            responseUtilities.sendResponse(500, null, "sendMailToSponsors", null, null)
                        );
                    }
                    console.log("ticket booked ", resE);
                    let availPackages = res.allotedPackageDetails;
                    // let checkArr = [];
                    if((availPackages.length > 0) && (resE.length > 0)){
                        // for(let i=0; i < availPackages.length; i++){
                        //     console.log(availPackages[i]);
                            // checkArr.push(resE.some(obj => ((obj._id+"") == (availPackages[i].packageId?._id+"")) && ((availPackages[i].noOfTickets) > obj.ticketCount)));
                            // console.log("checkArr ", checkArr);
                            // if((Number(i) + 1) == availPackages.length){
                            //     let uniqueData =  [...new Set(checkArr)];
                            //     console.log("uniquePackages ", uniqueData);
                            //     if((uniqueData.length == 1) && (uniqueData[0] == false)){
                            //         return cb(null, responseUtilities.sendResponse(400, "Event pass link expired/Reached maximum book ticket limit", "showSponsorTicketDetails", null, null)); 
                            //     }else{
                                    dataToSend.packageData = resE;
                                    // console.log("resE ", resE);
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showSponsorTicketDetails", dataToSend, null)); 
                        //         }
                        //     }
                        // }
                    }else{
                        // let checkBlankArr = [];
                        let bookedTickets = [];
                        for(let i=0; i < availPackages.length; i++){
                            console.log("each package ticket details", availPackages[i]);
                            // checkBlankArr.push(availPackages[i].noOfTickets);
                            bookedTickets.push({ _id: availPackages[i]?.packageId?._id, ticketCount: 0 })
                            if((Number(i) + 1) == availPackages.length){
                            //     let uniqueData =  [...new Set(checkBlankArr)];
                            //     console.log("uniquePackages ", uniqueData);
                            //     if((uniqueData.length == 1) && (uniqueData[0] == 0)){
                            //         return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showSponsorTicketDetails", null, null)); 
                            //     }else{
                                    dataToSend.packageData = bookedTickets;
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showSponsorTicketDetails", dataToSend, null));  
                            //     }
                            }
                        }
                    }
                });
            }else{
                return cb(null, responseUtilities.sendResponse(200, "No tickets assigned in package", "showSponsorTicketDetails", dataToSend, null));
            }
        });

};
exports.showSponsorTicketDetails = showSponsorTicketDetails;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Show speaker ticket details
 */
const showSpeakerTicketDetails = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showSpeakerTicketDetails", null, null));
    };

    let findData = {
        _id: data.memberId,
        eventId: data.eventId,
        status: "ASSIGNED",
        isActive: true,
        isBlocked: false,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };
    let fetchData = {
        eventId: 1,
        allotedPackageDetails: 1,
        isPassActivated: 1
    };

    Speakers.findOne(findData, fetchData)
        .populate('eventId', 'name currency startDate endDate saleStartDate saleEndDate coverImage eventType eventDescription expired')
        .populate('allotedPackageDetails.packageId', 'type title description')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "showSpeakerTicketDetails", null, null));
            }
            if(!res){
                return cb(responseUtilities.sendResponse(400, "Invalid event pass link", "showSpeakerTicketDetails", null, null));
            }

            let dataToSend = {
                memberData : res,
                memberType: data.memberType,
                packageData: []
            }
            if(res.allotedPackageDetails.length > 0){
                Tickets.aggregate([
                    {
                        $match : { eventId: res.eventId._id, speakerId: res._id }
                    },
                    {
                        $group: {
                            _id: "$packageId",
                            ticketCount: { $sum: 1 }
                        } 
                    }
                ]).exec((errE, resE) => {
                    if (errE) {
                        return cb(
                            responseUtilities.sendResponse(500, null, "sendMailToSpeakers", null, null)
                        );
                    }
                    console.log("ticket booked ", resE);
                    let availPackages = res.allotedPackageDetails;
                    // let checkArr = [];
                    if((availPackages.length > 0) && (resE.length > 0)){
                        // for(let i=0; i < availPackages.length; i++){
                        //     console.log(availPackages[i]);
                        //     checkArr.push(resE.some(obj => ((obj._id+"") == (availPackages[i].packageId?._id+"")) && ((availPackages[i].noOfTickets) > obj.ticketCount)));
                        //     console.log("checkArr ", checkArr);
                        //     if((Number(i) + 1) == availPackages.length){
                        //         let uniqueData =  [...new Set(checkArr)];
                        //         console.log("uniquePackages ", uniqueData);
                        //         if((uniqueData.length == 1) && (uniqueData[0] == false)){
                        //             return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showSpeakerTicketDetails", null, null)); 
                        //         }else{
                                    dataToSend.packageData = resE;
                                    // console.log("resE ", resE);
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showSpeakerTicketDetails", dataToSend, null)); 
                        //         }
                        //     }
                        // }
                    }else{
                        // let checkBlankArr = [];
                        let bookedTickets = [];
                        for(let i=0; i < availPackages.length; i++){
                            console.log("each package ticket details", availPackages[i]);
                            // checkBlankArr.push(availPackages[i].noOfTickets);
                            bookedTickets.push({ _id: availPackages[i]?.packageId?._id, ticketCount: 0 })
                            if((Number(i) + 1) == availPackages.length){
                                // let uniqueData =  [...new Set(checkBlankArr)];
                                // console.log("uniquePackages ", uniqueData);
                                // if((uniqueData.length == 1) && (uniqueData[0] == 0)){
                                //     return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showSpeakerTicketDetails", null, null)); 
                                // }else{
                                    dataToSend.packageData = bookedTickets;
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showSpeakerTicketDetails", dataToSend, null));  
                                // }
                            }
                        }
                    }
                });
            }else{
                return cb(null, responseUtilities.sendResponse(200, "No tickets assigned in package", "showSpeakerTicketDetails", dataToSend, null));
            }
        });

};
exports.showSpeakerTicketDetails = showSpeakerTicketDetails;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Show exhibitor ticket details
 */
const showExhibitorTicketDetails = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showExhibitorTicketDetails", null, null));
    };

    let findData = {
        _id: data.memberId,
        eventId: data.eventId,
        status: "ASSIGNED",
        isActive: true,
        isBlocked: false,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };
    let fetchData = {
        eventId: 1,
        allotedPackageDetails: 1,
        isPassActivated: 1
    };

    Exhibitors.findOne(findData, fetchData)
        .populate('eventId', 'name currency startDate endDate saleStartDate saleEndDate coverImage eventType eventDescription expired')
        .populate('allotedPackageDetails.packageId', 'type title description')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "showExhibitorTicketDetails", null, null));
            }
            if(!res){
                return cb(responseUtilities.sendResponse(400, "Invalid event pass link", "showExhibitorTicketDetails", null, null));
            }

            let dataToSend = {
                memberData : res,
                memberType: data.memberType,
                packageData: []
            }
            if(res.allotedPackageDetails.length > 0){
                Tickets.aggregate([
                    {
                        $match : { eventId: res.eventId._id, exhibitorId: res._id }
                    },
                    {
                        $group: {
                            _id: "$packageId",
                            ticketCount: { $sum: 1 }
                        } 
                    }
                ]).exec((errE, resE) => {
                    if (errE) {
                        return cb(
                            responseUtilities.sendResponse(500, null, "sendMailToSpeakers", null, null)
                        );
                    }
                    console.log("ticket booked ", resE);
                    let availPackages = res.allotedPackageDetails;
                    // let checkArr = [];
                    if((availPackages.length > 0) && (resE.length > 0)){
                        // for(let i=0; i < availPackages.length; i++){
                        //     console.log(availPackages[i]);
                        //     checkArr.push(resE.some(obj => ((obj._id+"") == (availPackages[i].packageId?._id+"")) && ((availPackages[i].noOfTickets) > obj.ticketCount)));
                        //     console.log("checkArr ", checkArr);
                        //     if((Number(i) + 1) == availPackages.length){
                        //         let uniqueData =  [...new Set(checkArr)];
                        //         console.log("uniquePackages ", uniqueData);
                        //         if((uniqueData.length == 1) && (uniqueData[0] == false)){
                        //             return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showExhibitorTicketDetails", null, null)); 
                        //         }else{
                                    dataToSend.packageData = resE;
                                    // console.log("resE ", resE);
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showExhibitorTicketDetails", dataToSend, null)); 
                        //         }
                        //     }
                        // }
                    }else{
                        // let checkBlankArr = [];
                        let bookedTickets = [];
                        for(let i=0; i < availPackages.length; i++){
                            console.log("each package ticket details", availPackages[i]);
                            // checkBlankArr.push(availPackages[i].noOfTickets);
                            bookedTickets.push({ _id: availPackages[i]?.packageId?._id, ticketCount: 0 })
                            if((Number(i) + 1) == availPackages.length){
                                // let uniqueData =  [...new Set(checkBlankArr)];
                                // console.log("uniquePackages ", uniqueData);
                                // if((uniqueData.length == 1) && (uniqueData[0] == 0)){
                                //     return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showExhibitorTicketDetails", null, null)); 
                                // }else{
                                    dataToSend.packageData = bookedTickets;
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showExhibitorTicketDetails", dataToSend, null));  
                                // }
                            }
                        }
                    }
                });
            }else{
                return cb(null, responseUtilities.sendResponse(200, "No tickets assigned in package", "showExhibitorTicketDetails", dataToSend, null));
            }
        });

};
exports.showExhibitorTicketDetails = showExhibitorTicketDetails;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Show media partner ticket details
 */
const showMediaPartnerTicketDetails = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showMediaPartnerTicketDetails", null, null));
    };

    let findData = {
        _id: data.memberId,
        eventId: data.eventId,
        status: "ASSIGNED",
        isActive: true,
        isBlocked: false,
        // allotedPackageDetails: { $exists: true, $ne: [] }
    };
    let fetchData = {
        eventId: 1,
        allotedPackageDetails: 1,
        isPassActivated: 1
    };

    Medias.findOne(findData, fetchData)
        .populate('eventId', 'name currency startDate endDate saleStartDate saleEndDate coverImage eventType eventDescription expired')
        .populate('allotedPackageDetails.packageId', 'type title description')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "showMediaPartnerTicketDetails", null, null));
            }
            if(!res){
                return cb(responseUtilities.sendResponse(400, "Invalid event pass link", "showMediaPartnerTicketDetails", null, null));
            }

            let dataToSend = {
                memberData : res,
                memberType: data.memberType,
                packageData: []
            }
            if(res.allotedPackageDetails.length > 0){
                Tickets.aggregate([
                    {
                        $match : { eventId: res.eventId._id, mediaPartnerId: res._id }
                    },
                    {
                        $group: {
                            _id: "$packageId",
                            ticketCount: { $sum: 1 }
                        } 
                    }
                ]).exec((errE, resE) => {
                    if (errE) {
                        return cb(
                            responseUtilities.sendResponse(500, null, "showMediaPartnerTicketDetails", null, null)
                        );
                    }
                    console.log("ticket booked ", resE);
                    let availPackages = res.allotedPackageDetails;
                    // let checkArr = [];
                    if((availPackages.length > 0) && (resE.length > 0)){
                        // for(let i=0; i < availPackages.length; i++){
                        //     console.log(availPackages[i]);
                        //     checkArr.push(resE.some(obj => ((obj._id+"") == (availPackages[i].packageId?._id+"")) && ((availPackages[i].noOfTickets) > obj.ticketCount)));
                        //     console.log("checkArr ", checkArr);
                        //     if((Number(i) + 1) == availPackages.length){
                        //         let uniqueData =  [...new Set(checkArr)];
                        //         console.log("uniquePackages ", uniqueData);
                        //         if((uniqueData.length == 1) && (uniqueData[0] == false)){
                        //             return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showMediaPartnerTicketDetails", null, null)); 
                        //         }else{
                                    dataToSend.packageData = resE;
                                    // console.log("resE ", resE);
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showMediaPartnerTicketDetails", dataToSend, null)); 
                        //         }
                        //     }
                        // }
                    }else{
                        // let checkBlankArr = [];
                        let bookedTickets = [];
                        for(let i=0; i < availPackages.length; i++){
                            console.log("each package ticket details", availPackages[i]);
                            // checkBlankArr.push(availPackages[i].noOfTickets);
                            bookedTickets.push({ _id: availPackages[i]?.packageId?._id, ticketCount: 0 })
                            if((Number(i) + 1) == availPackages.length){
                            //     let uniqueData =  [...new Set(checkBlankArr)];
                            //     console.log("uniquePackages ", uniqueData);
                            //     if((uniqueData.length == 1) && (uniqueData[0] == 0)){
                            //         return cb(null, responseUtilities.sendResponse(400, "Event pass link expired", "showMediaPartnerTicketDetails", null, null)); 
                            //     }else{
                                    dataToSend.packageData = bookedTickets;
                                    return cb(null, responseUtilities.sendResponse(200, "Ticket details fetched successfully", "showMediaPartnerTicketDetails", dataToSend, null));  
                            //     }
                            }
                        }
                    }
                });
            }else{
                return cb(null, responseUtilities.sendResponse(200, "No tickets assigned in package", "showMediaPartnerTicketDetails", dataToSend, null));
            }
        });

};
exports.showMediaPartnerTicketDetails = showMediaPartnerTicketDetails;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Show Packages details to generate ticket
 */
const getEventPassList = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventData) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "showEventPassDetails", null, null));
    };
 
    // console.log("Incoming Data => ", data.eventData)
    let decoded = atob(data.eventData);
     console.log("decodedData ", decoded);
    let ticketData = decoded.split(',');
    let memberId = mongoose.Types.ObjectId(ticketData[0]);
    let eventId = mongoose.Types.ObjectId(ticketData[1]);
    let memberType = ticketData[2];
    let origin = ticketData[3];
    console.log("origin ", origin);
    if (!origin || origin != `${process.env.CLIENT_URL}`) {
        return cb(responseUtilities.sendResponse(400, "Request from wrong source", "wrongOriginRequest", null, null));
    }  
 
    console.log("eventId ", eventId, "memberId ", memberId, "memberType ", memberType);
    let dataToSend = {
        eventId: eventId,
        memberId: memberId,
        memberType: memberType
    }
    let waterfallFunctions = [];
    // waterfallFunctions.push(async.apply(validateForEventExpire, dataToSend));
    waterfallFunctions.push(async.apply(getEventMemberPassList, dataToSend));
    async.waterfall(waterfallFunctions, cb);
    
};
exports.getEventPassList = getEventPassList;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting sponsor pass list
 */
const getEventMemberPassList = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.memberId || !data.memberType || !["Sponsor", "Exhibitor", "Speaker", "Media"].includes(data.memberType)) {
        return cb(responseUtilities.sendResponse(400, "Missing params", "getEventMemberPassList", null, null));
    };

    let findData = { 
        eventId: data.eventId,
    }

    if(data.memberType == "Sponsor"){
        findData.sponsorId = data.memberId
    }else if(data.memberType == "Speaker"){
        findData.speakerId = data.memberId
    }else if(data.memberType == "Media"){
        findData.mediaPartnerId = data.memberId
    }else if(data.memberType == "Exhibitor"){
        findData.exhibitorId = data.memberId
    }

    Tickets.find(findData)
		.populate('eventId', 'name')
        .populate('packageId', 'type title description')
        .populate('visitorId', 'name email firstName lastName')
        .populate('sponsorId', 'title name email phone designation company logo')
        .populate('exhibitorId', 'title name email phone designation company logo')
        .populate('speakerId', 'name email profilePicture about country designation')
        .populate('mediaPartnerId', 'title email mediaHouse designation mobile logo')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get ticket: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getDownloadedPassList", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Ticket not found",
						"getDownloadedPassList",
						null,
						null
					)
				);
			};
			return cb(null, responseUtilities.sendResponse(200, "Ticket list fetched successfully", "getDownloadedPassList", res, null));
		});
};
exports.getEventMemberPassList = getEventMemberPassList;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Download event pass 
 */
const downloadEventSinglePass = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.ticketId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "downloadEventSinglePass", null, null));
    };

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getTicketDetails, data));
    // waterfallFunctions.push(async.apply(createPassPdf, data));
    async.waterfall(waterfallFunctions, cb);
};
exports.downloadEventSinglePass = downloadEventSinglePass;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting sponsor pass list
 */
const getTicketDetails = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.ticketId) {
        return cb(responseUtilities.sendResponse(400, "Missing params", "getTicketDetails", null, null));
    };

    let findData = { 
        _id: data.ticketId,
    }

    Tickets.findOne(findData).populate('visitorId', 'name email firstName lastName passUrl')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get ticket: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getTicketDetails", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Ticket not found",
						"getTicketDetails",
						null,
						null
					)
				);
			};
            console.log("ticket data ", res);
            // let member_type = "Sponsor";
            // if(res.mediaPartnerId){
            //     member_type = "Media";
            // }else if(res.sponsorId){
            //     member_type = "Sponsor";
            // }else if(res.exhibitorId){
            //     member_type = "Exhibitor";
            // }else if(res.speakerId){
            //     member_type = "Speaker";
            // }
            // data.eventDetails = res.eventId;
            // data.packageDetails = res.packageId;
            // data.name = res.visitorId?.name;
            // data.email = res.visitorId?.email;
            // data.memberType = member_type;

            let dataToSend = {
                url: res?.visitorId?.passUrl
            }   

			return cb(null, responseUtilities.sendResponse(200, "Ticket downloaded successfully", "getTicketDetails", dataToSend, null));
		});
};
exports.getTicketDetails = getTicketDetails;

//controler to show event member pass details
exports.showEventMemeberPassDetails = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.memberType || !data.memberId || !data.eventId) {
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

	let memberType = data.memberType
	if (!["Speaker", "Sponsor", "Media", "Exhibitor"].includes(memberType)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid memberType",
				"getMembersDetail",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	if (memberType == "Sponsor") {
		waterfallFunctions.push(async.apply(showSponsorTicketDetails, data));
	}else if (memberType == "Speaker") {
		waterfallFunctions.push(async.apply(showSpeakerTicketDetails, data));
	} else if (memberType == "Media") {
		waterfallFunctions.push(async.apply(showMediaPartnerTicketDetails, data));
	} else if (memberType == "Exhibitor") {
		waterfallFunctions.push(async.apply(showExhibitorTicketDetails, data));
	} else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid memberType",
				"getMembersDetail",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterfallFunctions, cb);
};

//controler to get event member pass list
exports.getEventMemeberPassList = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.memberType || !data.memberId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getMemberPassList",
				null,
				data.req.signature
			)
		);
	}

	let memberType = data.memberType
	if (!["Speaker", "Sponsor", "Media", "Exhibitor"].includes(memberType)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid memberType",
				"getMemberPassList",
				null,
				data.req.signature
			)
		);
	}

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventMemberPassList, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for downloading Passes.
 */
const downloadEventMemeberPass = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId || !data.memberType || !data.packageId || !data.memberId || !["Speaker", "Sponsor", "Media", "Exhibitor"].includes(data.memberType)) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "downloadEventMemeberPass", null, data.req.signature));
    };

    // console.log("Incoming Data => ", data)

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getEventById, data));
    waterfallFunctions.push(async.apply(checkForInvalidPackage, data));

    if(data.memberType == "Sponsor"){
        waterfallFunctions.push(async.apply(validateSponsorPackageTicket, data));
    }else if(data.memberType == "Speaker"){
        waterfallFunctions.push(async.apply(validateSpeakerPackageTicket, data));
    }else if(data.memberType == "Exhibitor"){
        waterfallFunctions.push(async.apply(validateExhibitorPackageTicket, data));
    }else if(data.memberType == "Media"){
        waterfallFunctions.push(async.apply(validateMediaPartnerPackageTicket, data));
    }

    waterfallFunctions.push(async.apply(createVisitorWhileGeneratePass, data));
    waterfallFunctions.push(async.apply(createTicketWhileGeneratePass, data));
    waterfallFunctions.push(async.apply(createPassPdf, data));
    waterfallFunctions.push(async.apply(updateVisitorPassUrl, data));
    async.waterfall(waterfallFunctions, cb);
}
exports.downloadEventMemeberPass = downloadEventMemeberPass;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Download event pass 
 */
const downloadEventSinglePassByAdmin = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.ticketId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "downloadEventSinglePassByAdmin", null, null));
    };

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getTicketDetails, data));
    // waterfallFunctions.push(async.apply(createPassPdf, data));
    async.waterfall(waterfallFunctions, cb);
    
};
exports.downloadEventSinglePassByAdmin = downloadEventSinglePassByAdmin;

//Contoller for assigning event members(medias/speakers.....) to event
exports.assignMemberToEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"assignMemberToEvent",
				null,
				data.req.signature
			)
		);
	}

	console.log("=====in assign member to event")

	let waterfallFunctions = [];
    if (data.sponsorId) {
		if(data.isPackageAssign == true){
			waterfallFunctions.push(async.apply(sponsorPackagesCount, data));
			waterfallFunctions.push(async.apply(assignSponsorToTheEvent, data));
			waterfallFunctions.push(async.apply(sendMailToSponsorWithGeneratePassLink, data));			
		}
		if(data.isPackageAssign == false){
			waterfallFunctions.push(async.apply(unassignSponsorFromTheEvent, data));
		}
	} else if (data.speakerId) {
		if(data.isPackageAssign == true){
			waterfallFunctions.push(async.apply(assignSpeakerToTheEvent, data));
			waterfallFunctions.push(async.apply(sendMailToSpeakerWithGeneratePassLink, data));			
		}
		if(data.isPackageAssign == false){
			waterfallFunctions.push(async.apply(unassignSpeakerFromTheEvent, data));
		}
	} else if (data.exhibitorId) {
		if(data.isPackageAssign == true){
			waterfallFunctions.push(async.apply(exhibitorPackageCount, data));
			waterfallFunctions.push(async.apply(assignExhibitorToTheEvent, data));
			waterfallFunctions.push(async.apply(sendMailToExhibitorWithGeneratePassLink, data));			
		}
		if(data.isPackageAssign == false){
			waterfallFunctions.push(async.apply(unassignExhibitorFromTheEvent, data));
		}
	} else if (data.mediaId) {
		if (data.isPackageAssign == true) {
			waterfallFunctions.push(async.apply(assignMediaToTheEvent, data));
			waterfallFunctions.push(async.apply(sendMailToMediaPartnerWithGeneratePassLink, data));			
		}
		if (data.isPackageAssign == false) {
			waterfallFunctions.push(async.apply(unassignMediaFromEvent, data));
		}
	}  else {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Inavalid member",
				"assignMemberToEvent",
				null,
				data.req.signature
			)
		);
	}
	async.waterfall(waterfallFunctions, cb);
};

//find sponsor and package details
const sponsorPackagesCount = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let check = mongoose.Types.ObjectId;

	if (!data.sponsorId || !check.isValid(data.sponsorId)) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Media updated",
				"checkSponsorPackageCount",
				null,
				null
			)
		);
	}

	console.log("=====in assign sponsor to event")
	let findData = {
		_id: data.sponsorId
	}

	Sponsors.findOne(findData)
		.populate('packageId')
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to update speaker", err);
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

			console.log("Finding sponsors to assign => ", res)
			let packageIds = []
			let packageDetails = []
			let sponsorRes = JSON.parse(JSON.stringify(res))
			let packageData = { sponsorId: data.sponsorId };

			if (!res.packageId || !res.packageId.isActive) {
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
			console.log("=======package id====", res.packageId._id, res.packageId.isActive)
			if (!packageIds.includes((res.packageId._id).toString())) {
				packageData.packageId = (res.packageId._id).toString()
				sponsorsCount = ((res.packageId && (res.packageId._id).toString())) ? 1 : 0
				packageData["sponsorsCount"] = sponsorsCount
				packageData["quantity"] = (res.packageId && res.packageId.quantity) || 0
				packageDetails.push(packageData)
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
			if (quantity && (totalToAssign < quantity)) {
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
				"Event Exhibitor updating",
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
                    console.log("exhibitorCheckRes123 ", exhibitorCheckRes);
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
								"Exhibitor paackage found",
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
			if (quantity && (totalToAssign < quantity)) {
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

//assign speakers to the event
const assignSpeakerToTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.speakerId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"assignSpeakersToEvent",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.speakerId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED",
			allotedPackageDetails: (data.allotedPackageDetails ? data.allotedPackageDetails : []),
		}
	}
	Speakers.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateSpeaker",
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

// unassign speakers from event
const unassignSpeakerFromTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.speakerId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"unassignSponsorFromEvent",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.speakerId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW",
			allotedPackageDetails: [],
			isPassActivated: false
		}
	}
	Speakers.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update speaker", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateSpeaker",
					null,
					null
				)
			);
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event speaker updated",
				"updateSpeaker",
				null,
				null
			)
		);
	});
}

//find exhibitor and package details
const exhibitorPackageCount = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let check = mongoose.Types.ObjectId;

	if (!data.exhibitorId || !check.isValid(data.exhibitorId)) {
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Media updated",
				"checkExhibitorPackageCount",
				null,
				null
			)
		);
	}

	console.log("=====in assign exhibitor to event")
	let findData = {
		_id: data.exhibitorId
	}

	Exhibitors.findOne(findData)
		.populate('packageId')
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to update exhibitor", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"checkExhibitorPackages",
						null,
						null
					)
				);
			}

			console.log("Finding exhibitors to assign => ", res)
			let packageIds = []
			let packageDetails = []
			let packageData = { exhibitorId: data.exhibitorId };

			if (!res.packageId || !res.packageId.isActive) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Package not found",
						"getAssignedExhibitorPackageCount",
						null,
						data.req.signature
					)
				);
			}
			console.log("=======package id====", res.packageId._id, res.packageId.isActive)
			if (!packageIds.includes((res.packageId._id).toString())) {
				packageData.packageId = (res.packageId._id).toString()
				let exhibitorsCount = ((res.packageId && (res.packageId._id).toString())) ? 1 : 0
				packageData["exhibitorsCount"] = exhibitorsCount
				packageData["quantity"] = (res.packageId && res.packageId.quantity) || 0
				packageDetails.push(packageData)
			}
			

			console.log("=====exhibitor and package data=======", packageDetails)
			if (packageDetails.length) {

				for (let i in packageDetails) {

					let exhibitorsCheckRes = await checkExhibitorCount({ package: packageDetails[i] })

					if (!exhibitorsCheckRes.success) {
						return cb(
							responseUtilities.sendResponse(
								400,
								exhibitorsCheckRes.message || "Package not enough",
								"getAssignedExhibitorPackageCount",
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
								"checkExhibitorPackages",
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
						"checkExhibitorPackages",
						null,
						null
					)
				);
			}
		});
}

// assign exhibitors to the event
const assignExhibitorToTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.exhibitorId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateExhibitor",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.exhibitorId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED",
			allotedPackageDetails: (data.allotedPackageDetails ? data.allotedPackageDetails : []),
		}
	}
	Exhibitors.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update exhibitor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateExhibitor",
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
				"updateExhibitor",
				null,
				null
			)
		);
	});
}

// unassign exhibitors from event
const unassignExhibitorFromTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.exhibitorId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"unassignExhibitorFromEvent",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.exhibitorId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW",
			allotedPackageDetails: [],
			isPassActivated: false
		}
	}
	Exhibitors.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update exhibitor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateExhibitor",
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
				"updateExhibitor",
				null,
				null
			)
		);
	});
}

//assign medias to the event
const assignMediaToTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.mediaId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateMedia",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.mediaId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED",
			allotedPackageDetails: (data.allotedPackageDetails ? data.allotedPackageDetails : []),
		}
	}
	Medias.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update media", err);
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

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event Media-partner updated",
				"updateMedia",
				null,
				null
			)
		);
	});
}

//unassign media from the event
const unassignMediaFromEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.mediaId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"unassignExhibitorFromEvent",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.mediaId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW",
			allotedPackageDetails: [],
			isPassActivated: false
		}
	}
	console.log("===========find and update data for media==========", findData, updateData)
	Medias.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update media", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"unAssignMediasFromEvent",
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
				"unAssignMediasFromEvent",
				null,
				null
			)
		);
	});
}

//assign sponsors from event
const assignSponsorToTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.sponsorId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"assignMembersAndTicketToEvent",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.sponsorId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "ASSIGNED",
			allotedPackageDetails: (data.allotedPackageDetails ? data.allotedPackageDetails : []),
		}
	}
	Sponsors.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update sponser", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateSponsor",
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
				"updateSponsor",
				null,
				null
			)
		);
	});
}

// unassign sponsors from event
const unassignSponsorFromTheEvent = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.sponsorId || !data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"unassignSponsorFromEvent",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.sponsorId,
		eventId: data.eventId
	}

	let updateData = {
		"$set": {
			status: "UNDER_REVIEW",
			allotedPackageDetails: [],
			isPassActivated: false
		}
	}
	Sponsors.updateOne(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update sponsor", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateSponsor",
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
				"updateSponsor",
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
 * @description Contoller for send mail to sponsor with generate pass link
 */
const sendMailToSponsorWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
	// console.log("final data ", data);
    if (!data.eventId || !data.sponsorId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "sendMailToSponsor", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        eventId: data.eventId,
		_id: data.sponsorId
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1,
		allotedPackageDetails: 1,
		isPassActivated: 1
    }

	console.log("findData ", findData);
    Sponsors.findOne(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage passActivatedStatus')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToSponsor", null, null));
            }
			if (!res) {
                return cb(responseUtilities.sendResponse(400, "Sponsor not found", "sendMailToSponsor", null, null));
            }
            // console.log("sponsor ", res);
			if((res.eventId?.passActivatedStatus?.isSponsorPassActivated == true) && (res.isPassActivated == false)){
				res.memberType = "Sponsor"
				if(res.allotedPackageDetails && res.allotedPackageDetails.length > 0){
					emailUtilities.sendMailWithGeneratePassLink(res, (errE, resE) => {
						if (errE) {
							return cb(
								responseUtilities.sendResponse(500, null, "sendMailToSponsor", null, null)
							);
						}
						if(resE && (resE.status == 200) && (resE.statusText == "OK")){
							console.log("mail sent sucess.....")
							let updateData = {
								$set: {
									"isPassActivated": true
								}
							};
							Sponsors.updateOne({ _id: data.sponsorId }, updateData)
								.exec((errS, resS) => {
									if (errS) {
										return cb(responseUtilities.sendResponse(500, null, "activateSponsorPasses", null, null));
									}
									if (!resS) {
										return cb(responseUtilities.sendResponse(400, "Sponsor pass not activated", "activateSponsorPasses", null, null));
									}
									return cb(null, responseUtilities.sendResponse(200, "Sponsor pass link generated", "sendMailToSponsor", null, null)); 
								});

						}else{
							return cb(null, responseUtilities.sendResponse(400, "Unable to generate sponsor pass link", "sendMailToSponsor", null, null)); 
						}
					});
				}else{
					return cb(responseUtilities.sendResponse(200, "No package added so pass link not generated ", "sendMailToSponsor", null, null));
				}
			}else{
                return cb(responseUtilities.sendResponse(200, "Sponsor pass link already generated", "sendMailToSponsor", null, null));
			}
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for send mail to speaker with generate pass link
 */
const sendMailToSpeakerWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
	// console.log("final data ", data);
    if (!data.eventId || !data.speakerId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "sendMailToSpeaker", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        eventId: data.eventId,
		_id: data.speakerId
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1,
		allotedPackageDetails: 1,
		isPassActivated: 1
    }

	console.log("findData ", findData);
    Speakers.findOne(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage passActivatedStatus')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToSpeaker", null, null));
            }
			if (!res) {
                return cb(responseUtilities.sendResponse(400, "Speaker not found", "sendMailToSpeaker", null, null));
            }
            // console.log("Speaker ", res);
			if((res.eventId?.passActivatedStatus?.isSpeakerPassActivated == true) && (res.isPassActivated == false)){
				res.memberType = "Speaker"
				if(res.allotedPackageDetails && res.allotedPackageDetails.length > 0){
					emailUtilities.sendMailWithGeneratePassLink(res, (errE, resE) => {
						if (errE) {
							return cb(
								responseUtilities.sendResponse(500, null, "sendMailToSpeaker", null, null)
							);
						}
						if(resE && (resE.status == 200) && (resE.statusText == "OK")){
							console.log("mail sent sucess.....")
							let updateData = {
								$set: {
									"isPassActivated": true
								}
							};
							Speakers.updateOne({ _id: data.speakerId }, updateData)
								.exec((errS, resS) => {
									if (errS) {
										return cb(responseUtilities.sendResponse(500, null, "activateSpeakerPasses", null, null));
									}
									if (!resS) {
										return cb(responseUtilities.sendResponse(400, "Speaker pass not activated", "activateSpeakerPasses", null, null));
									}
									return cb(null, responseUtilities.sendResponse(200, "Speaker pass link generated", "sendMailToSpeaker", null, null)); 
								});
						}else{
							return cb(null, responseUtilities.sendResponse(400, "Unable to generate speaker pass link", "sendMailToSpeaker", null, null)); 
						}
					});
				}else{
					return cb(responseUtilities.sendResponse(200, "No package added so pass link not generated", "sendMailToSpeaker", null, null));
				}
			}else{
                return cb(responseUtilities.sendResponse(200, "Speaker pass link already generated", "sendMailToSpeaker", null, null));
			}
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for send mail to speaker with generate pass link
 */
const sendMailToExhibitorWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
	// console.log("final data ", data);
    if (!data.eventId || !data.exhibitorId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "sendMailToExhibitor", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        eventId: data.eventId,
		_id: data.exhibitorId
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1,
		allotedPackageDetails: 1,
		isPassActivated: 1
    }

	console.log("findData ", findData);
    Exhibitors.findOne(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage passActivatedStatus')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToExhibitor", null, null));
            }
			if (!res) {
                return cb(responseUtilities.sendResponse(400, "Exhibitor not found", "sendMailToExhibitor", null, null));
            }
            // console.log("Exhibitor ", res);
			if((res.eventId?.passActivatedStatus?.isExhibitorPassActivated == true) && (res.isPassActivated == false)){
				res.memberType = "Exhibitor"
				if(res.allotedPackageDetails && res.allotedPackageDetails.length > 0){
					emailUtilities.sendMailWithGeneratePassLink(res, (errE, resE) => {
						if (errE) {
							return cb(
								responseUtilities.sendResponse(500, null, "sendMailToExhibitor", null, null)
							);
						}
						if(resE && (resE.status == 200) && (resE.statusText == "OK")){
							console.log("mail sent sucess.....")
							let updateData = {
								$set: {
									"isPassActivated": true
								}
							};
							Exhibitors.updateOne({ _id: data.exhibitorId }, updateData)
								.exec((errS, resS) => {
									if (errS) {
										return cb(responseUtilities.sendResponse(500, null, "activateExhibitorPasses", null, null));
									}
									if (!resS) {
										return cb(responseUtilities.sendResponse(400, "Exhibitor pass not activated", "activateExhibitorPasses", null, null));
									}
									return cb(null, responseUtilities.sendResponse(200, "Exhibitor pass link generated", "sendMailToExhibitor", null, null)); 
								});
						}else{
							return cb(null, responseUtilities.sendResponse(400, "Unable to generate exhibitor pass link", "sendMailToExhibitor", null, null)); 
						}
					});
				}else{
					return cb(responseUtilities.sendResponse(200, "No package added so pass link not generated", "sendMailToExhibitor", null, null));
				}
			}else{
                return cb(responseUtilities.sendResponse(200, "Exhibitor pass link already generated", "sendMailToExhibitor", null, null));
			}
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for send mail to speaker with generate pass link
 */
const sendMailToMediaPartnerWithGeneratePassLink = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
	// console.log("final data ", data);
    if (!data.eventId || !data.mediaId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "sendMailToMediaPartner", null, data.req.signature));
    };

    let findData = {
        isDeleted: false,
        isBlocked: false,
        isActive: true,
        eventId: data.eventId,
		_id: data.mediaId
    };

    let dataToFetch = {
        name: 1,
        email: 1,
        title: 1,
        phone:1,
        designation: 1,
        company: 1,
		allotedPackageDetails: 1,
		isPassActivated: 1
    }

	console.log("findData ", findData);
    Medias.findOne(findData, dataToFetch).populate('eventId', 'name startDate endDate coverImage passActivatedStatus')
        .exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "sendMailToMediaPartner", null, null));
            }
			if (!res) {
                return cb(responseUtilities.sendResponse(400, "MediaPartner not found", "sendMailToMediaPartner", null, null));
            }
            // console.log("Media ", res);
			if((res.eventId?.passActivatedStatus?.isMediaPassActivated == true) && (res.isPassActivated == false)){
				res.memberType = "Media"
				if(res.allotedPackageDetails && res.allotedPackageDetails.length > 0){
					emailUtilities.sendMailWithGeneratePassLink(res, (errE, resE) => {
						if (errE) {
							return cb(
								responseUtilities.sendResponse(500, null, "sendMailToMediaPartner", null, null)
							);
						}
						if(resE && (resE.status == 200) && (resE.statusText == "OK")){
							console.log("mail sent sucess.....")
							let updateData = {
								$set: {
									"isPassActivated": true
								}
							};
							Medias.updateOne({ _id: data.mediaId }, updateData)
								.exec((errS, resS) => {
									if (errS) {
										return cb(responseUtilities.sendResponse(500, null, "activateMediaPartnerPasses", null, null));
									}
									if (!resS) {
										return cb(responseUtilities.sendResponse(400, "MediaPartner pass not activated", "activateMediaPartnerPasses", null, null));
									}
									return cb(null, responseUtilities.sendResponse(200, "MediaPartner pass link generated", "sendMailToMediaPartner", null, null)); 
								});
						}else{
							return cb(null, responseUtilities.sendResponse(400, "Unable to generate MediaPartner pass link", "sendMailToMediaPartner", null, null)); 
						}
					});
				}else{
					return cb(responseUtilities.sendResponse(200, "No package added so pass link not generated", "sendMailToMediaPartner", null, null));
				}
			}else{
                return cb(responseUtilities.sendResponse(200, "MediaPartner pass link already generated", "sendMailToMediaPartner", null, null));
			}
        });
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for downloading Passes.
 */
const downloadEventVisitorPass = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId || !data.visitorId || !data.packageId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "downloadEventVisitorPass", null, data.req.signature));
    };

    // console.log("Incoming Data => ", data)

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getEventById, data));
    waterfallFunctions.push(async.apply(checkForInvalidPackage, data));
    waterfallFunctions.push(async.apply(checkForExistingVisitor, data));
    waterfallFunctions.push(async.apply(createVisitorTicket, data));
    waterfallFunctions.push(async.apply(createPassPdf, data));
    waterfallFunctions.push(async.apply(updateVisitorPassUrl, data));
    async.waterfall(waterfallFunctions, cb);
}
exports.downloadEventVisitorPass = downloadEventVisitorPass;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking If Visitor package valid
 */
const checkForExistingVisitor = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.visitorId || !data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "checkForExistingVisitor", null, null));
	};

	let findData = {
		_id: data.visitorId,
        eventId: data.eventId,
        isDeleted: false
	};

	Visitors.findOne(findData).exec((err, visitor) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "checkForExistingVisitor", null, null));
		}
		if (!visitor) {
			return cb(responseUtilities.sendResponse(400, "Visitor not found.", "checkForExistingVisitor", null, data.req.signature));
		} 
		else {
			data.visitorData = visitor;
			return cb(null, responseUtilities.sendResponse(200, "Visitor fetched successfully", "checkForExistingVisitor", null, null));
		};
	});
}
exports.checkForExistingVisitor = checkForExistingVisitor;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for create visitor while generate ticket
 */
const createVisitorTicket = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.visitorId || !data.packageId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "createVisitorTicket", null, null));
    };
    let ticketId = crypto.randomBytes(8).toString('hex');
	ticketId = ticketId.toUpperCase();
	ticketId = `TC${ticketId}`

	let insertData = {
		eventId: data.eventId,
		packageId: data.packageId,
		visitorId: data.visitorId,
        ticketNo: ticketId
	};

    console.log("insertTicketData ", insertData);

    Tickets.create(insertData, (err, res) => {
		if (err) {
			console.error("Unable to Create ticket: ", err);
			return cb(responseUtilities.sendResponse(500, null, "createTicket", null, null));
		};
        data.ticketData = res;
        data.name = data.visitorData?.name;
        data.email = data.visitorData?.email;
        data.memberType = "Visitor";

        // console.log("all data ", data);
		return cb(null, responseUtilities.sendResponse(200, "Ticket added successfully", "createTicket", null, null));
	});
};
exports.createVisitorTicket = createVisitorTicket;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for create visitor while generate ticket
 */
const updateVisitorPassUrl = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

    if (!data.eventId || !data.visitorId || !data.packageId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitorPassUrl", null, null));
    };
    let findData = {
        eventId: data.eventId,
        packageId: data.packageId,
        _id: data.visitorId
    }
	let dataToUpdate = {
        $set: {
            passUrl: (data.passUrl ? data.passUrl : "")
        }
	};

    // console.log("final data including pass url ", data);

    Visitors.findOneAndUpdate(findData, dataToUpdate, { new: true }, (err, res) => {
		if (err) {
			console.error("Unable to update visitor: ", err);
			return cb(responseUtilities.sendResponse(500, null, "updateVisitorPassUrl", null, null));
		};
        if (!res) {
			console.error("Visitor not updated ", err);
			return cb(responseUtilities.sendResponse(400, null, "updateVisitorPassUrl", null, null));
		};  
        let dataToSend = {
            url: (data.passUrl ? data.passUrl : "")
        }
		return cb(null, responseUtilities.sendResponse(200, "Pass generated successfully", "updateVisitorPassUrl", dataToSend, null));
	});
};
exports.updateVisitorPassUrl = updateVisitorPassUrl;