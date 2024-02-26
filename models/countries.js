const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const countrySchema = new Schema(
    {

        id: { type: Number },
        name: { type: String, },
        sortname: { type: String, },
        phoneCode: { type: Number, },

        language: { type: String },
        languageCode: { type: String },
        isDeleted: { type: Boolean, default: false },

        currency: {
            code: { type: String },
            name: { type: String },
            symbol: { type: String }
        },

        flag: { type: String },
        flagIcon: { type: String },
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('countries', countrySchema);
