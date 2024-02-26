const express = require("express");
const router = express.Router();

/* Middlewares */
const formatRequest = require("../middlewares/formatRequest");
router.use(formatRequest);

const clients = {
	users: {
		host: process.env.SERVICE_RPC_HOST,
		port: process.env.CORE_USER_PORT
	}
};
const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const filterEvents = require('../middlewares/filterEventsForRoles')();
const role = JSON.parse(process.env.role);

//controllers
const events = require("../controllers/events");


router.post("/v1/create",
	[authenticator, authenticateRole([role.eventadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.addEvents(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* check for event name */
router.get("/v1/check/event/name",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.checkUniqueEventName(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get categories listing for Admin with pagination+filters  */
router.get("/v1/all/events",
	[authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getAllEventsForAdmin(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get events by id. */
router.get("/v1/event/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	events.getEventById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

//get list of active events for user : app route
router.get("/v1/events", [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	events.getAllEventsForClient(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

//get list of assigned members in events - speaker, sponsor, etc for adding in agendas
router.get("/v1/get/member/details",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;
		data.assigned = true

		events.getMembersDetail(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//get list of existing speaker/sponsor.... for event-admin
router.get("/v1/get/existing/member/by/email",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getExistingMembersByEmail(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//get list featured/non-featured events
router.get("/v1/events/by/featured", function (req, res) {
	let data = req.query;
	data.req = req.data;

	events.getAllEventsByFeatured(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update events*/
router.patch("/v1/update",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.updateEventDetails(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update events*/
router.patch("/v1/update/floorplan",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.updateEventFloorPlan(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update events*/
router.patch("/v1/update/address",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.updateEventAddress(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update event-socials*/
router.patch("/v1/update/socials",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.updateEventSocials(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update events*/
router.patch("/v1/publish/event",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.publishEvent(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update events*/
router.patch("/v1/mark/feature",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.markEventFeatured(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*Delete events */
router.delete("/v1/delete/:id", [authenticator, authenticateRole([role.eventadmin, role.superadmin])], function (req, res, next) {
	let data = { id: req.params.id };
	data.req = req.data;
	events.deleteEvent(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*change events status as Active/Deactive  */
router.patch("/v1/status", [authenticator, authenticateRole([role.eventadmin, role.superadmin])], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	events.updateEventStatus(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*not used*/
// router.patch("/v1/assign/medias",
// 	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
// 	function (req, res, next) {
// 		let data = req.body;
// 		data.req = req.data;

// 		events.assignMembersToEvent(data, function (err, response) {
// 			let status = 0;
// 			if (err) {
// 				status = err.status;
// 				return res.status(status).send(err);
// 			}
// 			status = response.status;
// 			return res.status(status).send(response);
// 		});
// 	});

/*update events*/
router.patch("/v1/assign/members",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		events.assignMembersToEvent(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


//Get Events Entities Count
router.get("/v1/get/entity/stats",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getEventEntityStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});



//get total 24-hour user singup count
// router.get("/v1/get/count/for/agency",
// 	[authenticator, authenticateRole([role.eventadmin, role.eventmanager, role.financemanager]), filterEvents],
// 	function (req, res) {
// 		let data = req.query;
// 		data.req = req.data;

// 		users.getUserSignupCountForAgency(data, function (err, response) {
// 			let status = 0;
// 			if (err) {
// 				status = err.status;
// 				return res.status(status).send(err);
// 			}
// 			status = response.status;
// 			return res.status(status).send(response);
// 		});
// 	});

//get total 24-hour user singup count
// router.get("/v1/get/event/sections",
// 	function (req, res) {
// 		let data = req.query;
// 		data.req = req.data;

// 		events.getEventSections(data, function (err, response) {
// 			let status = 0;
// 			if (err) {
// 				status = err.status;
// 				return res.status(status).send(err);
// 			}
// 			status = response.status;
// 			return res.status(status).send(response);
// 		});
// 	});

//get list of events for staff
// router.get("/v1/staff/events",
// 	[authenticator, authenticateRole([role.staff]), filterEvents],
// 	function (req, res) {
// 		let data = req.query;
// 		data.req = req.data;

// 		events.getStaffEvents(data, function (err, response) {
// 			let status = 0;
// 			if (err) {
// 				status = err.status;
// 				return res.status(status).send(err);
// 			}
// 			status = response.status;
// 			return res.status(status).send(response);
// 		});
// 	});

//Get list ongoing, future and past events

router.get("/v1/admin/default",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin, role.eventmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getEventForDeafultDropDownSelect(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


//Get Events Count for Dashboard : Ongoing, Past, Upcoming Count
router.get("/v1/get/event/dashboard/count",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getEventCountForDashboard(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

// Get total attendees: Speakers,Sponsors,Medias, Exhibitors, Visitors Count
router.get("/v1/attendees/stats",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin, role.eventmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getTotalAttendeesStats(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get list ongoing, future and past events
router.get("/v1/by/status",
	[authenticator, authenticateRole([role.superadmin, role.user, role.eventadmin, role.eventmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		events.getEventsInChronologicalOrder(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});
/********************************************APP ROUTES********************************************************************** */

//Get list ongoing, future and past events APP
router.get("/v1/app/by/status",
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		data.user = true;
		events.getEventsInChronologicalOrder(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get list ongoing, future and past events APP
router.get("/v1/app/by/status/loggedin",
	[authenticator, authenticateRole([role.user]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		data.user = true;
		events.getEventsInChronologicalOrder(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

module.exports = router;
