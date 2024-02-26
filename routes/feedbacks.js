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

//controllers
const feedbacks = require("../controllers/feedbacks");


//Add rating and reviews
router.post("/v1/add/feedback",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		feedbacks.addAgendaFeedbacks(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get rating and reviews
router.get("/v1/get/feedbacks",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		feedbacks.getAgendaFeedbacks(data, function (err, response) {
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
