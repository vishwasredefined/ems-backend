const express = require('express');
const router = express.Router();

/* Middlewares */
const formatRequest = require('../middlewares/formatRequest');
router.use(formatRequest);
const role = JSON.parse(process.env.role);

const clients = {
	users: {
		host: process.env.SERVICE_RPC_HOST,
		port: process.env.SC_USER_PORT
	}
};

const json2xls = require('json2xls');
router.use(json2xls.middleware);

const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const filterEvents = require('../middlewares/filterEventsForRoles')();

/* Controllers */
const agendas = require('../controllers/agendas');

//Add event agenda
router.post("/v1/add/agenda",
	[authenticator, authenticateRole([role.eventadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agendas.addEventAgenda(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//update event agenda 
router.patch("/v1/update/agenda",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agendas.updateEventAgenda(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get event agendas */
router.get("/v1/get/event/agendas",
	[authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		agendas.getEventAgendas(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

// router.get("/v1/get/event/agendas/by/date",
// 	[authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
// 	function (req, res) {
// 		let data = req.query;
// 		data.req = req.data;

// 		agendas.getEventAgendasByDate(data, function (err, response) {
// 			let status = 0;
// 			if (err) {
// 				status = err.status;
// 				return res.status(status).send(err);
// 			}
// 			status = response.status;
// 			return res.status(status).send(response);
// 		});
// 	});

/* Get categories listing for Admin with pagination+filters  */
router.get("/v1/get/agenda/:id",
	[authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff])],
	function (req, res) {
		let data = { id: req.params.id };
		data.req = req.data;

		agendas.getEventAgendaById(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Update event agenda  status
router.patch("/v1/update/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agendas.updateEventAgendaStatus(data, function (err, response) {
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

		agendas.exportAllAgendas(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("agendas.xlsx", response.data);
		})
	}
);

/* Get event agenda questions*/
router.get("/v1/get/questions", [authenticator, authenticateRole([role.eventadmin, role.eventmanager])], function (req, res) {
	let data = req.query;
	data.req = req.data;

	agendas.getQuestions(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/**************************************************APP ROUTES************************************************************************ */


/* Get event agendas : APP*/
router.get("/v1/get/event/agendas/for/user", function (req, res) {
	let data = req.query;
	data.req = req.data;

	agendas.getEventAgendasForUser(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get event agendas : APP*/
router.get("/v1/get/event/agendas/for/loggedin/user",
	[authenticator, authenticateRole([role.user])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		agendas.getEventAgendasForUser(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//Add event agenda question
router.post("/v1/add/question", [authenticator, authenticateRole([role.user])], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	agendas.addQuestion(data, function (err, response) {
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