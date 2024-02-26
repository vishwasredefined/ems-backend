const async = require("async");
const mongoose = require("mongoose");

//Helpers
const responseUtilities = require("../helpers/sendResponse");
const role = JSON.parse(process.env.role);

//Modals
const Feedbacks = require("../models/feedbacks");

//Controllers
const { getEventById } = require("./events");
const { getEventAgendaById } = require("./agendas");


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for adding sponsor requests
 */
const addAgendaFeedbacks = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId || !data.agendaId || !data.feedback) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "addAgendaFeedbacks", null, data.req.signature));
	}

    // console.log("incoming data ", data);

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(getEventAgendaById, data));
	waterfallFunctions.push(async.apply(addFeedbacks, data));
	async.waterfall(waterfallFunctions, cb);

}
exports.addAgendaFeedbacks = addAgendaFeedbacks;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Add Agenda feedbacks
 */
const addFeedbacks = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.agendaId || !data.feedback) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "addFeedbacks", null, data.req.signature));
	}

    let createData = {
        eventId: data.eventId,
        agendaId: data.agendaId,
        feedback: data.feedback
    };
    
    if (data.req.auth && data.req.auth.role == role.user) {
		createData.userId = data.req.auth.id
	}
    if(data.eventDetails){
		createData.approvedBy = data.eventDetails.managedBy
    }

    // console.log("Insert feedbacks => ", createData)
    Feedbacks.create(createData, (err, res) => {
        if (err) {
            return cb(responseUtilities.sendResponse(500, null, "addFeedbacks", null, null));
        };
        if (!res) {
            return cb(responseUtilities.sendResponse(400, "Unable to add feedback", "addFeedbacks", null, null));
        };
        console.log("feedback inserted => ", res);
        return cb(null, responseUtilities.sendResponse(200, "Panel feedback added", "addFeedbacks", res, data.req.signature));
    });
};

exports.addFeedbacks = addFeedbacks;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Agenda feedback review
 */
exports.getAgendaFeedbacks = async function (data, response, cb) {

    if (!cb) {
        cb = response;
    }
    let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getFeedbacks, data));
	waterfallFunctions.push(async.apply(getFeedbackCount, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Agenda feedback review
 */
const getFeedbacks = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let findData = {
        isApproved: true
    };

    if(data.agendaId){
        findData.agendaId  = data.agendaId
    }
    if(data.eventId){
        findData.eventId  = data.eventId
    }
    let fetchData = {
        approvedBy: 0, 
        isApproved: 0
    }
	Feedbacks.find(findData, fetchData)
        .populate('eventId', 'name startDate endDate coverImage eventDescription')
        .populate('agendaId', 'title date startTime endTime')
        .populate('userId', 'userName title name email address userMeta')
		.exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "getAgendaFeedbacks", null, null));
            };
            if (!res) {
                return cb(responseUtilities.sendResponse(400, "Unable to fetch feedback", "getAgendaFeedbacks", null, null));
            };
            let avg = 0;
            let totalRatings = 0;
            if(res.length > 0){
                res.map(el => totalRatings += Number(el.feedback))
                avg = (totalRatings / res.length).toFixed(1);
            }
            console.log("totalRatings ", res.length);
            console.log("avgRatings ", avg);

            data.average = avg;
            data.totalFeedbacks = res.length;
            data.feedbackData = res;
            return cb(null, responseUtilities.sendResponse(200, "Panel average feedback fetched", "getAgendaFeedbacks", null, data.req.signature));
    });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Agenda feedback count
 */
const getFeedbackCount = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let findData = {
        isApproved: true
    };

    if(data.agendaId){
        findData.agendaId  = data.agendaId
    }
    if(data.eventId){
        findData.eventId  = data.eventId
    }

	let matchOneRating = { ...findData, feedback: 1 };
	console.log("matchOneRating => ", matchOneRating)
	let oneRatingCount = Feedbacks.countDocuments(matchOneRating)

    let matchTwoRating = { ...findData, feedback: 2 };
	let twoRatingCount = Feedbacks.countDocuments(matchTwoRating)

    let matchThreeRating = { ...findData, feedback: 3 };
	let threeRatingCount = Feedbacks.countDocuments(matchThreeRating)

    let matchFourRating = { ...findData, feedback: 4 };
	let fourRatingCount = Feedbacks.countDocuments(matchFourRating)

    let matchFiveRating = { ...findData, feedback: 5 };
	let fiveRatingCount = Feedbacks.countDocuments(matchFiveRating)

	Promise.all([
		oneRatingCount,
		twoRatingCount,
		threeRatingCount,
		fourRatingCount,
		fiveRatingCount,
	])
    .then((res) => {
        console.log("Res => ", res)
        let totalFeedbackCount = res[0] + res[1] + res[2] + res[3] + res[4];

        let DTS = {
            totalFeedbacks: totalFeedbackCount,
            veryBadFeedbackCount: res[0],
            poorFeedbackCount: res[1],
            mediumFeedbackCount: res[2],
            goodFeedbackCount: res[3],
            excellentFeedbackCount: res[4],
            avgFeedback: data.average,
            feedbackData: data.feedbackData
        }
        return cb(null, responseUtilities.sendResponse(200, "Panel total feedbacks fetched", "getRatingsCount", DTS, null));
    })
    .catch(err => {
        console.log("Error in fetching feedback count ", err);
        return cb(responseUtilities.sendResponse(500, "Unable to fetch panel feedbacks", "getRatingsCount", null, null));

    })
};
