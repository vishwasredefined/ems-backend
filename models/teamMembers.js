let mongoose = require('./db');

// grab the things we need
let Schema = mongoose.Schema;

// create a schema
let teamMemberSchema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "event" },
    assigned:{ type: Boolean, default: false},
    role: String,
    eventAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// we need to create a model using it
let teammembers = mongoose.model('teammembers', teamMemberSchema);

module.exports = teammembers;