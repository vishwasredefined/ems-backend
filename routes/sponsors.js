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

//Controllers
const sponsors = require("../controllers/sponsors");

//Add sponsor
router.post("/v1/add",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		sponsors.addSponsor(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get sponsor listing for Admin : Pagination */
router.get("/v1/all/sponsors",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		sponsors.getAllSponsors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get sponsor listing */
router.get("/v1/sponsors", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	sponsors.getSponsor(data, function (err, response) {
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
router.get("/v1/sponsors/for/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	sponsors.getSponsorsForEvent(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get events assigned to Sponsor */
router.get("/v1/sponsor/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	sponsors.getSponsorEvents(data, function (err, response) {
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
router.get("/v1/get/sponsors/by/package",
	// [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		sponsors.getEventSponsorsByPackage(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get sponsor by id. */
router.get("/v1/sponsor/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	sponsors.getSponsorById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update sponsors */
router.patch("/v1/update/sponsor", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	sponsors.updateSponsor(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update sponsor block status */
router.patch("/v1/update/block/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		sponsors.updateSponsorBlockStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});



/** Export sponsors */
router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin])],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		sponsors.exportAllSponsors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("sponsors.xlsx", response.data);
		})
	}
)




/******************************************APP***********************************************8 */
/* Get sponsor listing */
router.get("/v1/latest/sponsors",
	// [authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin,role.eventmanager, role.marketingmanager, role.financemanager, role.staff]),filterEvents], 
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		sponsors.getLatestSponsors(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get sponsors listing */
router.get("/v1/latest/sponsors/for/user",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		sponsors.getLatestSponsors(data, function (err, response) {
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
