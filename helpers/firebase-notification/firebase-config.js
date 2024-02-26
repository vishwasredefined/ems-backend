var admin = require("firebase-admin");

var serviceAccount = require("./firebase-json/ems.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//Old file
// databaseURL: "https://osho-9005c.firebaseio.com"
// databaseURL: "https://ondm-ec244.firebaseio.com"

module.exports.admin = admin