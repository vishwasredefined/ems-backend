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
const filterEvents = require('../middlewares/filterEventsForRoles')();
const role = JSON.parse(process.env.role);

//controllers
const packages = require("../controllers/packages");

//add package
router.post("/v1/add",
	[authenticator, authenticateRole([role.eventadmin, role.eventmanager])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		packages.addPackage(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Get speaker listing for Admin */
router.get("/v1/all/packages",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.financemanager, role.marketingmanager]), filterEvents],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		packages.getAllPackages(data, function (err, response) {
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
router.get("/v1/package/:id", function (req, res) {
	let data = { id: req.params.id };
	data.req = req.data;
	packages.getPackageById(data, function (err, response) {
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
router.patch("/v1/update/package", [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager])], function (req, res, next) {
	let data = req.body;
	data.req = req.data;

	packages.updatePackage(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/*update event package status*/
router.patch("/v1/updates/status",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager])],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		packages.updatePackageStatus(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});


/***************************************************** APP ENDPOINTS************************************************************** */

router.get("/v1/packages",
	// [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.financemanager, role.marketingmanager])], 
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		packages.getpackages(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

router.get("/v1/packages/by/type",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.superadmin, role.eventmanager, role.financemanager, role.marketingmanager])],
	function (req, res) {
		let data = req.query;
		data.req = req.data;

		packages.getpackagesByType(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

//check package quantity available
router.get("/v1/verify/package/quantity",
	[authenticator, authenticateRole([role.user, role.eventadmin, role.eventmanager])],
	function (req, res, next) {
		let data = req.query;
		data.req = req.data;

		packages.verifyPackageQuantity(data, function (err, response) {
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
