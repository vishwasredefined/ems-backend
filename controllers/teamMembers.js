const async = require('async');
const moment = require('moment');
const mongoose = require("mongoose");
const authController = require("./auth")

//models
const Users = require('../models/users');
const Speakers = require("../models/speakers");
const Sponsors = require("../models/sponsors");
const MediaPartners = require("../models/medias");
const Exhibitors = require("../models/exhibitors");
const Events = require("../models/events");
const TeamMembers = require("../models/teamMembers");

//Utilities
const utilities = require('../helpers/security');
const responseUtilities = require("../helpers/sendResponse");
let emailUtilities = require("../helpers/email");

let allRoles = JSON.parse(process.env.role);
let role = JSON.parse(process.env.role);
let secondaryUserShortName = JSON.parse(process.env.secondaryUserShortName);

/* Add secondary users By eventadmin Only */
exports.addTeamMembers = function (data, response, cb) {
    if (!cb) cb = response;

    if (!data.contactEmail || !data.role || !process.env.secondaryUserRole.includes(data.role)) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "addTeamMembers",
                null,
                data.req.signature
            )
        );
    }

    if (data.req.auth.role == allRoles.eventmanager && ["eventmanager"].includes(data.role)) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Not allowed for this role",
                "addTeamMembers",
                null,
                data.req.signature
            )
        );
    }

    if (process.env.DEV == 'true') {
        data.password = "123456789"
    } else {
        data.password = (Math.random() + 1).toString(36).substring(2);
    }
    console.log("System Generated Password => ", data.password);

    let waterFallFunctions = [];

    // waterFallFunctions.push(async.apply(checkIfEmailAlreadyExist, data)); // agency credentials different generate
    waterFallFunctions.push(async.apply(utilities.generatePassword, data.password));
    waterFallFunctions.push(async.apply(authController.generateAccountId, data));
    waterFallFunctions.push(async.apply(generateRandomCredentialsForTeamMember, data));
    waterFallFunctions.push(async.apply(createSecondaryUserData, data));
    waterFallFunctions.push(async.apply(sendEmailToTeamMemberOnAddition, data));
    async.waterfall(waterFallFunctions, cb);
}

const checkIfEmailAlreadyExist = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let findData = { email: data.email };

    Users.findOne(findData, (err, res) => {
        if (err) {
            console.error("Unable to update User: ", err);
            return cb(
                responseUtilities.sendResponse(500, null, "updateUser", null, null)
            );
        }
        if (!res) {
            console.log("Ok , email can be addded");
            return cb(
                null,
                responseUtilities.sendResponse(
                    200,
                    "Proceed Ahead",
                    "checkIfEmailAlreadyExist",
                    null,
                    data.req.signature
                )
            );
        } else {
            return cb(
                responseUtilities.sendResponse(
                    400,
                    "Email Already Exist",
                    "checkIfEmailAlreadyExist",
                    null,
                    data.req.signature
                )
            );
        }
    });
};

const generateRandomCredentialsForTeamMember = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let findData = { _id: data.req.auth.id };
	if(data.req.auth.role == role.eventmanager){
		findData._id = data.req.auth.eventAdminId
	}

    Users.findOne(findData, (err, res) => {
        if (err) {
            console.error("Unable to update User: ", err);
            return cb(
                responseUtilities.sendResponse(500, null, "updateUser", null, null)
            );
        }

        if (!res || !res.name) {
            return cb(
                responseUtilities.sendResponse(
                    400,
                    "Please add your agency name to proceed",
                    "checkIfEmailAlreadyExist",
                    response.data,
                    data.req.signature
                )
            );
        }
        let agencyname = res.name.toLowerCase();
        let domainArray = agencyname.split(" ");
        let domain = "";
        for (let i = 0; i < domainArray.length; i++) {
            domain += domainArray[i];
        }
		
        let randomemail = secondaryUserShortName[data.role] + data.generatedAccountId + "@" + domain + ".com";
        console.log("Random email geenrated = ", randomemail)
        data.email = randomemail;
        return cb(
            null,
            responseUtilities.sendResponse(
                400,
                "Email Already Exist",
                "checkIfEmailAlreadyExist",
                response.data,
                data.req.signature
            )
        );

    });
};

const createSecondaryUserData = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    let hash = null;
    let salt = null;
    let accountId = null;

    if (response.data) {
        hash = response.data.hash;
        salt = response.data.salt;
        accountId = response.data.accountId;
    }
    if (!hash || !salt || !accountId) {
        console.error("no hash/salt/accountId");
        return cb(responseUtilities.sendResponse(500, "no hash/salt/accountId", "createSecondaryUserData", null, data.req.signature));
    }

    let findData = {
        email: data.email
    }

    let updateData = {};
    updateData.name = data.contactPersonName || data.name;
    updateData.password = hash;
    updateData.salt = salt;
    updateData.accountId = accountId;
    updateData.isActive = true;
    updateData.emailVerified = true;
    updateData.provider = "email";
    updateData.addedBy = data.req.auth.id;
    updateData.role = data.role;
    let userMeta = {
        contactEmail: data.contactEmail,
        contactPersonName: data.contactPersonName,
        contactPersonMobile: data.contactPersonMobile
    }
    updateData.userMeta = userMeta;

    if (data.req.auth.role == JSON.parse(process.env.role).eventmanager) {
        //eventmanager is adding
        updateData.eventAdminId = data.req.auth.eventAdminId;
    } else {
        updateData.eventAdminId = data.req.auth.id;
    }

    let options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
    }
    console.log("Find user => ", findData);
    console.log("Insert  user => ", updateData);

    Users.findOneAndUpdate(findData, updateData, options, function (err, res) {
        if (err) {
            console.error(err);
            return cb(responseUtilities.sendResponse(500, null, "createSecondaryUserData", null, data.req.signature));
        }
        return cb(null, responseUtilities.sendResponse(200, "successfully created", "createSecondaryUserData", res, data.req.signature));
    });
};

const sendEmailToTeamMemberOnAddition = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    emailUtilities.sendRegistrationEmailToTeamMember(data, (err, res) => {
        if (err) {
            return cb(
                responseUtilities.sendResponse(500, null, "sendEmailToTeamMemberOnAddition", null, null)
            );
        }
        console.log("Emailsent to agency on addition => ", res)
        return cb(
            null,
            responseUtilities.sendResponse(
                200,
                "Email Sent to team-member with credentials",
                "sendEmailToTeamMemberOnAddition",
                response.data,
                data.req.signature
            )
        );
    });
};

/* Get team member listing */
exports.agencyGetTeamMemberList = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.role) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "findUserByEmail",
                null,
                data.req.signature
            )
        );
    }
    let findData = {
        role: data.role,
        isBlocked: false,
        isActive: true
    };
    if (data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
    }
    if (data.email) {
        findData.email = { "$regex": data.email, "$options": "i" }
    }

    Users.find(findData, { password: 0, salt: 0, accountId: 0 })
        .sort({ createdAt: -1 })
        .exec((err, res) => {
            if (err) {
                console.error("Unable to get Event agencies: ", err);
                return cb(
                    responseUtilities.sendResponse(
                        500,
                        null,
                        "getEventadmins",
                        null,
                        null
                    )
                );
            }
			
            return cb(
                null,
                responseUtilities.sendResponse(
                    200,
                    "All members list fetched",
                    "agencyGetTeamMemberList",
                    res,
                    null
                )
            );
        });
};

/* Get team member listing */
exports.agencyGetTeamMemberListPagination = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.role) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "agencyGetTeamMemberListPagination",
                null,
                data.req.signature
            )
        );
    }
    let findData = {
        role: data.role,
    };
    if (data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
    }
    if (data.email) {
        findData.email = { "$regex": data.email, "$options": "i" }
    }

    console.log("Team members get findData => ", findData)
    Users.countDocuments(findData, (err, count) => {
        if (err) {
            console.error("Could not get count for events: ", err);
            return cb(
                responseUtilities.sendResponse(
                    500,
                    null,
                    "agencyGetTeamMemberListPagination",
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
        Users.find(findData)
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
                            "agencyGetTeamMemberListPagination",
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
                        "All Events fetched for admin",
                        "agencyGetTeamMemberListPagination",
                        sendData,
                        null
                    )
                );
            });
    });
};

/* Contoller for team member by id */
const getTeamMemberById = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.id && !data.userId) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing Params",
                "getTeamMemberById",
                null,
                data.req.signature
            )
        );
    }

    console.log("Team member id => ", data.id)
    if (data.id && !mongoose.Types.ObjectId.isValid(data.id)) {
        console.log("findData => ")
        return cb(
            responseUtilities.sendResponse(
                400,
                "Invalid Parameter",
                "getTeamMemberById",
                null,
                data.req.signature
            )
        );
    }

    let findData = {
        _id: data.id || data.userId,
        // eventAdminId: data.req.auth.id
    };

    if (data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
    }

    console.log("findData => ", findData)

    Users.findOne(findData)
        .populate(" userMeta.country , userMeta.state , userMeta.city ")
        .exec((err, res) => {
            if (err) {
                console.error("Unable to get User: ", err);
                return cb(
                    responseUtilities.sendResponse(500, null, "getTeamMemberById", null, null)
                );
            }
            if (!res) {
                return cb(
                    responseUtilities.sendResponse(
                        400,
                        "User not found",
                        "getTeamMemberById",
                        null,
                        data.req.signature
                    )
                );
            }
            console.log("Get user by id =>", res)
            return cb(
                null,
                responseUtilities.sendResponse(
                    200,
                    "User fetched by id",
                    "getTeamMemberById",
                    res,
                    null
                )
            );
        });
};
exports.getTeamMemberById = getTeamMemberById;

//Contoller for updateEvents
const agencyUpdateTeamMember = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.userId) {
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

    let findData = {
        _id: data.userId
    };
    if (data.req.auth && data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
    }
    let updateData = {};
    if (data.contactPersonName) {
        updateData.name = data.contactPersonName
        updateData["userMeta.contactPersonName"] = data.contactPersonName
    }

    if (data.contactEmail) {
        updateData["userMeta.contactEmail"] = data.contactEmail
    }
    if (data.contactPersonMobile) {
        updateData["userMeta.contactPersonMobile"] = data.contactPersonMobile
    }

    console.log("FindData", findData)
    console.log("updateData", updateData)

    Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
        if (err) {
            console.error("Unable to update agencyUpdateTeamMember: ", err);
            return cb(
                responseUtilities.sendResponse(500, null, "agencyUpdateTeamMember", null, null)
            );
        }

        return cb(
            null,
            responseUtilities.sendResponse(
                200,
                "team member updated",
                "agencyUpdateTeamMember",
                res,
                data.req.signature
            )
        );
    });
};
exports.agencyUpdateTeamMember = agencyUpdateTeamMember;

/** Assign Event to Team - Member */
exports.assignEventToTeamMembers = async function (data, response, cb) {
    if (!cb) cb = response;

    if (!data.userId || !data.eventIds) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "addEventadmin",
                null,
                data.req.signature
            )
        );
    }



    let waterFallFunctions = [];
    waterFallFunctions.push(async.apply(getTeamMemberById, data));
    if (data.req.auth.role == role.eventmanager) {
        waterFallFunctions.push(async.apply(checkIfAllEventsAreAssignedToEventAdmin, data));
    }
    waterFallFunctions.push(async.apply(assignEventToTeamMember, data));
    async.waterfall(waterFallFunctions, cb);
}

const checkIfAllEventsAreAssignedToEventAdmin = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    
    let allEventsOfEventManager = data.req.auth.filteredEvents;
    console.log("Find events which are assigned to event manager => ", data.eventIds)
    // allEventsOfEventManager = allEventsOfEventManager.map(e => {
    //     return e.toString();
    // })
    console.log("All events of manager => ", allEventsOfEventManager)
    console.log("Data.eventIds => ", data.eventIds)
    if (
        data.eventIds.every(
            event => allEventsOfEventManager.includes(event)
        )
    ) {
        console.log("All the events which you are assigning is assigned to you......");
        return cb(
            null,
            responseUtilities.sendResponse(
                200,
                "Proceed to assign events",
                "checkIfAllEventsAreAssignedToEventAdmin",
                response.data,
                data.req.signature
            )
        );
    } else {
        console.log("The event which you are assigning is not assigned to you......");
        return cb(
            responseUtilities.sendResponse(
                400,
                "Not allowed",
                "checkIfAllEventsAreAssignedToEventAdmin",
                null,
                data.req.signature
            )
        );
    }
};

const assignEventToTeamMember = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

	let role = response.data && response.data.role
    for (let i = 0; i < data.eventIds.length; i++) {

        let findData = {
            userId: data.userId,
            eventId: data.eventIds[i],
        }
        if (data.req.auth.role == allRoles.eventadmin) {
            findData.eventAdminId = data.req.auth.id
        }
        if (data.req.auth.role == role.eventmanager) {
            findData.eventAdminId = data.req.auth.eventAdminId
        }

        let updateData = {
            assigned: true,
            role: response.data.role
        }

        let options = {
            upsert: true,
            new: true
        }

		if(role == "staff"){
			let staffData = {
				userId : data.userId,
				eventId : data.eventIds[i]
			}
			let staffRes = await checkIfStaffAssignedForDuration(staffData);
			if(!staffRes.success){
				return cb(
					responseUtilities.sendResponse(
						400,
						staffRes.message || "Event not assigned to team-member",
						"checkIfStaffAssignedForDuration",
						null,
						data.req.signature
					)
				);
			}
			let insertRes = await TeamMembers.findOneAndUpdate(findData, updateData, options).exec();
			if ((i + 1) == data.eventIds.length) {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"Event(s) assigned to team-member",
						"assignEventToTeamMember",
						null,
						null
					)
				);
			}
		}else{
			let insertRes = await TeamMembers.findOneAndUpdate(findData, updateData, options).exec();
			console.log("Assigned => ", insertRes);
			if ((i + 1) == data.eventIds.length) {
				return cb(
					null,
					responseUtilities.sendResponse(
						200,
						"Event(s) assigned to team-member",
						"assignEventToTeamMember",
						insertRes,
						null
					)
				);
			}
		}
    }
};

/*Un assign event to team members */
exports.unassignEventsToTeamMembers = async function (data, response, cb) {
    if (!cb) cb = response;

    if (!data.userId || !data.eventIds) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "addEventadmin",
                null,
                data.req.signature
            )
        );
    }



    let waterFallFunctions = [];
    if (data.req.auth.role == role.eventmanager) {
        waterFallFunctions.push(async.apply(checkIfAllEventsAreAssignedToEventAdmin, data));
    }
    waterFallFunctions.push(async.apply(unassignEventToTeamMembers, data));
    async.waterfall(waterFallFunctions, cb);
}

const unassignEventToTeamMembers = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.userId || !data.eventIds || !data.eventIds.length) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "unassignEventToTeamMembers",
                null,
                data.req.signature
            )
        );
    }

    let findData = {
        userId: data.userId,
        eventId: { $in: data.eventIds }
    }
    if (data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
    }

    let updateData = {
        $set: {
            assigned: false
        }
    }
    TeamMembers.updateMany(findData, updateData, (err, res) => {
        if (err) {
            return cb(
                responseUtilities.sendResponse(
                    500,
                    "something went wrong",
                    "unassignEventToTeamMembers",
                    null,
                    data.req.signature
                )
            );
        }
        console.log("unassigned successfully => ", res)
        return cb(
            null,
            responseUtilities.sendResponse(
                200,
                "all events unassigned",
                "unassignEventToTeamMembers",
                res,
                null
            )
        );
    });
};

/* update teammember status */
exports.agencyUpdateTeamMemberStatus = function (data, response, cb) {
    if (!cb) cb = response;

    if (!data.userId || !JSON.stringify(data.isBlocked)) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "addEventadmin",
                null,
                data.req.signature
            )
        );
    }
    let waterFallFunctions = [];
    waterFallFunctions.push(async.apply(agencyUpdateTeamMemberBlockStatus, data));
    async.waterfall(waterFallFunctions, cb);
}

const agencyUpdateTeamMemberBlockStatus = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let findData = {
        _id: data.userId
    };
    if (data.req.auth && data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
    }
    let updateData = {
        isBlocked: data.isBlocked
    };

    console.log("FindData", findData)
    console.log("updateData", updateData)

    Users.findOneAndUpdate(findData, updateData, { new: true }, (err, res) => {
        if (err) {
            console.error("Unable to update agencyUpdateTeamMember: ", err);
            return cb(
                responseUtilities.sendResponse(500, null, "agencyUpdateTeamMember", null, null)
            );
        }

        return cb(
            null,
            responseUtilities.sendResponse(
                200,
                "team member status updated successfully",
                "agencyUpdateTeamMember",
                res,
                data.req.signature
            )
        );
    });
};

/* get all assigned events of team member */
exports.getTeamMemberAssignedEvents = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.userId) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing params",
                "getTeamMemberAssignedEvents",
                null,
                data.req.signature
            )
        );
    }

    let findData = {
        userId: data.userId,
        assigned: true
    }

    if (data.req.auth.role == allRoles.eventadmin) {
        findData.eventAdminId = data.req.auth.id;
    }
    if (data.req.auth.role == allRoles.eventmanager) {
        findData.eventAdminId = data.req.auth.eventAdminId
        findData.eventId = { $in : data.req.auth.filteredEvents }
    }

    console.log("Find team member => ", findData);

    TeamMembers.find(findData)
        .populate({
            path: 'eventId',
            match: {
                isActive: true
            }
        })
        .exec(function (err, res) {
            if (err) {
                console.error(err);
                return cb(responseUtilities.sendResponse(500, null, "unassignEventToTeamMembers", null, data.req.signature));
            }
            // console.log("Get all events of team members", res)
            return cb(null, responseUtilities.sendResponse(200, "Event unassigned successfully", "unassignEventToTeamMembers", res, data.req.signature));
        });
};

//check if staff already assigned to an event for the given duration while assiging to an event
const checkIfStaffAssignedForDuration = function (data) {
	return new Promise(function (resolve, reject) {


		if (!data.eventId || !data.userId) {
			resolve({
				success: false,
				message: "Email Data Missing"
			})
		}

		let findEvent = {
			_id: data.eventId
		}
		Events.findOne(findEvent)
			.exec((err, event) => {
				if (err) {
					console.error("Unable to get Event: ", err);
					resolve({
						success: false,
						message: "Email Notification Not Sent"
					})
				}

				if (!event) {
					resolve({
						success: false,
						message: "Event not found"
					})
				}

				let startDate = new Date(event.startDate)
				let endDate = new Date(event.endDate)

				let pipeline = [
					{ $match: { userId: mongoose.Types.ObjectId(data.userId) } },
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
						$match: {
							$nor: [
								{
									$and: [
										{ "eventId.startDate": { $gt: startDate } },  //sd
										{ "eventId.startDate": { $gt: endDate } }  //en
									]
								},
								{
									$and: [

										{ "eventId.endDate": { $lt: endDate } },  //en
										{ "eventId.endDate": { $lt: startDate } }   //sd
									]
								}
							]
						}
					}]

				TeamMembers.aggregate(pipeline)
					.exec(function (err, res) {
						if (err) {
							console.error(err);
							resolve({
								success: false,
								message: "Error checking staff for the given duration"
							})
						}
						if (res) {
							resolve({
								success: false,
								message: "Staff already assigned for the duration"
							})
						} else {
							resolve({
								success: true,
								message: "Staff available for event"
							})
						}
					});
			});

	});
};


