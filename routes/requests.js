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

const json2xls = require('json2xls');
router.use(json2xls.middleware);

const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const role = JSON.parse(process.env.role);
const filterEvents = require('../middlewares/filterEventsForRoles')();

//controllers
const requests = require("../controllers/requests");

//Apply as speaker.
router.post("/v1/apply/as/speaker",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;
		data.appRequest = true;

		requests.applyAsSpeaker(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.post("/v1/apply/as/media",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;
		data.appRequest = true;

		requests.applyAsMedia(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.post("/v1/apply/as/sponsor",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;
		data.appRequest = true;

		requests.applyAsSponsor(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.post("/v1/apply/as/exhibitor",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;
		data.appRequest = true;

		requests.applyAsExhibitor(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get requests listing for Admin with pagination+filters  */
router.get("/v1/all/requests", [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	requests.getAllJoiningRequestsForAdmin(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*change requests status */
router.patch("/v1/update/request", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	requests.updateRequestStatus(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*change requests status */
router.patch("/v1/update/details", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	requests.updateRequestData(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/** Export requests */
router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin]), filterEvents],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		requests.exportAllRequests(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("requests.xlsx", response.data);
		})
	}
);

/* Get visitors by id. -done */
router.get("/v1/:id", function (req, res) {
	let data = { requestId: req.params.id };
	data.req = req.data;
	requests.getSpecificRequest(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

router.post("/v1/validate/already/applied/entity", function (req, res) {
	let data =  req.body;
	data.req = req.data;
	requests.validateAlreadyAppliedEntity(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get requests listing for user app */
router.get("/v1/all/app/requests", [authenticator, authenticateRole([role.eventadmin, role.user]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	requests.getAllJoiningRequestsForUser(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get requests listing for user app */
router.patch("/v1/update/app/request", [authenticator, authenticateRole([role.eventadmin, role.user]), filterEvents], function (req, res) {
	let data = req.body;
	data.req = req.data;

	requests.updateJoiningRequestsForUser(data, function (err, response) {
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
