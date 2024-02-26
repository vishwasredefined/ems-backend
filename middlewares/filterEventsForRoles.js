require("../config/index");
// require("../models/db");

const Users = require("../models/users")
const TeamMembers = require("../models/teamMembers");

const allRoles = JSON.parse(process.env.role);


module.exports = function () {

    return async function (req, res, next) {

        let role = req.data.auth.role;
        if (role != allRoles.superadmin && role != allRoles.eventadmin && role != allRoles.user) {

            let allEventsAssigned = await TeamMembers.distinct("eventId", { userId: req.data.auth.id, assigned: true })
            if (allEventsAssigned.error) {
                console.log(allEventsAssigned.error);
                var response = {
                    success: false,
                    message: 'Something Went Wrong'
                };
                return res.status(500).send(response);
            }
            console.log("Assigned events of this user => ", allEventsAssigned);
            allEventsAssigned = allEventsAssigned.map(e => e.toString());
            console.log("All Assigned Events of this user => ", allEventsAssigned)

            let eventsToFilter = [];
            if (req.query?.eventId) {
                eventsToFilter.push(req.query.eventId);
            }
            if (req.params?.eventId) {
                eventsToFilter.push(req.params.eventId)
            }
            if (req.body?.eventId) {
                eventsToFilter.push(req.body?.eventId);
            }
            if (req.query?.eventIds) {
                eventsToFilter.push(...req.query?.eventIds);
            }
            if (req.body?.eventIds) {
                eventsToFilter.push(...req.body?.eventIds);
            }

            console.log("Events to filter => ", eventsToFilter)
            if (eventsToFilter && eventsToFilter.length) {

                eventsToFilter = eventsToFilter.map(event => event.toString());
                if (!(eventsToFilter.every(eventToCheck => allEventsAssigned.includes(eventToCheck)))) {
                    console.log("Event is not assigned to you");
                    var response = {
                        success: false,
                        message: 'Unauthorized for this event'
                    };
                    return res.status(400).send(response);
                } else {
                    console.log("All events request are assigned to this user");
                    req.data.auth.filteredEvents = allEventsAssigned;
                    next();
                }
            }
            else {
                console.log("All events request are assigned to this user");
                req.data.auth.filteredEvents = allEventsAssigned;
                next();
            }
        } else {
            next();
        }
    }
}