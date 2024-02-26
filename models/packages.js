const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const packagesSchema = new Schema({

	type: { type: String },
	title: { type: String },
	description: { type: String },
	price: { type: Schema.Types.Decimal128 },
	quantity: { type: Number },
	currency: { type: String },
	currencyId: { type: Schema.Types.ObjectId, ref: 'currencies' },
	eventId: { type: Schema.Types.ObjectId, ref: 'event' },
	eventAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
	isActive: { type: Boolean, default: true },
	isDeleted: { type: Boolean, default: false },
	isSoldOut: { type: Boolean, default: false },
	isLimitedQuantity: { type: Boolean }

}, { timestamps: true });

module.exports = mongoose.model('packages', packagesSchema);
