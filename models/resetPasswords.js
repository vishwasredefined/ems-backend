let mongoose = require('./db');
const moment = require('moment');

// grab the things we need
let Schema = mongoose.Schema;

var minuteFromNow = function () {
    var timeObject = new Date();
    timeObject.setTime(timeObject.getTime() + 1000 * 60 * 60 * 6);
    return timeObject;
};

let resetPasswordSchema = new Schema({
    email: String,
    expiryTime: { type: Date, default: minuteFromNow },
    isActive: Boolean,
    isExpired: {type:Boolean, default:false},
    ip: String,
    browser: String,
    device: String
},{ timestamps: true });

const resetPasswords = mongoose.model('resetPasswords', resetPasswordSchema);

module.exports = resetPasswords;