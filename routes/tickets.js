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
const tickets = require('../controllers/tickets');

router.get("/v1/activate/passes",
    [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
    function (req, res) {
        let data = req.query;
        data.req = req.data;

        tickets.activatePurchasedPasses(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
    });

/* Download event passes  */
router.post("/v1/download/event/passes", function (req, res) {
    let data = req.body;
    data.req = req.data;

    tickets.showDetailsAndDownloadPass(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
});

/* Download event passes  */
router.get("/v1/show/pass/details/:eventData", function (req, res) {
    let data = { eventData: req.params.eventData };
    data.req = req.data;

    tickets.showEventPassDetails(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
}); 

/*Get event passes details  */
router.get("/v1/show/pass/list/:eventData", function (req, res) {
    let data = { eventData: req.params.eventData };
    data.req = req.data;

    tickets.getEventPassList(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
});  

/* Download event passes  */
router.get("/v1/download/event/single/pass", function (req, res) {
    let data = req.query;
    data.req = req.data;

    tickets.downloadEventSinglePass(data, function (err, response) {
        let status = 0;
        if (err) {
            status = err.status;
            return res.status(status).send(err);
        }
        status = response.status;
        return res.status(status).send(response);
    });
});

/* show event member pass details */
router.post("/v1/show/event/member/pass/details",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.body;
		data.req = req.data;

		tickets.showEventMemeberPassDetails(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* show event member pass details */
router.post("/v1/get/event/member/pass/list",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.body;
		data.req = req.data;

		tickets.getEventMemeberPassList(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* show event member pass details */
router.post("/v1/download/event/member/pass",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
	function (req, res) {
		let data = req.body;
		data.req = req.data;

		tickets.downloadEventMemeberPass(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* show event member pass details */
router.get("/v1/download/event/single/pass/admin",
    [authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager]), filterEvents],
    function (req, res) {
        let data = req.query;
        data.req = req.data;

        tickets.downloadEventSinglePassByAdmin(data, function (err, response) {
            let status = 0;
            if (err) {
                status = err.status;
                return res.status(status).send(err);
            }
            status = response.status;
            return res.status(status).send(response);
        });
});

/*update events*/
router.patch("/v1/assign/member",
	[authenticator, authenticateRole([role.eventadmin, role.superadmin, role.eventmanager]), filterEvents],
	function (req, res, next) {
		let data = req.body;
		data.req = req.data;

		tickets.assignMemberToEvent(data, function (err, response) {
			let status = 0;
			if (err) {
				status = err.status;
				return res.status(status).send(err);
			}
			status = response.status;
			return res.status(status).send(response);
		});
	});

/* Download event visitor pass */
router.post("/v1/download/event/visitor/pass",
    [authenticator, authenticateRole([role.eventadmin, role.user, role.superadmin, role.eventmanager, role.marketingmanager, role.financemanager, role.staff]), filterEvents],
    function (req, res) {
        let data = req.body;
        data.req = req.data;

        tickets.downloadEventVisitorPass(data, function (err, response) {
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
