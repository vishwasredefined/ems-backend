const async = require("async");
const mongoose = require("mongoose");

//Helpers
const responseUtilities = require("../helpers/sendResponse");
const role = JSON.parse(process.env.role);

//Models
const Arenas = require("../models/arenas");

//Controllers
const { getEventById } = require("./events");

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Adding Event arena
 */
exports.addEventArena = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.eventId || !data.name || !data.description) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "addEventArena", null, data.req.signature));
    }

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(getEventById, data));
    waterfallFunctions.push(async.apply(checkIfArenaNameAlreadyExists, data));
    waterfallFunctions.push(async.apply(addEventArenaData, data));
    async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Check If Arena Name Already Exists
 */
const checkIfArenaNameAlreadyExists = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let findData = {
        eventId: data.eventId,
        name: data.name
    };

    if (data.arenaId) {
        findData._id = { $nin: data.arenaId }
    };
    console.log("Find Arena => ", findData);

    Arenas.findOne(findData, (err, res) => {
        if (err) {
            return cb(responseUtilities.sendResponse(500, null, "checkIfArenaNameAlreadyExists", null, null));
        };
        if (res) {
            return cb(responseUtilities.sendResponse(400, "Arena already exist in this event", "checkIfArenaNameAlreadyExists", null, null));
        }
        return cb(null, responseUtilities.sendResponse(200, "Proceed", "checkIfArenaNameAlreadyExists", null, data.req.signature));
    });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Add Event arena data
 */
const addEventArenaData = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    let createData = {
        eventId: data.eventId,
        name: data.name
    };
    if (data.description) {
        createData.description = data.description
    };

    console.log("Insert Arena => ", createData)
    Arenas.create(createData, (err, res) => {
        if (err) {
            return cb(responseUtilities.sendResponse(500, null, "addEventArena", null, null));
        };
        console.log("Arena inserted => ", res);
        return cb(null, responseUtilities.sendResponse(200, "Event Arena added", "addEventArena", res, data.req.signature));
    });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Update Event arena
 */
exports.updateEventArena = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!data.arenaId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "addEventArena", null, data.req.signature));
    };

    let waterfallFunctions = [];

    waterfallFunctions.push(async.apply(getEventArenaById, data));
    if (data.name) {
        waterfallFunctions.push(async.apply(checkIfArenaNameAlreadyExists, data));
    };
    waterfallFunctions.push(async.apply(updateEventArenaData, data));
    async.waterfall(waterfallFunctions, cb);
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Update Event arena
 */
const updateEventArenaData = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.arenaId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "updateEventArena", null, data.req.signature));
    };

    let message = "Arena updated successfully.";
    let findData = {
        _id: data.arenaId
    };

    //Check to update self arena only
    if ([role.eventmanager].includes(data.req.auth.role)) {
        findData.eventId = { "$in": data.req.auth.filteredEvents }
        let allAssignedEvents = data.req.auth.filteredEvents.map(e => e.toString());
        let arenaEventId = data.arenaDetails.eventId.toString();
        if (!allAssignedEvents.includes(arenaEventId)) {
            return cb(responseUtilities.sendResponse(403, "Event Not assigned", "updateEventArena", null, data.req.signature));
        }
    };

    let updateData = {};

    if (data.name) {
        updateData.name = data.name;
    };

    if (data.description) {
        updateData.description = data.description
    };

    if (data.statusUpdate && JSON.stringify(data.isActive)) {
        updateData = {
            isActive: data.isActive
        };
        message = "Arena status updated";
    };

    if (data.deleteRequest && JSON.stringify(data.isDeleted)) {
        updateData.isDeleted = data.isDeleted;
        message = "Arena deleted successfully";
    };

    console.log("Update Arena => ", updateData)
    let options = {
        new: true
    }
    Arenas.findOneAndUpdate(findData, updateData, options, (err, res) => {
        if (err) {
            console.error("Unable to update Event Arena => ", err);
            return cb(responseUtilities.sendResponse(500, null, "updateEventArena", null, null));
        };
        if (!res) {
            return cb(responseUtilities.sendResponse(400, "Event arena not found", "updateEventArena", null, data.req.signature));
        };
        console.log("Arena Updated => ", res)
        return cb(null, responseUtilities.sendResponse(200, message, "updateEventArena", res, data.req.signature));
    });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Get Event Arenas listing
 */
exports.getEventArenas = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "getEventArenas", null, data.req.signature));
    };

    if (data.eventId && !mongoose.Types.ObjectId.isValid(data.eventId)) {
        return cb(responseUtilities.sendResponse(400, "Invalid Parameter", "getEventArenas", null, data.req.signature));
    };

    let findData = {
        eventId: data.eventId,
        isDeleted: false,
    };

    if (JSON.stringify(data.isActive)) {
        findData.isActive = data.isActive
    }

    if (data.user || (data.req && data.req.auth && data.req.auth.role == role.user)) {
        findData.isActive = true;
    };
    console.log("Find data for Event Arenas => ", findData);

    Arenas.find(findData)
        .sort({ createdAt: -1 })
        .exec((err, res) => {

            if (err) {
                return cb(responseUtilities.sendResponse(500, null, "getEventArenas", null, null));
            }
            return cb(null, responseUtilities.sendResponse(200, "Event arenas fetched", "getEventArenas", res, null));
        });
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Get Event Arena by Id
 */
const getEventArenaById = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.arenaId) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "getEventArenaById", null, data.req.signature));
    }

    if (data.arenaId && !mongoose.Types.ObjectId.isValid(data.arenaId)) {
        return cb(responseUtilities.sendResponse(400, "Invalid Parameter", "getEventArenaById", null, data.req.signature));
    }

    let findData = {
        _id: data.arenaId,
        isDeleted: false
    };

    console.log("Find data for Event Arena by id => ", findData)
    Arenas.findOne(findData).exec((err, res) => {
        if (err) {
            return cb(responseUtilities.sendResponse(500, null, "getEventArenaById", null, null));
        };

        if (!res) {
            return cb(responseUtilities.sendResponse(400, "Event arena not found", "getEventArenaById", null, data.req.signature));
        };
        data.arenaDetails = res;
        return cb(null, responseUtilities.sendResponse(200, "Event arena fetched", "getEventArenaById", res, null));
    });
};
exports.getEventArenaById = getEventArenaById;

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Get Event Arena by Id
 */
exports.getEventAgendasForUser = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }
    if (!data.eventId) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Missing Params",
                "getEventAgendasForUser",
                null,
                data.req.signature
            )
        );
    }

    if (data.eventId && !mongoose.Types.ObjectId.isValid(data.eventId)) {
        return cb(
            responseUtilities.sendResponse(
                400,
                "Invalid Parameter",
                "getEventAgendasForUser",
                null,
                data.req.signature
            )
        );
    }

    let findData = {
        eventId: data.eventId,
        isDeleted: false,
    };

    console.log("Find Arenas => ", findData)

    Agendas.find(findData)
        .populate('speakers')
        .sort({ date: -1 })
        .exec((err, res) => {
            if (err) {
                console.error("Unable to get Event agenda: ", err);
                return cb(
                    responseUtilities.sendResponse(500, null, "getEventAgendasForUser", null, null)
                );
            }
            let sendData = {
                data: res,
            };
            return cb(
                null,
                responseUtilities.sendResponse(
                    200,
                    "Event Agendas fetched",
                    "getEventAgendasForUser",
                    sendData,
                    null
                )
            );
        });
};