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
const filterEvents = require('../middlewares/filterEventsForRoles')();

//controllers
const notifications = require("../controllers/notifications");

//schedule notifications
router.post("/v1/schedule/notification",
	[authenticator, authenticateRole([role.eventadmin, role.marketingmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		notifications.addNotifications(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//schedule notifications by superadmin
router.post("/v1/schedule/superadmin/notification",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		notifications.addNotifications(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


/* Get notification listing for Admin */
router.get("/v1/all/notifications",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.marketingmanager])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		notifications.getAllNotificationsForAdmin(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get notification listing for Admin */
router.get("/v1/get/user/notifications",
	[authenticator, authenticateRole([role.user])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		notifications.getUserNotifications(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get unread notifications count for user */
router.get("/v1/user/unread/count", [authenticator, authenticateRole([role.user])], function (req, res) {
	let data = req.query;
	data.req = req.data;

	notifications.userGetUnreadNotificationsCount(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

router.patch("/v1/read/notifications",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		notifications.readNotifications(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.patch("/v1/delete/notifications",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		notifications.deleteNotification(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


router.get("/v1/send/multiple/notifications",
	[authenticator, authenticateRole([role.eventadmin, role.marketingmanager])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		notifications.sendMultipleNotification(data, function (err, response) {
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