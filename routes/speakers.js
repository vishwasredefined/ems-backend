const express = require("express");
const router = express.Router();
const path = require("path");

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
const speakers = require("../controllers/speakers");

// Add speaker
router.post("/v1/add", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	speakers.addSpeaker(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get speaker listing for Admin: Pagination */
router.get("/v1/all/speakers", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	speakers.getAllSpeakers(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});



// Why?
router.get("/v1/speakers/for/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	speakers.getSpeakersForEvent(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get speaker assigned events */
router.get("/v1/speaker/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	speakers.getSpeakerEvents(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get speaker by id. */
router.get("/v1/speaker/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	speakers.getSpeakerById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update speakers */
router.patch("/v1/update/speaker", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	speakers.updateSpeaker(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update speakers block status */
router.patch("/v1/update/block/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		speakers.updateSpeakerBlockStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


/** Export speakers */
router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin])],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		speakers.exportAllSpeakers(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("speakers.xlsx", response.data);
		})
	}
)

/*------------------------------------------------------APP ROUTES-------------------------------------------------------------------- */

/* Get speaker listing : APP Endpoint*/
router.get("/v1/speakers",
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		speakers.getSpeakers(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get speaker listing: APP */
router.get("/v1/latest/speakers",
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		speakers.getLatestSpeakers(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


/* Get speaker listing */
router.get("/v1/latest/speakers/for/user",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		speakers.getLatestSpeakers(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get speaker listing */
router.get("/v1/app/specific",
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		speakers.getSpecificSpeakerForApp(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get speaker listing */
router.get("/v1/app/specific/loggedin",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		speakers.getSpecificSpeakerForApp(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.post("/v1/download/member/file",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin])],
	function (req, res) {
		let data = req.body;
		data.req = req.data;

		speakers.downloadMemberFile(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			let filePath = path.join(__dirname, "..", response.data);
			return res.status(status).download(filePath);
		});
	});

module.exports = router;
