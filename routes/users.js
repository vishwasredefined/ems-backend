const express = require('express');
const router = express.Router();

const json2xls = require('json2xls');
router.use(json2xls.middleware);
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

const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const filterEvents = require('../middlewares/filterEventsForRoles')();

/* Controllers */
const users = require('../controllers/users');

/* Get all users */
router.get('/v1/all/users', [authenticator, authenticateRole([role.eventadmin, role.superadmin])], function (req, res, next) {
	let data = req.query;
	data.req = req.data;

	users.getAllUsers(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get user by id. */
router.get("/v1/user/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	users.getUserById(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get user profile */
router.get("/v1/profile", [authenticator, authenticateRole([role.user])], function (req, res) {
	let data = req.query;
	data.req = req.data;
	users.getUserProfile(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update user details*/
router.patch("/v1/update",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		users.updateUser(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//verify Updated Mobile
router.put(
	"/v1/update/deviceInfo",
	[authenticator, authenticateRole([role.user, role.eventadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;
		data.headers = req.headers;

		users.updateDeviceInfo(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	}
);

/*update user profile */
router.patch("/v1/update/profile",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		users.updateUserProfile(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*update user block status - superadmin */
router.patch("/v1/update/block/status",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		users.updateUserBlockStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.get("/v1/export",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res, next) {

		let data = req.query;
		data.req = req.data;

		users.exportAllUsers(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err)
			}
			status = response.status;
			return res.status(status).xls("userData.xlsx", response.data);
		})
	}
)

//get total count of 24-h signup users for superadmin
router.get("/v1/get/superadmin/users/signup/count",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		users.getUserSignupCountForSuperadmin(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//get total count of 24-h signup users for agency
router.get("/v1/get/agency/users/signup/count",
	[authenticator, authenticateRole([role.eventadmin]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		users.getUserSignupCountForAgency(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//get total count of users for superadmin
router.get("/v1/get/superadmin/users/count",
	[authenticator, authenticateRole([role.superadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		users.getUserCountForSuperadmin(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//get total count of users for agency
router.get("/v1/agency/users/onboarded/count",
	[authenticator, authenticateRole([role.eventadmin])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		users.getOnboardedUserCountForAgency(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*Add Bookmark */
router.patch("/v1/bookmark/entity",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		users.bookmarkUserEntity(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*Show interest in an event */
router.post("/v1/event/interest",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		users.addInterestInEvent(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*Get my bookmarks */
router.get("/v1/bookmarks",
	[authenticator, authenticateRole([role.user])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		users.getMyBookmarks(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/*add device token */
router.post("/v1/add/device/token",function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	users.addInstalledDevicesToken(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*delete device token */
router.delete("/v1/delete/device/token",function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	users.deleteInstalledDevicesToken(data, function (err, response) {
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