/**
 * Database config and initialization
 */

const mongoose = require('mongoose');
const env = process.env.DB_ENV || "development";
const opt = {
	// user: user,
	// pass: pass,
	// auth: {
	//     authdb: "admin"
	// },
	useUnifiedTopology: true,
	useFindAndModify: false,
	useNewUrlParser: true
};

const connstring = process.env.mongoConnectionString;
console.log("connstring:", connstring);

const connectWithRetry = function () {
	return mongoose.connect(connstring, opt, function (err) {
		if (err) {
			console.error('Failed to connect to mongo on startup - retrying in 5 sec', err);
			setTimeout(connectWithRetry, 5000);
		} else {
			console.log("mongodb connected");
		}
	});
};
connectWithRetry();

module.exports = mongoose;
