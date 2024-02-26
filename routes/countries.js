const express = require("express");
const router = express.Router();

/* Middlewares */
const formatRequest = require("../middlewares/formatRequest");
router.use(formatRequest);
const clients = {
	users: {
		host: process.env.SERVICE_RPC_HOST,
		port: process.env.CORE_USER_PORT,
	},
};
// isDeleted=false
const data = {};
const authenticator = require("../middlewares/authenticator")(clients, data);
const authenticateRole = require("../middlewares/authenticateRole");
const role = JSON.parse(process.env.role);


/* Controllers */
const countries = require("../controllers/countries");

/* Routes */

/* Add countries */
/* router.post("/v1/add", function (req, res, next) {
  let data = req.body;
  data.req = req.data;

  countries.addCountries(data, function (err, response) {
	let status = 0;
	if (err) {
	  status = err.status;
	  return res.status(status).send(err);
	}
	status = response.status;
	return res.status(status).send(response);
  });
}); */

/* Get Coutries list*/
router.get("/v1/countries", function (req, res) {
	let data = req.query;
	data.req = req.data;

	countries.getCountriesForClient(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get state list*/
router.get("/v1/states", function (req, res) {
	let data = req.query;
	data.req = req.data;

	countries.getStatesForClient(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get City list*/
router.get("/v1/city", function (req, res) {
	let data = req.query;
	data.req = req.data;

	countries.getCityForClient(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get City list*/
router.get("/v1/cities", function (req, res) {
	let data = req.query;
	data.req = req.data;

	countries.getCitiesByCountry(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});

/* Get City list by country*/
router.get("/v1/cities/listing", function (req, res) {
	let data = req.query;
	data.req = req.data;

	countries.getCities(data, function (err, response) {
		let status = 0;
		if (err) {
			status = err.status;
			return res.status(status).send(err);
		}
		status = response.status;
		return res.status(status).send(response);
	});
});


/* Get Coutries list*/
router.get("/v1/currencies", function (req, res) {
	let data = req.query;
	data.req = req.data;

	countries.getCurrencies(data, function (err, response) {
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
