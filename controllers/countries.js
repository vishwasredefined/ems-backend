const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");
const Country = require("country-state-city");

// Model
const Countries = require("../models/countries");
const States = require("../models/states");
const Cities = require("../models/cities");
const Currencies = require("../models/currencies");

// Helpers Required in controller
const utilities = require("../helpers/security");
const responseUtilities = require("../helpers/sendResponse");


//controller get country for users
exports.getCountriesForClient = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = { isDeleted: false };
	Countries.find(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Countries: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getCountriesForClient",
					null,
					null
				)
			);
		}

		let sendData = {
			data: res,
		};

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Countries fetched",
				"getCountriesForClient",
				sendData,
				null
			)
		);
	});
};

//controller get States for users
const getStatesForClient = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.country_id || data.country_id == "null") {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"getStatesForClient",
				null,
				null
			)
		);
	}

	Countries.findOne({ _id: data.country_id }, (err, country) => {
		if (err) {
			console.error("Unable to get Countries: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getCountriesForClient",
					null,
					null
				)
			);
		}
		if (!country) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"Country not found",
					"getStatesForClient",
					null,
					null
				)
			);
		}
		let country_data = country;
		let findData = { country_id: country_data.id };
		States.find(findData, (err, res) => {
			if (err) {
				console.error("Unable to get States: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getStatesForClient",
						null,
						null
					)
				);
			}

			let sendData = {
				data: res,
			};

			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"States fetched",
					"getStatesForClient",
					sendData,
					null
				)
			);
		});
	});
};
exports.getStatesForClient = getStatesForClient;

//controller get Cities for users
const getCityForClient = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.state_id || data.state_id == "null") {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"getCityForClient",
				null,
				null
			)
		);
	}
	if (!mongoose.Types.ObjectId.isValid(data.state_id)) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Invalid Parameter",
				"getCityForClient",
				null,
				data.req.signature
			)
		);
	}

	States.findOne({ _id: data.state_id }, (err, states) => {
		if (err) {
			console.error("Unable to get States: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getCityForClient",
					null,
					null
				)
			);
		}
		if (!states) {
			return cb(
				responseUtilities.sendResponse(
					400,
					"State not found",
					"getCityForClient",
					null,
					null
				)
			);
		}
		let state_data = states;

		let findData = { state_id: state_data.id };
		Cities.find(findData, (err, res) => {
			if (err) {
				console.error("Unable to get City: ", err);
				return cb(
					responseUtilities.sendResponse(
						500,
						null,
						"getCityForClient",
						null,
						null
					)
				);
			}

			let sendData = {
				data: res,
			};

			return cb(
				null,
				responseUtilities.sendResponse(
					200,
					"Cities fetched",
					"getCityForClient",
					sendData,
					null
				)
			);
		});
	});
};
exports.getCityForClient = getCityForClient;

//controller get Cities by country
exports.getCitiesByCountry = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.country_id || data.country_id == "null") {
		return cb(
			responseUtilities.sendResponse(
				400,
				"Missing params",
				"getCitiesByCountry",
				null,
				null
			)
		);
	}
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getStatesForClient, data));
	waterfallFunctions.push(async.apply(fetchCities, data));
	async.waterfall(waterfallFunctions, cb);
}

//controller get Cities by country
const fetchCities = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!response.data) {
		return cb(
			responseUtilities.sendResponse(
				400,
				"No Cities Found",
				"getCityForClient",
				null,
				null
			)
		);
	}
	let stateIds = response.data.data.map((el) => el.id)
	let findData = { state_id: { $in: stateIds } };
	Cities.find(findData, (err, res) => {
		if (err) {
			console.error("Unable to get City: ", err);
			return cb(
				responseUtilities.sendResponse(
					500,
					null,
					"getCityForClient",
					null,
					null
				)
			);
		}

		let sendData = {
			data: res,
		};

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				"Cities fetched",
				"getCityForClient",
				sendData,
				null
			)
		);
	});
};



/**
 * 
 * @param {*} data 
 * @param {*} response 
 * @param {*} cb 
 * @returns List of cities bu country_id or state_id
 */
exports.getCities = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.country_id && !data.state_id) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "getCities", null, null));
	}


	let waterfallFunctions = [];
	if (data.state_id) {
		waterfallFunctions.push(async.apply(getCityForClient, data));
	}
	else if (data.country_id) {
		waterfallFunctions.push(async.apply(getStatesForClient, data));
		waterfallFunctions.push(async.apply(fetchCities, data));
	}

	async.waterfall(waterfallFunctions, cb);
};


//controller get country for users
exports.getCurrencies = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	let findData = { isDeleted: false };
	Currencies.find(findData, (err, res) => {
		if (err) {
			console.error("Unable to get Countries: ", err);
			return cb(responseUtilities.sendResponse(500, null, "getCurrencies", null, null));
		};


		let DTS = res;
		// const emoji = require('node-emoji');
		// DTS = res.map((item) => {
		// 	// console.log("--",emoji.get(item?.flagIcon))
		// 	const flagIcon = item?.flagIcon ? emoji.get(item?.flagIcon) : ''; // Convert flagIcon if it exists
		// 	return {
		// 		flagIcon: flagIcon,
		// 		_id: item?._id,
		// 		currency: item.currency
		// 	};
		// });


		return cb(null, responseUtilities.sendResponse(200, "Currencies fetched", "getCurrencies", DTS, null));
	});
};