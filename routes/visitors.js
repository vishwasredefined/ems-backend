const express = require("express");
const router = express.Router();

/* Middlewares */
const formatRequest = require("../middlewares/formatRequest");
router.use(formatRequest);

const json2xls = require('json2xls');
router.use(json2xls.middleware);
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
const visitors = require("../controllers/visitors");

// Add visitors(by admin)
router.post("/v1/add",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		visitors.addVisitor(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


/* Get visitors listing for Admin */
router.get("/v1/all", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	visitors.getAllVisitors(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get visitors listing -done */
router.get("/v1/list", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	visitors.getVisitorsList(data, function (err, response) {
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
router.get("/v1/get/existing/by/email",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		visitors.getExistingVisitorByEmail(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update visitors - done*/
router.patch("/v1/update", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	visitors.updateVisitor(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update attendee block status */
router.patch("/v1/update/block/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		visitors.updateVisitorBlockStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/** Export visitors */
router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin])],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		visitors.exportAllVisitors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("visitors.xlsx", response.data);
		})
	}
)


/*****************************************************APP ENDPOINTS*********************************************************************** */

//App visitors application
router.post("/v1/apply",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		visitors.applyAsVisitor(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//app visitors application
// router.post("/v1/generate/ticket",
// 	[authenticator, authenticateRole([role.eventadmin, role.superadmin])],
// 	function (req, res, next) {
// 		let data = req.body;
// 		data.req = req.data;

// 		visitors.generateAttendeeTicket(data, function (err, response) {
// 			let status = 0;
// 			if (err) {
// 				status = err.status;
// 				return res.status(status).send(err);
// 			}
// 			status = response.status;
// 			return res.status(status).send(response);
// 		});
// 	});


//get list of existing Visitor by email
// router.get("/v1/app/existing/by/email", [authenticator, authenticateRole([role.user])], function (req, res) {
// 	let data = req.query;
// 	data.req = req.data;

// 	// data.user = true;
// 	visitors.checkIfVisitorAlreadyExistByEmail(data, function (err, response) {
// 		let status = 0;
// 		if (err) {
// 			status = err.status;
// 			return res.status(status).send(err);
// 		}
// 		status = response.status;
// 		return res.status(status).send(response);
// 	});
// });

/* Get visitors by id. -done */
router.get("/v1/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	visitors.getVisitorById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get visitors listing -done */
router.get("/v1/get/all", [authenticator, authenticateRole([role.eventadmin,role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	visitors.getAllVisitorsList(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update attendee block status */
router.patch("/v1/update/approve/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		visitors.updateVisitorApproveStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get visitors listing -done */
router.get("/v1/all/approved/visitors", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	visitors.getAllApprovedVisitorsList(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* send mail to approved visitors for activate ticket */
router.post("/v1/activate/approved/visitors/pass", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents], function (req, res) {
	let data = req.body;
	data.req = req.data;

	visitors.activateApprovedVisitorsPass(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update visitors - done*/
router.patch("/v1/update/purchase/status", [authenticator, authenticateRole([role.user,role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	visitors.updateVisitorPurchaseStatus(data, function (err, response) {
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