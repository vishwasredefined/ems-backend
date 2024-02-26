const express = require('express');
const router = express.Router();

/* Middlewares */
const formatRequest = require('../middlewares/formatRequest');
router.use(formatRequest);
const role = JSON.parse(process.env.role);

const clients = {
    users: {
        host: process.env.SERVICE_RPC_HOST,
        port: process.env.SC_USER_PORT
    }
};

const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);
const authenticateRole = require('../middlewares/authenticateRole');
const filterEvents = require('../middlewares/filterEventsForRoles')();

/* Controllers */
const purchasedPackages = require('../controllers/purchasedPackages');

router.get("/v1/activate/passes",
    [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
    function (req, res) {
        let data = req.body;
        data.req = req.data;

        purchasedPackages.activatePurchasedPasses(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/**************************************************APP ROUTES************************************************************************ */

/* Get event agendas */
router.get("/v1/get/all",
    [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
    function (req, res) {
        let data = req.query;
        data.req = req.data;

        purchasedPackages.getPurchasedPackages(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Get categories listing for Admin with pagination+filters  */
router.get("/v1/get/:id",
    [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff])],
    function (req, res) {
        let data = { id: req.params.id };
        data.req = req.data;

        purchasedPackages.getPurchasedPackageById(data, function (err, response) {
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