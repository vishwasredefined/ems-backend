const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const suggestionSchema = new Schema({
    suggestion: String, 
    
    // Applying User
    userId: { type: Schema.Types.ObjectId, ref: 'User' },

    // Event related Details
    eventId: { type: Schema.Types.ObjectId, ref: 'event' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Status Information
    isDeleted: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },

},{
    timestamps: true
})

module.exports = mongoose.model('suggestions', suggestionSchema);