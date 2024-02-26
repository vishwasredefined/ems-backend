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
const role = JSON.parse(process.env.role);
const suggestions = require("../controllers/suggestions");

//Add suggestions to the event
router.post("/v1/add/suggestion",
	[authenticator, authenticateRole([role.user, role.eventadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		suggestions.addEventSuggestions(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


//Get event suggestions
router.get("/v1/get/suggestions",
	[authenticator, authenticateRole([role.eventadmin, role.manager])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		suggestions.getEventSuggestions(data, function (err, response) {
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
