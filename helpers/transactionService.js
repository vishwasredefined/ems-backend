const async = require('async');

//Models
const Transactions = require('../models/transactions');
const Tickets = require("../models/tickets");
const PurchasePackages = require("../models/purchasedPackages");


//Helper Files
const coinsPayment = require('./coinPayment');
const emailUtilities = require('../helpers/email')
const utilities = require('../helpers/security');
const responseUtilities = require("../helpers/sendResponse");



/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for CP Webhook
 */
const checkTransaction = function (data, response, cb) {

    if (!cb) {
        cb = response;
    };

    console.log("Webhook Data => ", data);
    if (data && data.txn_id) {
        data.txnId = data.txn_id;
        data.checkStatus = parseInt(data.status)

        async.waterfall(
            [
                async.apply(getSpecificTransaction, data),
                async.apply(checkTransactionStatus, data),
                async.apply(updateTransactionStatus, data),
                async.apply(generatePurchasePass, data)
            ],
            cb);
    } else {
        return cb(null, responseUtilities.sendResponse(200, "TransactionService: Not valid response", "TransactionService.checkTransaction", null, data.req.signature));
    }
}
exports.checkTransaction = checkTransaction;


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting CP Webhook associated transaction 
 */
const getSpecificTransaction = function (data, response, cb) {
    if (!cb) {
        cb = response
    }
    let findData = {};

    if (data && data.txnId) {
        findData = {
            "gateway.txnId": data.txnId
        }
    }
    console.log("getSpecificTransaction => ", findData);

    Transactions.findOne(findData, function (err, res) {
        if (err) {
            return cb(responseUtilities.sendResponse(500, "Something went wrong", "getSpecificTransaction", null, null));
        };
        return cb(null, responseUtilities.sendResponse(200, "getSpecificTransaction", "getSpecificTransaction", res, null));
    });
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking Transaction Status
 */
const checkTransactionStatus = function (data, response, cb) {
    if (!cb) {
        cb = response;
    }

    if (!response || !response.data) {
        console.log("TransactionService: No transaction found")
        return cb(null, responseUtilities.sendResponse(200, "TransactionService: No transaction found", "checkTransactionStatus", null, data.req.signature));
    } else {

        let transactionObject = response.data;
        let responseData = null;

        data.transactionId = transactionObject._id;

        if (transactionObject.gateway.txnId) {
            coinsPayment.getTransaction(`${transactionObject.gateway.txnId}`, function (err, res) {

                console.log('GetTransactionCoinsPayment response is =>', res);

                if (err) {
                    console.error("TransactionService.coinsPayment.get_transactions error is ", err);
                } else {
                    if (data.checkStatus == 1) {

                        responseData = {
                            id: transactionObject._id,
                            txnId: transactionObject.gateway.txnId,
                            amount: parseFloat(transactionObject.gateway.amount),
                            token: transactionObject.gateway.token,
                            userId: transactionObject.userId,
                            paymode: transactionObject.paymode,
                            transactionType: transactionObject.transactionType,
                            status: 'PROCESSING'
                        };

                    } else {

                        if (parseFloat(res.data.receivedf) > 0) {
                            if (parseFloat(res.data.receivedf) === parseFloat(transactionObject.gateway.cryptoCoins)) {
                                responseData = {
                                    id: transactionObject._id,
                                    txnId: transactionObject.gateway.txnId,
                                    amount: parseFloat(transactionObject.gateway.amount),
                                    token: transactionObject.gateway.token,
                                    userId: transactionObject.userId,
                                    paymode: transactionObject.paymode,
                                    transactionType: transactionObject.transactionType,
                                    cryptoCoins: transactionObject.gateway.cryptoCoins,
                                    address: transactionObject.gateway.address,
                                    subscription: transactionObject.subscriptionDetails || null,
                                    status: 'COMPLETED'
                                }
                            }
                            if (parseFloat(res.data.receivedf) < parseFloat(transactionObject.gateway.cryptoCoins)) {
                                responseData = {
                                    id: transactionObject._id,
                                    txnId: transactionObject.gateway.txnId,
                                    amount: parseFloat(transactionObject.gateway.amount),
                                    holdAmount: parseFloat(res.data.receivedf),
                                    token: transactionObject.gateway.token,
                                    userId: transactionObject.userId,
                                    paymode: transactionObject.paymode,
                                    transactionType: transactionObject.transactionType,
                                    status: 'ONHOLD'
                                }
                            }
                        }
                        if (res.data.status == -1) {
                            responseData = {
                                id: transactionObject._id,
                                txnId: transactionObject.gateway.txnId,
                                amount: parseFloat(transactionObject.gateway.amount),
                                token: transactionObject.gateway.token,
                                userId: transactionObject.userId,
                                paymode: transactionObject.paymode,
                                transactionType: transactionObject.transactionType,
                                cryptoCoins: transactionObject.gateway.cryptoCoins,
                                subscription: transactionObject.subscriptionDetails || null,
                                status: 'CANCELLED'
                            }
                        }
                    }
                }

                console.log("TransactionService: Transaction status fetched final response", responseData)
                return cb(null, responseUtilities.sendResponse(200, "fetched successfully", "coinPayment.fetched", responseData, null));

            });
        }
    }
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update Transaction Status
 */
const updateTransactionStatus = function (data, response, cb) {
    if (!cb) {
        cb = response
    };

    if (!response || !response.data) {
        console.log("TransactionService: No address to update status in transaction")
        return cb(null, responseUtilities.sendResponse(200, "TransactionService: No address to update status in transaction", "createTransaction.updateTransactionStatus", null, null));
    } else {
        let transactionObject = response.data

        let find_data = {
            "gateway.txnId": transactionObject.txnId
        }
        let update_data = {
            "status": transactionObject.status
        }
        if (transactionObject.holdAmount) {

            update_data.$set = {
                'gateway.holdAmount': transactionObject.holdAmount,
                'status': transactionObject.status,

            }
        }
        Transactions.updateOne(find_data, update_data, function (err, res) {
            if (err) {
                console.error("TransactionService.updateTransactionStatus:", err);
            }
            console.log(transactionObject.transactionType);
            if (transactionObject.status == 'COMPLETED') {

                let sendMailData = {
                    // userId: transactionObject.userId,
                    // productName: transactionObject.subscription.name,
                    // amount: parseFloat(transactionObject.cryptoCoins),
                    // token: transactionObject.token,
                    // status: 'COMPLETED',
                    // validity: transactionObject.subscription.duration || "",
                    // paymode: transactionObject.paymode,
                    // txnId: transactionObject.txnId
                }


                // emailUtilities.sendPurchaseCompleteByCryptoMail(sendMailData, (errM, resM) => {
                //     if (errM) {
                //         console.log(errM)
                //     } else {
                //         console.log(resM)
                //     }

                // })
                console.log("TransactionService: Transaction status updated");
                return cb(null, responseUtilities.sendResponse(200, "TransactionService: Status updated", "createTransaction.updateTransactionStatus", transactionObject, null));

            } else {
                if (transactionObject.status == 'CANCELLED') {
                    let sendMailData = {}
                    // if (transactionObject.type == 'deposit') {

                    // id: transactionObject._id,
                    //         txnId: transactionObject.gatewaydata.txnId,
                    //         amount: parseFloat(transactionObject.gatewaydata.amount),
                    //         token: transactionObject.gatewaydata.token,
                    //         userId: transactionObject.userId,
                    //         paymode: transactionObject.paymode,
                    //         type: transactionObject.type,
                    //         cryptoCoins: transactionObject.gatewaydata.cryptoCoins,
                    //         subscription: transactionObject.subscriptionDetails || null,
                    //         status: 'CANCELLED'

                    sendMailData = {
                        // userId: transactionObject.userId,
                        // subscription_name: transactionObject.name,
                        // fiat_amount: parseFloat(transactionObject.amount),
                        // coin: transactionObject.paymode,
                        // paymode: transactionObject.paymode,
                        // invoice_no: transactionObject.txnId
                    }
                    console.log("sendMailDatasendMailDatasendMailDatasendMailData", sendMailData)

                    emailUtilities.sendTransactionCancelledMailStartUp(sendMailData, (errM, resM) => {
                        if (errM) {
                            console.log(errM)
                        } else {
                            console.log(resM)
                        }
                    });

                    // } 
                    // else {

                    //     sendMailData = {
                    //         userId: transactionObject.userId,
                    //         subscription_name: transactionObject.subscription.name,
                    //         fiat_amount: parseFloat(transactionObject.cryptoCoins),
                    //         mode: transactionObject.paymode,
                    //         transaction_id: transactionObject.txnId
                    //     }

                    //     emailUtilities.sendTransactionCancelledMail(sendMailData, (errM, resM) => {
                    //         if (errM) {
                    //             console.log(errM)
                    //         } else {
                    //             console.log(resM)
                    //         }
                    //     });
                    // }
                }

                console.log("TransactionService: Transaction status updated")
                return cb(null, responseUtilities.sendResponse(200, "TransactionService: Status updated", "createTransaction.updateTransactionStatus", transactionObject, null));
            }
        });
    }

};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for generate Ticket after transaction Confirmation
 */
const generatePurchasePass = function (data, response, cb) {
    if (!cb) {
        cb = response
    };

    if (!response || !response.data) {
        console.log("TransactionService: No address to update status in transaction")
        return cb(null, responseUtilities.sendResponse(200, "generatePurchasePass", "generatePurchasePass", null, null));
    } 
    // else if (response.data.status != "COMPLETED") {
    //     console.log("Transaction not completed....", response.data.status);
    //     return cb(null, responseUtilities.sendResponse(200, "generatePurchasePass", "generatePurchasePass", null, null));
    // }
    else {
        let transactionObject = response.data;
        let insertData = {
            packageId: transactionObject.packageId,
            eventId: transactionObject.eventId,
            packageType: transactionObject?.packageId?.type || data.packageDetails?.type,

            userId: transactionObject.userId,
            transactionId: transactionObject._id,
            visitorId: data.visitorId,

            isPassActivated: false,
            isExpired: false,
            isBlocked: false,
            isUpgraded: false
        }

        console.log("Send Datas = > ", data.sendData)
        PurchasePackages.create(insertData, function (err, res) {
            if (err) {
                console.error("TransactionService.updateTransactionStatus:", err);
                return cb(responseUtilities.sendResponse(500, "Something went wrong", "generatePurchasePass", null, null));
            };
            return cb(null, responseUtilities.sendResponse(200, "Ticket Generated", "generatePurchasePass", data.sendData, null));

        });
    }

};
exports.generatePurchasePass = generatePurchasePass;