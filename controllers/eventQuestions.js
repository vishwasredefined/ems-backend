const async = require("async");
const mongoose = require("mongoose");

//Helpers
const responseUtilities = require("../helpers/sendResponse");
const role = JSON.parse(process.env.role);

//Modals
const EventQuestions = require("../models/eventQuestions");
const Visitors = require("../models/visitors");

//Controllers
const { getEventById } = require("../controllers/events");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for adding sponsor requests
 */
const addEventAdditionalQuestions = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.eventId || !data.question) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "addEventAdditionalQuestions", null, data.req.signature));
	}

    // console.log("incoming data ", data);
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(addEventQuestions, data));
	async.waterfall(waterfallFunctions, cb);

}
exports.addEventAdditionalQuestions = addEventAdditionalQuestions;


/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Add Agenda rating review
 */
const addEventQuestions = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.question || data.options.length == 0) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "addEventQuestions", null, data.req.signature));
	}

    let createData = {
        eventId: data.eventId,
        question: data.question,
        type: "Dropdown",
        options: data.options,
		isRequired: data.isRequired
    };
    if(data.eventDetails){
		createData.eventAdminId = data.eventDetails.managedBy
    }

    console.log("Insert event questions => ", createData);
    EventQuestions.create(createData, (err, res) => {
        if (err) {
            return cb(responseUtilities.sendResponse(500, null, "addEventQuestions", null, null));
        };
        if (!res) {
            return cb(responseUtilities.sendResponse(400, "Unable to add additional questions", "addEventQuestions", null, null));
        };
        return cb(null, responseUtilities.sendResponse(200, "Event additional questions added", "addEventQuestions", res, data.req.signature));
    });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Event additional questions
 */
exports.getEventAdditionalQuestions = async function (data, response, cb) {

    if (!cb) {
        cb = response;
    }

    if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "getEventAdditionalQuestions", null, data.req.signature));
	}

    let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventQuestions, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Event questions
 */
const getEventQuestions = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "getEventQuestions", null, data.req.signature));
	}
    let findData = {
        eventId: data.eventId
    }
    let fetchData = {
        isDeleted: 0, 
    }

	EventQuestions.find(findData, fetchData)
        .populate('eventId', 'name startDate endDate coverImage eventDescription')
		.exec((err, res) => {
            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "getEventQuestions", null, null));
            };
            if (!res) {
                return cb(responseUtilities.sendResponse(400, "Unable to fetch questions", "getEventQuestions", null, null));
            };
            let DTS = {
                questions: res
            }
            return cb(null, responseUtilities.sendResponse(200, "Event additional questions fetched", "getEventQuestions", DTS, data.req.signature));
    });
};

//Contoller for fetching questions by id
const getEventQuestionById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.id && !data.questionId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getEventQuestionById",
				null,
				data.req.signature
			)
		);
	}
	let findData = {
		_id: data.id || data.questionId,
		isDeleted: false,
	};

	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
	// 	findData.eventAdminId = data.req.auth.id
	// }
    console.log("findData ", findData);

	EventQuestions.findOne(findData)
        .populate('eventId', 'name startDate endDate coverImage eventDescription')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Quuestion: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getEventQuestionById", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						404,
						"Question not found",
						"getEventQuestionById",
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
					"Question fetched by id",
					"getEventQuestionById",
					sendData,
					null
				)
			);
		});
};
exports.getEventQuestionById = getEventQuestionById;

//Contoller for update event question
exports.updateEventQuestion = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.questionId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventQuestion",
				null,
				null
			)
		);
	}
	let findData = {
		_id: data.questionId
	};
	let updateData = data;
	EventQuestions.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update question", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"updateEventQuestion",
					null,
					null
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Question updated",
				"updateEventQuestion",
				null,
				null
			)
		);
	});
};

//Contoller for update event question status
exports.updateEventQuestionStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.questionId || !JSON.stringify(data.isActive)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"updateEventQuestionStatus",
				null,
				data.req.signature
			)
		);
	}

	let updateData = {
		isActive: data.isActive
	};
	let findData = { _id: data.questionId };

	EventQuestions.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Event question status: ", err);
			return cb(
				responseUtilities.sendResponse(500, null, "updateEventQuestionStatus", null, null)
			);
		}
		if (!res) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Event question not found",
					"updateEventQuestionStatus",
					null,
					data.req.signature
				)
			);
		}
		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Event question status updated",
				"updateEventQuestionStatus",
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
 * @param {Function} cb 
 * @description Get Event additional questions
 */
exports.getEventQuestionResponses = async function (data, response, cb) {

    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.questionId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "getEventQuestionResponses", null, data.req.signature));
	}

    let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(getEventQuestionById, data));
	waterfallFunctions.push(async.apply(getQuestionResponses, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Event questions responses
 */
const getQuestionResponses = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.questionId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "getQuestionResponses", null, data.req.signature));
	}
    let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		"additionalInfo": {
			$elemMatch: {
				"questionId": mongoose.Types.ObjectId(data.questionId),
				"$and":[{ "answer": {"$exists": true }}, { "answer": { "$nin" : ["", null] }}]
			}
		}
    }
	if(data.answer){
		findData = { 
			eventId: mongoose.Types.ObjectId(data.eventId),
			"additionalInfo": {
				$elemMatch: {
				  "questionId": mongoose.Types.ObjectId(data.questionId),
				  "answer": data.answer
				}
			}
		}
	}
	console.log("findData ", findData);
    let fetchData = {
        interestTopics: 0,
		isBlocked: 0,
		isDeleted: 0,
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
			.populate('eventId', 'name startDate endDate coverImage eventDescription')
			.populate('eventAdminId', 'name')
			.populate('residenceCountry', 'name')
			.populate('packageId', 'title')
			.populate('additionalInfo.questionId', 'question type options answer')
			.skip(skip)
			.limit(limit)
			.sort({ createdAt: -1 })
			.exec((err, res) => {
				if (err) {
					return cb(responseUtilities.sendResponse(500, null, "getQuestionResponses", null, null));
				};
				if (!res) {
					return cb(responseUtilities.sendResponse(400, "Unable to fetch questions", "getQuestionResponses", null, null));
				};				
				let visitors = [];
				if(res.length > 0){
					visitors = JSON.parse(JSON.stringify(res));
					visitors.find(element => {
						element.additionalInfo.map((item) => {
							if(item.questionId?._id.toString() === data.questionId.toString()){
								element.question = item.questionId?.question, 
								element.answer = item.answer
							} 
						})
					})
				}
				let DTS = {
					visitors,
					count: count,
					pageLimit: limit,
				}
				return cb(null, responseUtilities.sendResponse(200, "Visitors list fetched", "getQuestionResponses", DTS, data.req.signature));
		});
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Event additional questions
 */
exports.exportEventQuestionResponses = async function (data, response, cb) {

    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.questionId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "exportEventQuestionResponses", null, data.req.signature));
	}

    let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(getEventQuestionById, data));
	waterfallFunctions.push(async.apply(exportQuestionResponses, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Export Event questions responses
 */
const exportQuestionResponses = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.questionId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "exportQuestionResponses", null, data.req.signature));
	}
    let findData = {
		eventId: mongoose.Types.ObjectId(data.eventId),
		"additionalInfo": {
			$elemMatch: {
				"questionId": mongoose.Types.ObjectId(data.questionId),
				"$and":[{ "answer": {"$exists": true }}, { "answer": { "$nin" : ["", null] }}]
			}
		}
    }
	if(data.answer){
		findData = { 
			eventId: mongoose.Types.ObjectId(data.eventId),
			"additionalInfo": {
				$elemMatch: {
				  "questionId": mongoose.Types.ObjectId(data.questionId),
				  "answer": data.answer
				}
			}
		}
	}
	console.log("findData ", findData);

    let fetchData = {
        interestTopics: 0,
		isBlocked: 0,
		isDeleted: 0,
    }

	Visitors.find(findData, fetchData)
        .populate('eventId', 'name startDate endDate coverImage eventDescription')
        .populate('eventAdminId', 'name')
        .populate('residenceCountry', 'name')
		.populate('packageId', 'title')
		.populate('additionalInfo.questionId', 'question type options answer')
		.sort({ createdAt: -1 })
		.exec((err, res) => {
            if (err) {
				console.log('error in finding visitors => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportQuestionResponses", err, null));
			}
			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportQuestionResponses", null, null));
			};

			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let visitor = res[i];
				let question = "";
				let answer = "";
				if (data.eventId && !visitor.eventId) {
					continue;
				}
				if (data.eventAdminId && !visitor.eventAdminId) {
					continue;
				}
				if(visitor.additionalInfo.length > 0){
					visitor.additionalInfo.map((item) => {
						if(item.questionId?._id.toString() === data.questionId.toString()){
							question = item.questionId?.question, 
							answer = item.answer
						} 
					})
				}

				let attendeeName = visitor.name || (visitor.firstName || "") + " " + (visitor.lastName || "");
				let fieldObject = {
					"Event": visitor?.eventId?.name,
					"Agency": visitor?.eventAdminId?.name,
					"PassPurchased": visitor?.packageId?.title,
					"Title": visitor.title,
					"Name": attendeeName,
					"Personel Email": visitor.email,
					"Business Email": visitor?.businessEmail,
					"Nationality": visitor?.nationality?.name || visitor?.nationality,
					"Residence Country": visitor?.residenceCountry?.name,
					"Designation": visitor?.designation,
					"Company": visitor?.company,
					"Mobile": visitor?.mobile || visitor?.whatsAppMobile,
					"Question": question,
					"Answer": answer
				}
				console.log("fieldObject => ", fieldObject);
				dataArray.push(fieldObject);
			}

			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportQuestionResponses", null, null));
			};

			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportQuestionResponses", dataArray, null));
    });
};

//Contoller for events by id
const getEventAdditionInfoByEventId = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getEventAdditionInfoByEventId",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		eventId: data.eventId,
		isDeleted: false,
		isActive: true
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager || data.req.auth.role == role.staff || data.req.auth.role == role.financemanager || data.req.auth.role == role.marketingmanager) {
		findData.eventId = { $in : data.req.auth.filteredEvents },
		findData.eventAdminId = data.req.auth.eventAdminId
	}
	console.log("find data for event by id", findData)
	let fetchData = {
		eventAdminId: 0,
		isDeleted: 0,
		isActive: 0
	}
	EventQuestions.find(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event: ", err);
				return cb(
					responseUtilities.sendResponse(500, null, "getEventAdditionInfoByEventId", null, null)
				);
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						400,
						"Question not found",
						"getEventAdditionInfoByEventId",
						null,
						data.req.signature
					)
				);
			};
			return cb(null, responseUtilities.sendResponse(200, "Event additional info fetched by id", "getEventAdditionInfoByEventId", res, null));
		});
};
exports.getEventAdditionInfoByEventId = getEventAdditionInfoByEventId;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Event additional questions
 */
exports.getEventQuestionResponsesCount = async function (data, response, cb) {

    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.questionId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "getEventQuestionResponsesCount", null, data.req.signature));
	}

    let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(getEventQuestionById, data));
	waterfallFunctions.push(async.apply(getQuestionResponsesCount, data));
	async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Function} cb 
 * @description Get Event questions responses
 */
const getQuestionResponsesCount = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.questionId) {
		return cb(responseUtilities.sendResponse(400, "Mising Params", "getQuestionResponsesCount", null, data.req.signature));
	}

    let findQuestionData = {
        eventId: data.eventId,
		_id: data.questionId,
		isActive: true,
		isDeleted: false
    }
	EventQuestions.findOne(findQuestionData, { options: 1 }, async (errC, res) => {
		if (errC) {
			console.error("Could not get question: ", errC);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getQuestionResponsesCount",
					null,
					null
				)
			);
		}
		if(!res){
			return cb(responseUtilities.sendResponse(400,"Question not found","getQuestionResponsesCount",null,data.req.signature));
		}
		let responseData = [];
		let allResponse = 0;
		let options = res.options;
		if(options.length > 0){
			for (let i in options) {
				let option = options[i];
				let visitors = await Visitors.countDocuments({ 
					eventId: mongoose.Types.ObjectId(data.eventId),
					"additionalInfo": {
						$elemMatch: {
							"questionId": mongoose.Types.ObjectId(data.questionId),
							"answer": options[i]
						}
					}
				});
				let optionObject = {};
				optionObject[option] = visitors;
				responseData.push(optionObject);
				allResponse += visitors
			}
		}
		responseData.unshift({ All: allResponse })
		let DTS = {
			responseCount: responseData
		}
		return cb(null, responseUtilities.sendResponse(200, "Visitors count fetched", "getQuestionResponsesCount", DTS, data.req.signature));
	});
};