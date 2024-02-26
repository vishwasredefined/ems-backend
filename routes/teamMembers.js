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
const teamMembers = require('../controllers/teamMembers');


/* Agency add team members of different roles */
router.post("/v1/add",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager])],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        teamMembers.addTeamMembers(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Get team members of your agency PAGINATION */
router.get("/v1/list/pagination",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.query;
        data.req = req.data;

        teamMembers.agencyGetTeamMemberListPagination(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Get team members of your agency - non paginated */
router.get("/v1/list",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager])],
    function (req, res, next) {
        let data = req.query;
        data.req = req.data;

        teamMembers.agencyGetTeamMemberList(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Get member by id. */
router.get("/v1/:id",
    [authenticator, authenticateRole([role.superadmin, role.eventadmin, role.eventmanager])],
    function (req, res) {
        let data = { id: req.params.id };
        data.req = req.data;
        teamMembers.getTeamMemberById(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Agency update team members of different roles */
router.patch("/v1/update",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager])],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        teamMembers.agencyUpdateTeamMember(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Assign Event to your team member */
router.patch("/v1/agency/assign/events",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        teamMembers.assignEventToTeamMembers(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Unassign Event to your team member */
router.patch("/v1/agency/unassign/events",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        teamMembers.unassignEventsToTeamMembers(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Agency update team members of different roles */
router.patch("/v1/update/status",
    [authenticator, authenticateRole([role.eventadmin])],
    function (req, res, next) {
        let data = req.body;
        data.req = req.data;

        teamMembers.agencyUpdateTeamMemberStatus(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Agency update team members of different roles */
router.get("/v1/get/assigned/events",
    [authenticator, authenticateRole([role.eventadmin, role.eventmanager]), filterEvents],
    function (req, res, next) {
        let data = req.query;
        data.req = req.data;

        teamMembers.getTeamMemberAssignedEvents(data, function (err, response) {
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