const express = require("express");
const router = express.Router();

const json2xls = require('json2xls');
router.use(json2xls.middleware);
const filterEvents = require('../middlewares/filterEventsForRoles')();

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
const eventQuestions = require("../controllers/eventQuestions");


//Add event additional questions
router.post("/v1/add/event/questions",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		eventQuestions.addEventAdditionalQuestions(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get event additional questions
router.get("/v1/all/event/questions",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		eventQuestions.getEventAdditionalQuestions(data, function (err, response) {
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
router.get("/v1/question/:id", 
    [authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
    function (req, res) {
        let data = { id: req.params.id };
        data.req = req.data;
        eventQuestions.getEventQuestionById(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
});

/*change speakers status */
router.patch("/v1/update/question", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager])], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	eventQuestions.updateEventQuestion(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update event question status*/
router.patch("/v1/update/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		eventQuestions.updateEventQuestionStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get event additional questions
router.get("/v1/all/question/responses",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		eventQuestions.getEventQuestionResponses(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get event additional questions
router.get("/v1/export/question/responses",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		eventQuestions.exportEventQuestionResponses(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).xls("questionResponse.xlsx", response.data);
		});
	});

/* Get events additional info by id. */
router.get("/v1/event/additional/info/:eventId",
	[authenticator, authenticateRole([role.superadmin, role.user, role.eventadmin, role.eventmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = { eventId: req.params.eventId };
		data.req = req.data;
		eventQuestions.getEventAdditionInfoByEventId(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Get event additional questions response count
router.get("/v1/all/question/responses/count",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		eventQuestions.getEventQuestionResponsesCount(data, function (err, response) {
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
