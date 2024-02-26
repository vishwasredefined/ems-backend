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
const arenas = require('../controllers/arenas');

//Add event Arena
router.post("/v1/add",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        arenas.addEventArena(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

//Update event arena 
router.patch("/v1/edit",
    [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        arenas.updateEventArena(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Get event arenas */
router.get("/v1/get",
    [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
    function (req, res) {
        let data = req.query;
        data.req = req.data;

        arenas.getEventArenas(data, function (err, response) {
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
router.get("/v1/specific/:id",
    [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff])],
    function (req, res) {
        let data = { arenaId: req.params.id };
        data.req = req.data;

        arenas.getEventArenaById(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });


//Update event arena status
router.patch("/v1/update/status",
    [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        data.statusUpdate = true;
        arenas.updateEventArena(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

//Update event arena status
// router.patch("/v1/delete",
//     [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
//     function (req, res, next) {
//         let data = req.body;
//         data.req = req.data;

//         data.deleteRequest = true;
//         arenas.updateEventArena(data, function (err, response) {
//             let status = 0;
//             if (err) {
//                 status = err.status;
//                 return res.status(status).send(err);
//             }
//             status = response.status;
//             return res.status(status).send(response);
//         });
//     });

/*********************************************** App Route ******************************************************************* */
/* Get event arenas */
router.get("/v1/get/for/user", function (req, res) {
    let data = req.query;
    data.req = req.data;

    data.user = true;
    arenas.getEventArenas(data, function (err, response) {
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