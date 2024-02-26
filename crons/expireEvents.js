require("../config/index")
const db = require("../models/db");

const cron = require("node-cron");


//Models
const Events = require("../models/events");

cron.schedule("* * * * *", function () {
	//every day at 1 am
	expireAfterEventEnd();
});

const expireAfterEventEnd = function () {
	let currentDate = new Date();
	currentDate = new Date(new Date((currentDate.setDate((currentDate.getDate()-1) || 0))).setUTCHours(0,0,0,0))
	
	let findData = { expired: false, endDate: { $exists: true }, endDate: { $lte: currentDate } };
	let updateData = { $set: { expired: true, isActive : false, isFeatured : false} };
	let options = { multi: true }
	
	console.log("=============find/update data for event expire========", findData,updateData )
	console.log("events expire ")
	Events.updateMany(
		findData,
		updateData,
		options,
		(err, res) => {
			if (err) {
				console.error("Unable to expire event ", err);
			}
			console.log("events expire set to true")
		}
	);
};
