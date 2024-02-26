const express = require("express");
const router = express.Router();
const path = require("path");

/* Middlewares */
const formatRequest = require("../middlewares/formatRequest");
router.use(formatRequest);

const json2xls = require('json2xls');
router.use(json2xls.middleware);

const clients = {
    users: {
        host: process.env.SERVICE_RPC_HOST,
        port: process.env.CORE_USER_PORT
    }
};
const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const filterEvents = require('../middlewares/filterEventsForRoles')();

const role = JSON.parse(process.env.role);

//controllers
const transactions = require("../controllers/transactions");
const transactionService = require('../helpers/transactionService');

/*creates transaction first time*/
router.post('/v1/create/transaction', [authenticator, authenticateRole([role.user])], function (req, res, next) {
    let data = req.body;
    data.req = req.data;

    transactions.createTransaction(data, function (err, response) {
        let status = 0;
        if (err) {
            console.log(err);
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
});

/**
 * webhook being consumed by coin payments
 */
router.post('/v1/coinpayment/webhook', function (req, res, next) {
    let data = req.body;
    data.req = req.data;
    transactionService.checkTransaction(data, function (err, response) {
        let status = 0;
        if (err) {
            console.log(err);
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
})

// Webhook being consumed by stripe
router.post('/v1/stripe/webhook', function (req, res, next) {
    let data = req.body;
    data.req = req.data;
    data.rawBody = req.rawBody

    // console.log("Request rawBody => ",req.rawBody );
    transactions.checkStripeTransaction(data, function (err, response) {
        let status = 0;
        if (err) {
            console.log(err);
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
})

/* Get transaction listing for Admin */
router.get("/v1/app/pagination",
    [authenticator, authenticateRole([role.user])],
    function (req, res) {
        let data = req.query;
        data.req = req.data;

        transactions.getTransactionsPagination(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/**************************************************************************************************ADMIN***************************************************************/

router.get('/v1/revenue',
    [authenticator, authenticateRole([role.superadmin, role.eventadmin])],
    function (req, res, next) {
        let data = req.query;
        data.req = req.data;
        transactions.getTotalRevenue(data, function (err, response) {
            let status = 0;
            if (err) {
                console.log(err);
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    })

/** Export transactions */
router.get("/v1/export/all",
    [authenticator, authenticateRole([role.superadmin, role.eventadmin])],
    function (req, res, next) {
        let data = req.query;
        data.req = req.data;

        transactions.exportAllTransactions(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err)
            }
            status = response.status;
            return res.status(status).xls("speakers.xlsx", response.data);
        })
    }
);

/* Get transaction listing for Admin */
router.get("/v1/pagination",
    [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
    function (req, res) {
        let data = req.query;
        data.req = req.data;

        transactions.getTransactionsPagination(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Export invoice  */
router.get("/v1/export/invoice", function (req, res) {
    let data = req.query;
    data.req = req.data;

    transactions.createTransactionInvoice(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        let filePath = path.join(__dirname, "..", "public/invoice.pdf");
        return res.status(status).download(filePath);
    });
});

router.post("/v1/validate/stripe/transaction", function (req, res) {
    let data = req.body;
    data.req = req.data;

    transactions.validateStripeTransaction(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
});

module.exports = router;