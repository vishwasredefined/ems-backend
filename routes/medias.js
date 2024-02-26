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
const medias = require("../controllers/medias");

//add medias
router.post("/v1/add",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		medias.addMedia(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update media details*/
router.patch("/v1/update/media", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager])], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	medias.updateMedia(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get medias listing for Admin */
router.get("/v1/all/medias", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	medias.getAllMedias(data, function (err, response) {
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
router.get("/v1/medias", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;

	medias.getMediasList(data, function (err, response) {
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
router.get("/v1/app/medias", [authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.app = true;

	medias.getMediasList(data, function (err, response) {
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
router.get("/v1/medias/for/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager])], function (req, res) {
	let data = req.query;
	data.req = req.data;
	data.eventSpecific = true

	medias.getMediasForEvent(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get all the event in which media partner is assigned */
router.get("/v1/media/event", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager])], function (req, res) {
	let data = req.query;
	data.req = req.data;

	medias.getMediaEvents(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get media by id. -done */
router.get("/v1/media/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	medias.getMediaById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});




/*update media block status */
router.patch("/v1/update/block/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		medias.updateMediaBlockStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get medias listing */
router.get("/v1/latest/medias",
	// [authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin,role.eventmanager, role.marketingmanager, role.financemanager, role.staff]),filterEvents], 
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		medias.getLatestMedias(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get medias listing */
router.get("/v1/latest/medias/for/user",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		medias.getLatestMedias(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/** Export media partners */
router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin, role.eventadmin]), filterEvents],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		medias.exportAllMediaPartners(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("media.xlsx", response.data);
		})
	}
)
module.exports = router;
