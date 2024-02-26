const Coinpayments = require('coinpayments');

//Helpers
const responseUtilities = require('../helpers/sendResponse');

let client = new Coinpayments({
    key: process.env.COINS_PAYMENT_PUBLIC,// public key
    secret: process.env.COINS_PAYMENT_PRIVATE // private key 
});

const createTransaction = async function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    /*
    amount	The amount of the payment in the original currency(currency1 below).
    currency1	The original currency of the payment.
    currency2	The currency the buyer will be sending.For example if your products are priced in USD but you are receiving BTC, you would use currency1 = USD and currency2 = BTC.
    currency1 and currency2 can be set to the same thing if you don't need currency conversion.
    */
    let input_data = {
        currency1: "LTCT" || process.env.baseCurrency,
        currency2: data.token, //Token Name
        amount: data.amount,
        buyer_email: data.req.auth.email,
        type: data.type,
        // address: data.address, Extra fields tobe considered in specific case
        // success_url: data.success_url,
        // cancel_url: data.cancel_url,

    }
    try {

        console.log("Create CP Transaction => ", input_data)
        let gatewayResponse = await client.createTransaction({
            'currency1': `${input_data.currency1}`,
            'currency2': `${input_data.currency2}`,
            'amount': input_data.amount,
            'buyer_email': `${input_data.buyer_email}`,
            'item_name': `${input_data.type}`
        });
        console.log("Gateway response => ", gatewayResponse)
        data.gatewayData = {
            "txnId": gatewayResponse.txn_id,
            "address": gatewayResponse.address,
            "destTag": gatewayResponse.dest_tag,
            "confirmsNeeded": gatewayResponse.confirms_needed,
            "timeout": gatewayResponse.timeout,
            "checkoutUrl": gatewayResponse.checkout_url,
            "statusUrl": gatewayResponse.status_url,
            "qrcodeUrl": gatewayResponse.qrcode_url,
            "token": data.token,
            "cryptoCoins": parseFloat(gatewayResponse.amount),
            "currentusdRate": (1 / parseFloat(gatewayResponse.amount)) * (parseFloat(data.amount)),
            "amount": parseFloat(data.amount)
        }
        data.txn_id = gatewayResponse.txn_id;
        return cb(null, responseUtilities.sendResponse(200, "Created Transaction", "coinsPayment.createTransaction", gatewayResponse, null));


    } catch (err) {
        console.error(err)
        return cb(responseUtilities.sendResponse(500, "Something went wrong", "coinsPayment.createTransaction", err?.extra?.data?.error || null, null));
    }
};

exports.createTransaction = createTransaction


const getTransaction = async function (txnId, response, cb) {
    if (!cb) {
        cb = response;
    }
    try {
        let gatewayResponse = await client.getTx({
            'txid': `${txnId}`
        });
        return cb(null, responseUtilities.sendResponse(200, "getTransaction", "coinsPayment.createTransaction", gatewayResponse, null));
    } catch (err) {
        console.error(err)
        return cb(responseUtilities.sendResponse(500, "Something went wrong", "coinsPayment.createTransaction", null, null));
    }
};

exports.getTransaction = getTransaction