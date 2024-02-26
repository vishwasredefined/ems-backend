const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbacksSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    eventId: { type: Schema.Types.ObjectId, ref: 'event' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    agendaId :  { type: Schema.Types.ObjectId, ref: 'agendas' },
    feedback: { type: Number }, // 1 for "VeryBad", 2 for "Poor", 3 for "Medium", 4 for "Good", 5 for "Excellent"
    isApproved: { type: Boolean, default: true },

},{
    timestamps: true
});

module.exports = mongoose.model('feedbacks', feedbacksSchema);