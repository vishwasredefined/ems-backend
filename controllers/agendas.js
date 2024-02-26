const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");

//Helper
const responseUtilities = require("../helpers/sendResponse");
const { getUTCStartDate, getUTCEndDate } = require("../helpers/security");
const role = JSON.parse(process.env.role);
const notify = require("../helpers/notification");

//Models
const Agendas = require("../models/agendas");
const Bookmarks = require("../models/bookmarks");
const Events = require("../models/events");
const Questions = require("../models/questions");
const notifications = require("../models/notifications");
const Feedbacks = require("../models/feedbacks");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding Event agenda
 */
exports.addEventAgenda = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId || !data.title || !data.sessionType || !data.date || !data.startTime || !data.endTime) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addEventAgenda", null, data.req.signature));
	}
	let findData = {
		eventId: data.eventId,
		date: data.date,
		sessionType: data.sessionType,
		title: data.title.trim()
	};

	Agendas.findOne(findData, (err, res) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "addEventAgenda", null, null));
		};
		console.log("res ", res);
		let waterfallFunctions = [];
		waterfallFunctions.push(async.apply(addEventAgendaData, data));
		if(!res){
			waterfallFunctions.push(async.apply(agendaUpdateSendNotification, data));
		}
		async.waterfall(waterfallFunctions, cb);

	});
	
};

const addEventAgendaData = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		eventId: data.eventId,
		date: data.date,
		sessionType: data.sessionType,
		title: data.title.trim()
	};
	console.log("findData ", findData);

	let insertData = {
		date: data.date
	}

	if (data.speakers) {
		insertData.speakers = data.speakers
	}
	if (data.title) {
		insertData.title = data.title
	}
	if (data.startTime) {
		insertData.startTime = data.startTime
	}
	if (data.endTime) {
		insertData.endTime = data.endTime
	};
	if (data.description) {
		insertData.description = data.description
	}
	if(data.arenaId){
		insertData.arenaId = data.arenaId
	}
	insertData.eventAdminId = data.req.auth.eventAdminId || data.req.auth.id;

	let options = {
		upsert: true,
		new: true,
		setDefaultsOnInsert: true,
	};

	Agendas.findOneAndUpdate(findData, insertData, options, (err, res) => {
		if (err) {
			console.error("Unable to Add Event Agenda: ", err);
			return cb(responseUtilities.sendResponse(500, null, "addEventAgenda", null, null));
		};
		return cb(null, responseUtilities.sendResponse(200, "Event agenda added", "addEventAgenda", null, data.req.signature));
	});
	
};

const agendaUpdateSendNotification = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		eventId: data.eventId,
		isActive : true,
		isDeleted : false
	};
	
	Bookmarks.find(findData).populate('userId  agendaId')
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get users: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"addPushNotificationsForAgendaBookmarks",
						null,
						null
					)
				);
			}
			let users = JSON.parse(JSON.stringify(res));
			console.log("==========no of users====", users.length)
			if (users && users.length) {
				let titleData = "Agenda Added";
				let insertData = [];
				for (let i in users) {
					if (users[i].userId) {
						console.log("==========bookmark userId========", users[i].userId._id)
					}
					if (users[i].userId && users[i].agendaId) {
						let messageData = `Exciting Update! We've just added a new session to the ${users[i].agendaId.title} agenda.`;
						let insertNotification = {
							alertType: "PUSH_NOTIFICATION",
							targetUser : "ALL_USERS",
							message: messageData,
							title: titleData,
							createdBy:  data.req.auth.eventAdminId || data.req.auth.id,
							userId: users[i].userId._id,
							eventAdminId:  data.req.auth.eventAdminId || data.req.auth.id,
						}
						insertData.push(insertNotification);
						if((parseInt(i) +1) === (users.length)){
							notifications.insertMany(insertData, (errN, resN) => {
								if (errN) {
									console.log('Error', errN);
								}
								if(resN){
									for (let j in users) {
										if (users[j].userId && users[j].userId.deviceInfo[0] && users[j].agendaId) {
											let deviceTokens = users[j].userId.deviceInfo;
											let message_data = `Exciting Update! We've just added a new session to the ${users[i].agendaId.title} agenda.`;
											let payload = {};
											let notification = {
												message: message_data,
												title: titleData,
												imageUrl: "",
											};
											deviceTokens.forEach(async (element) => {
												if (element.platform == "ios" || element.platform == "android") {
													let notifRes = await notify.sendSingleNotification(
														element.token,
														notification,
														payload
													);
													console.log("Bookmarks notification resp====", typeof notifRes, typeof i);
													if (notifRes.success) {
														sentStatus = true;
														if((parseInt(j) + 1) == users.length){
															let notificationIds = resN.map(noti => noti._id);
															console.log("notificationIds",notificationIds)
															if(notificationIds.length){
																notifications.updateMany({ _id: { $in: notificationIds} },{ isSent: true }, (err, response) => {
																	if (err) {
																		console.error("Unable to update notification: ", err);
																	}
																	console.log("Success, Notification updated successfully", response)
																});
															}else{
																console.log("success with no users")
															}
														}
													}
												}
											});
										}
									}
								}
							});
						}
					}
				}
			}

			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Event agenda added",
					"addPushNotificationsForAgendaBookmarks",
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
 * @description Contoller for update Event agenda
 */
exports.updateEventAgenda = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.agendaId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateEventAgenda", null, data.req.signature));
	}

	let findData = {
		_id: data.agendaId,
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { "$in": data.req.auth.filteredEvents }
	};

	console.log("findData to update Agenda => ", findData)
	let updateData = data;

	Agendas.findOneAndUpdate(findData, updateData, (err, res) => {
		if (err) {
			console.error("Unable to update Event Agenda: ", err);
			return cb(responseUtilities.sendResponse(500, null, "updateEventAgenda", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Event agenda updated", "updateEventAgenda", null, data.req.signature));
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting event agendas
 */
exports.getEventAgendas = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getEventAgendas", null, data.req.signature));
	};

	let findData = {
		eventId: data.eventId,
		isDeleted: false,
	};

	if (data.date) {
		// findData.date = getUTCStartDate(data.date);
		findData = { ...findData, "$and": [{date : { $gte : getUTCStartDate(data.date) }},{ date : { $lte : getUTCEndDate(data.date) }}] };
	};

	if (JSON.stringify(data.isActive)) {
		findData.isActive = data.isActive;
	};
	console.log("FindData for Event Agenda => ", findData)

	Agendas.find(findData)
		.populate('speakers arenaId')
		.sort({ date: 1, startTime: 1, endTime: 1 })
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to get Event Agenda =>", err);
				return cb(responseUtilities.sendResponse(500, null, "getEventAgendas", null, null));
			}
			let DTS = JSON.parse(JSON.stringify(res));
			for (let i = 0; i < DTS.length; i++) {
				let feebackData = await getAgendaFeedbacks(DTS[i]._id);
				DTS[i]["feedbacks"] = feebackData;
			}
			let sendData = {
				data: DTS,
			};
			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Event Agendas fetched",
					"getEventAgendas",
					sendData,
					null
				)
			);
		});
};

//Contoller for getting event agendas by section/stage
// exports.getEventAgendasByStage = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}
// 	if (!data.eventId) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Missing Params",
// 				"getEventAgendasByStage",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	if (data.eventId && !mongoose.Types.ObjectId.isValid(data.eventId)) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Invalid Parameter",
// 				"getEventAgendasByStage",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	let findData = {
// 		eventId: data.eventId,
// 		isDeleted: false,
// 	};

// 	if (data.stageLocation) {
// 		findData.stageLocation = data.stageLocation
// 	}
// 	// if (data.req.auth && data.req.auth.role == role.eventadmin) {
// 	// 	findData.managedBy = data.req.auth.id
// 	// }

// 	console.log("Find Agenda => ", findData)

// 	Agendas.find(findData)
// 		.populate('speakers')
// 		.sort({ createdAt: -1 })
// 		.exec((err, res) => {
// 			if (err) {
// 				console.error("Unable to get Event agenda: ", err);
// 				return cb(
// 					responseUtilities.sendResponse(500, null, "getEventAgendasByStage", null, null)
// 				);
// 			}
// 			console.log("=======respppppppppp of agenda by section===========", res[0])
// 			let sendData = {
// 				data: res,
// 			};
// 			return cb(
// 				null,
// 				responseUtilities.sendResponse(
// 					200,
// 					"Event Agendas fetched by stage/section",
// 					"getEventAgendasByStage",
// 					sendData,
// 					null
// 				)
// 			);
// 		});
// };

//Contoller for event agenda by id
exports.getEventAgendaById = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	console.log("dataaaaaaa ", data);
	if (!data.id && !data.agendaId) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"getEventAgenda",
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
				"getEventAgenda",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.id || data.agendaId,
		isDeleted: false,
	};

	console.log("Find specific Agenda", findData)
	Agendas.findOne(findData)
		.exec((err, res) => {
			if (err) {
				console.error("Unable to get Event agenda: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getEventAgenda", null, null));
			}
			if (!res) {
				return cb(
					responseUtilities.sendResponse(
						404,
						"Event agenda not found",
						"getEventAgenda",
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
					"Event Agenda fetched by id",
					"getEventAgenda",
					sendData,
					null
				)
			);
		});
};

//Contoller for update Event agenda
exports.updateEventAgendaStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.agendaId || !JSON.stringify(data.isActive)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing Params",
				"updateEventAgenda",
				null,
				data.req.signature
			)
		);
	}

	let findData = {
		_id: data.agendaId,
		// eventAdminId: data.req.auth.eventAdminId || data.req.auth.id
	}
	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { "$in": data.req.auth.filteredEvents }
	};
	let updateData = {
		isActive: data.isActive
	}

	let options = {
		new: true
	}
	Agendas.findOneAndUpdate(findData, updateData, options, (err, res) => {
		if (err) {
			console.error("Unable to update Event Agenda =>  ", err);
			return cb(responseUtilities.sendResponse(500, null, "updateEventAgendaStatus", null, null));
		};
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "Agenda not found", "updateEventAgendaStatus", null, null))
		};
		console.log("Agenda updated => ", res)
		return cb(null, responseUtilities.sendResponse(200, "Agenda status updated", "updateEventAgendaStatus", null, data.req.signature));
	});
};

//Contoller for getting event agendas by section/stage
// exports.getEventAgendasByDate = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}
// 	if (!data.eventId) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Missing Params",
// 				"getEventAgendasByStage",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	if (data.eventId && !mongoose.Types.ObjectId.isValid(data.eventId)) {
// 		return cb(
// 			responseUtilities.sendResponse(
// 				400,
// 				"Invalid Parameter",
// 				"getEventAgendasByStage",
// 				null,
// 				data.req.signature
// 			)
// 		);
// 	}

// 	let findData = {
// 		eventId: data.eventId,
// 		isDeleted: false,
// 	};

// 	console.log("find data for event agenda", findData)

// 	Agendas.aggregate([
// 		{ $match: findData },
// 		{
// 			$group: {
// 				"_id": "$date",
// 				"eventAgendas": {
// 					$push: "$$ROOT"
// 				}
// 			}
// 		},
// 		{
// 			$sort: {
// 				"_id": 1
// 			}
// 		}
// 	]).exec((err, res) => {
// 		if (err) {
// 			return cb(responseUtilities.sendResponse(500, null, "getEventAgendasByStage", null, null));
// 		}
// 		return cb(
// 			null,
// 			responseUtilities.sendResponse(
// 				200,
// 				"Event Agendas fetched by date",
// 				"getEventAgendasByStage",
// 				res,
// 				null
// 			)
// 		);
// 	});
// };

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Get Event Agendas For User
 */
exports.getEventAgendasForUser = function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.eventId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getEventAgendasForUser", null, data.req.signature));
	};

	let findData = {
		eventId: data.eventId,
		isDeleted: false,
		isActive: true
	};

	console.log("Find Event Agendas For User => ", findData)

	Agendas.find(findData)
		.populate('speakers arenaId')
		.sort({ date: 1, startTime: 1 })
		.exec(async (err, res) => {
			if (err) {
				console.error("Unable to get Event agenda: ", err);
				return cb(responseUtilities.sendResponse(500, null, "getEventAgendasForUser", null, null));
			}
			// console.log("data.req.auth.id ", data.req.auth.id)
			let DTS = JSON.parse(JSON.stringify(res));
			if (data.req && data.req.auth && data.req.auth.role == "user" && data.req.auth.id) {
				console.log("Loggedin user is accessing.....");
				for (let i = 0; i < res.length; i++) {
					let findBookmark = {
						userId: data.req.auth.id,
						agendaId: res[i]._id,
						isDeleted: false,
						isActive: true
					};
					let isBookMarked = await Bookmarks.findOne(findBookmark);
					if (isBookMarked) DTS[i].isBookMarked = true
					else DTS[i].isBookMarked = false;

					let findRating = {
						userId: data.req.auth.id,
						agendaId: res[i]._id
					};
					let isRated =  await Feedbacks.findOne(findRating, { feedback : 1, createdAt: 1, updatedAt: 1 });
					if (isRated){ 
						DTS[i].isRated = true 
						DTS[i].myRating = isRated 
					}else { 
						DTS[i].isRated = false;
						DTS[i].myRating = {} 
					}
				}
			}

			for (let i = 0; i < res.length; i++) {
				let findBookmark = {
					agendaId: res[i]._id,
					isDeleted: false,
					isActive: true
				};
				let bookmarkCount = await Bookmarks.countDocuments(findBookmark);
				DTS[i].bookmarkCount = bookmarkCount;

				let feedbackData = await getAgendaFeedbacks(res[i]._id);
				DTS[i].feedbacks = feedbackData;
			}
			// console.log("DTS => ", DTS)
			return cb(null, responseUtilities.sendResponse(200, "Event Agendas fetched", "getEventAgendasForUser", DTS, null));
		});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Controller for getting rating reviews
 */
const getAgendaFeedbacks = async function (agendaId) {
	let findData = {};

	if(agendaId){
		findData.agendaId = agendaId;
	}

	let oneRatingCount = await Feedbacks.countDocuments({ ...findData, feedback: 1 });
	let twoRatingCount = await Feedbacks.countDocuments({ ...findData, feedback: 2 });
	let threeRatingCount = await Feedbacks.countDocuments({ ...findData, feedback: 3 });
	let fourRatingCount = await Feedbacks.countDocuments({ ...findData, feedback: 4 });
	let fiveRatingCount = await Feedbacks.countDocuments({ ...findData, feedback: 5 });

	let totalRatingCount = oneRatingCount + twoRatingCount + threeRatingCount + fourRatingCount + fiveRatingCount;
	let avg = "0";
	let totalRatings = ((oneRatingCount * 1) + (twoRatingCount * 2) + (threeRatingCount * 3) + (fourRatingCount * 4) + (fiveRatingCount * 5))
	console.log("totalRatingCount", totalRatingCount);
	console.log("totalRating", totalRatings);

	if(totalRatingCount > 0){
		avg = (totalRatings / totalRatingCount).toFixed(1);
	}
	let DTS = {
		totalFeedbacks: totalRatingCount,
		oneRatingCount,
		twoRatingCount,
		threeRatingCount,
		fourRatingCount,
		fiveRatingCount,
		averageFeedback: avg
	}
	return  DTS;
}

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Export all speakers 
 */
exports.exportAllAgendas = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};

	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	}

	if (JSON.stringify(data.isActive)) {
		findData.isActive = JSON.parse(data.isActive)
	}

	if (data.search) {
		console.log("data.search => ", data.search)
		findData["$or"] = [
			{ name: { "$regex": data.search, "$options": "i" } },
			{ email: { "$regex": data.search, "$options": "i" } },
			{ title: { "$regex": data.search, "$options": "i" } }
		]
	}

	if (data.date) {
		findData.date = getUTCStartDate(data.date);
	};

	if (data.agencyId) {
		findData.eventAdminId = data.agencyId
	}
	if (data.eventId) {
		findData.eventId = data.eventId
	}

	console.log("FindData Export=> ", findData);

	let populateData = " eventId eventAdminId arenaId speakers ";

	Agendas.find(findData)
		.populate(populateData)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllAgendas", err, null));
			}

			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllAgendas", null, null));
			}
			let dataArray = [];
			for (let i = 0; i < res.length; i++) {

				let agenda = res[i];
				if (data.eventId && !agenda.eventId) {
					continue;
				}
				if (data.agencyId && !agenda.eventAdminId) {
					continue;
				}

				let allSpeakers = agenda?.speakers.map(e => e.name) || [];

				let fieldObject = {
					"Agency": agenda?.eventAdminId?.name,
					"Event": agenda?.eventId?.name,
					"Arena": agenda?.arenaId?.name,
					"Title": agenda.title,
					"Date": moment(agenda.date).format("DD/MM/YYYY"),
					"Start Time": agenda.startTime,
					"End Time": agenda?.endTime,
					"Speakers": allSpeakers
				}
				dataArray.push(fieldObject);
			}
			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllAgendas", null, null));

			}
			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportAllAgendas", dataArray, null));
		})
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for adding question in agenda
 */
exports.addQuestion = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.agendaId || !JSON.stringify(data.question)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "addQuestion", null, data.req.signature));
	};

	let agenda = await Agendas.findOne({ _id: data.agendaId });
	console.log("Agenda => ", agenda)
	if (!agenda || !agenda.isActive) {
		return cb(responseUtilities.sendResponse(400, "Agenda not found/inactive", "addQuestion", null, data.req.signature));
	};
	data.eventId = agenda?.eventId;
	console.log("Associated Event =>", data.eventId)
	let event = await Events.findOne({ _id: data.eventId });
	if (!event || event.isDeleted) {
		return cb(responseUtilities.sendResponse(400, "Event not found", "addQuestion", null, data.req.signature));
	};
	if (event.expired) {
		return cb(responseUtilities.sendResponse(400, "Event expired", "addQuestion", null, data.req.signature));
	};

	let insertData = {
		eventId: data.eventId,
		eventAdminId: event.managedBy,
		question: data.question,
		isAccepted: true,
		userId: data.req.auth.id,
		agendaId: data.agendaId
	};

	console.log("insertData => ", insertData)
	Questions.create(insertData, (err, res) => {
		if (err) {
			return cb(responseUtilities.sendResponse(500, null, "addQuestion", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Your question has been submitted successfully.", "addQuestion", res, null));
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for geeting question of specifc agenda
 */
exports.getQuestions = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.agendaId) {
		return cb(responseUtilities.sendResponse(400, "Provide AgendaId", "getQuestions", null, data.req.signature));
	};

	let agenda = await Agendas.findOne({ _id: data.agendaId })
		.populate([
			{
				path: "speakers",
				model: "speakers",
				select: "name profilePicture"
			},
			{
				path: "speakers",
				model: "speakers",
				select: "name profilePicture"
			},
			{
				path: "arenaId",
				model: "arena",
				select: " name description"
			}
		]);
	if (!agenda || !agenda.isActive) {
		return cb(responseUtilities.sendResponse(400, "Agenda not found/inactive", "getQuestions", null, data.req.signature));
	};

	let findData = {
		isAccepted: true,
		agendaId: data.agendaId
	};

	if (data.req.auth && data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};

	if (data.req.auth.role == role.eventmanager) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId
	};

	if (JSON.stringify(data.isAccepted)) {
		findData.isAccepted = JSON.parse(data.isAccepted)
	}

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	console.log("FindData=> ", findData);
	Questions.find(findData)
		.exec((err, questions) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "getQuestions", null, null));
			};
			let DTS = {
				agenda, questions
			}
			return cb(null, responseUtilities.sendResponse(200, "Questions fetched.", "getQuestions", DTS, null));
		});
};