const async = require("async");
const mongoose = require("mongoose");

//Helpers
const responseUtilities = require("../helpers/sendResponse");
const role = JSON.parse(process.env.role);

//Modals
const Suggestions = require("../models/suggestions");

//Controllers
const { getEventById } = require("../controllers/events");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for adding suggestions to the event
 */
const addEventSuggestions = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId || !data.suggestion) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "addSuggestions", null, data.req.signature));
	}

    // console.log("incoming data ", data);

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(addSuggestions, data));
	async.waterfall(waterfallFunctions, cb);

}
exports.addEventSuggestions = addEventSuggestions;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Add event suggestions
 */
const addSuggestions = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.suggestion) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "addSuggestions", null, data.req.signature));
	}

    let createData = {
        eventId: data.eventId,
        suggestion: data.suggestion
    };
    
    if (data.req.auth && data.req.auth.role == role.user) {
		createData.userId = data.req.auth.id
	}
    if(data.eventDetails){
		createData.approvedBy = data.eventDetails.managedBy
    }

    Suggestions.create(createData, (err, res) => {
        if (err) {
            return cb(responseUtilities.sendResponse(500, null, "addSuggestions", null, null));
        };
        if (!res) {
            return cb(responseUtilities.sendResponse(400, "Unable to add suggestion", "addSuggestions", null, null));
        };
        console.log("Suggestion inserted => ", res);
        return cb(null, responseUtilities.sendResponse(200, "Event suggestion added", "addSuggestions", res, data.req.signature));
    });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get event suggestions
 */
exports.getEventSuggestions = async function (data, response, cb) {

    if (!cb) {
        cb = response;
    }

    let findData = {
        isDeleted: false
    };

    if(data.eventId){
        findData.eventId  = data.eventId
    }

	Suggestions.find(findData, { isDeleted: 0, isApproved:0, approvedBy:0 })
        .populate('userId', 'userName title name email address')
		.exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "getEventSuggestions", null, null));
            };
            if (!res) {
                return cb(responseUtilities.sendResponse(400, "Unable to fetch suggestions", "getEventSuggestions", null, null));
            };
            let sendData = {
				response: res
			};
            return cb(null, responseUtilities.sendResponse(200, "Event suggestions fetched", "getEventSuggestions", sendData, data.req.signature));
    });
};