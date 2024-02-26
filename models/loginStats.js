let mongoose = require('./db');

// grab the things we need
let Schema = mongoose.Schema;

var LoginStatsSchema = new Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
      },
    userIp: String,
    deviceType: String,
    browser: String,
    countryCode: String,
    countryName: String,
    timezone: String,
    token: String,
    lastLoginTime: { type: Date, default: Date.now },
    lastLogoutTime: { type: Date}
},{ timestamps: true });

const loginStats = mongoose.model('loginstats', LoginStatsSchema);

module.exports = loginStats;