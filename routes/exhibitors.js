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
const exhibitors = require("../controllers/exhibitors");

//add exhibitor
router.post("/v1/add",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		exhibitors.addExhibitor(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get exhibitor listing for Admin */
router.get("/v1/all/exhibitors",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		exhibitors.getAllExhibitors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get exhibitor listing */
router.get("/v1/exhibitors", [authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager])], function (req, res) {
	let data = req.query;
	data.req = req.data;

	exhibitors.getExhibitor(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get media listing */
router.get("/v1/exhibitors/for/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	exhibitors.getExhibitorsForEvent(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get media listing */
router.get("/v1/exhibitor/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager])], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	exhibitors.getExhibitorEvents(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get exhibitor by id. */
router.get("/v1/exhibitor/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	exhibitors.getExhibitorById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update exhibitors */
router.patch("/v1/update/exhibitor", [authenticator, authenticateRole([role.superadmin, role.eventadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	exhibitors.updateExhibitor(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update exhibitor block status */
router.patch("/v1/update/block/status",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		exhibitors.updateExhibitorBlockStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get exhibitors listing */
router.get("/v1/latest/exhibitors",
	// [authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin,role.eventmanager, role.marketingmanager, role.financemanager, role.staff]),filterEvents], 
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		exhibitors.getLatestExhibitors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get exhibitors listing */
router.get("/v1/latest/exhibitors/for/user",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		exhibitors.getLatestExhibitors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/** Export exhibitors */
router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin])],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		exhibitors.exportAllExhibitors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("exhibitors.xlsx", response.data);
		})
	}
)
module.exports = router;
