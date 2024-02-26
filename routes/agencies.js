const express = require('express');
const router = express.Router();

/* Middlewares */
const data = {};
const formatRequest = require('../middlewares/formatRequest');
router.use(formatRequest);

const clients = {
	users: {
		host: process.env.SERVICE_RPC_HOST,
		port: process.env.SC_USER_PORT
	}
};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const role = JSON.parse(process.env.role);

/* Controllers */
const agencies = require('../controllers/agencies');

/* Get agency by id. */
router.get("/v1/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	agencies.getAgencyById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Super admin adds Event Admin( Agency )*/
router.post("/v1/superadmin/add/eventadmin",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agencies.addEventadmin(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Super admin gets Event Admin(Agency) listing */
router.get("/v1/superadmin/list/eventadmin/pagination",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		agencies.getEventadmins(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Super admin edits Event Admin( Agency )*/
router.patch("/v1/superadmin/edit/eventadmin",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agencies.updateAgencyDetails(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Superadmin blocks event admin - change controller*/
router.patch("/v1/superadmin/block/eventadmin",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agencies.blockEventAdmin(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});
;

//Without pagination agency listing
router.get("/v1/superadmin/list/eventadmin",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		agencies.getEventadminsWithoutPagination(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* event admin edits Event Admin( Agency )*/
router.patch("/v1/edit/profile",
	[authenticator, authenticateRole([role.eventadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		agencies.agencyUpdateProfileDetails(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.get("/v1/profile/info",
	[authenticator, authenticateRole([role.eventadmin])]
	, function (req, res) {
		let data = req.query
		data.req = req.data;
		agencies.agencyGetProfileDetail(data, function (err, response) {
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