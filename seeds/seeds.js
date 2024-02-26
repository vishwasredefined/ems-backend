'use strict';

const config = require('../config/index');
const crypto = require('crypto');
const User = require('../models/users');
const Countries = require('../models/countries');
const statesModel = require('../models/states');
const citiesModel = require('../models/cities');
const Currencies = require("../models/currencies");

const salt = crypto.randomBytes(16).toString('base64')
const randomSalt = Buffer(salt, 'base64');
const { Kinesis } = require('aws-sdk');

const { cities } = require('./citiesNew');
const { states } = require('./states');
const { countries } = require('./newCountries');
const { allCurrencies } = require("./currencies");

let insertUser = [
	{
		_id: "601e3c6ef5eb242d4408dcc5",
		name: "superadmin",
		email: "superadmin@ith.tech",
		accountId: "12345678",
		provider: "email",
		role: 'superadmin',
		userName: 'super_admin_seed',
		password: crypto.pbkdf2Sync('123456789', randomSalt, 10000, 64, 'sha1').toString('base64'),
		salt: salt,
		emailVerified: true,
		isActive: true
	},
	{
		_id: "601e3c6ef5eb242d4408dcc6",
		name: "admin",
		email: "admin@ith.tech",
		accountId: "11223344",
		provider: "email",
		role: 'eventadmin',
		userName: 'admin_seed',
		password: crypto.pbkdf2Sync('123456789', randomSalt, 10000, 64, 'sha1').toString('base64'),
		salt: salt,
		emailVerified: true,
		isActive: true
	},
	{
		_id: "601e3c6ef5eb242d4408dcc7",
		name: "user",
		email: "user@ith.tech",
		accountId: "87654321",
		provider: "email",
		role: 'user',
		userName: 'user_seed',
		password: crypto.pbkdf2Sync('123456789', randomSalt, 10000, 64, 'sha1').toString('base64'),
		salt: salt,
		emailVerified: true,
		isActive: true
	}
]

let seedUsers = () => {
	User.find({}, (err, resp) => {
		if (resp.length > 0) {
			return;
		} else {
			User.create(insertUser, (err, response) => {
				if (err) {
					console.log(err)
					console.error("Unable to create user");
					// process.exit(0)

					return
				}
				console.log("User Created");
				// process.exit(0)

			});
		}
	});
}

const seedCountries = () => {
	Countries.find({}, (err, resp) => {
		if (resp.length > 0) {
			console.log("countries alredy exist")
			return;
		}

		Countries.insertMany(countries, (err, response) => {
			if (err) {
				console.log(err)
				console.error("Unable to create country");
				return
			}
			console.log("country Created");
		});

	})
}



const seedStates = () => {
	statesModel.find({}, (err, resp) => {
		if (resp.length > 0) {
			console.log("states alredy exist")
			return;
		}
		statesModel.insertMany(states, (err, response) => {
			if (err) {
				console.log(err)
				console.error("Unable to create states");
				return
			}
			console.log("states Created");
		});

	})
		.catch((err) => {
			console.log(err);
		})
}



const seedCities = () => {
	citiesModel.find({}, (err, resp) => {
		if (resp.length > 0) {
			console.log("cities alredy exist")
			return;
		}
		citiesModel.insertMany(cities, (err, response) => {
			if (err) {
				console.log(err)
				console.error("Unable to create cities");
				return
			}
			console.log("cities Created");
		});

	})
		.catch((err) => {
			//console.log(err.message);
		})
}


const seedCurrencies = () => {
	Currencies.find({}, (err, resp) => {
		if (resp.length > 0) {
			console.log("Currencies alredy exist")
			return;
		}
		console.log("currencies", allCurrencies)
		Currencies.insertMany(allCurrencies, (err, response) => {
			if (err) {
				console.log(err)
				console.error("Unable to create currencies");
				return
			}
			console.log("Currencies Created");
		});

	})
}

seedCountries();
seedStates();
seedCities();
seedUsers();
seedCurrencies();