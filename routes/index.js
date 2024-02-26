const express = require('express')
const router = express.Router();

//paths for router
const auth = require('./auth');
const users = require('./users');
const events = require('./events');
const agendas = require('./agendas');
const requests = require('./requests');
const speakers = require('./speakers');
const medias = require('./medias');
const sponsors = require('./sponsors');
const exhibitors = require('./exhibitors');
const packages = require('./packages');
const visitors = require('./visitors');
const notifications = require('./notifications');
const upload = require('./upload');
const countries = require('./countries');
const agency = require("./agencies");
const teamMembers = require("./teamMembers");
const arenas = require("./areans");
const transactions = require("./transactions");
const purchasedPackages = require("./purchasedPackages");
const tickets = require("./tickets");
const feedbacks = require("./feedbacks");
const suggestions = require("./suggestions");
const eventQuestions = require("./eventQuestions");


router.use('/auth', auth);
router.use('/users', users);
router.use('/events', events);
router.use('/agendas', agendas);
router.use('/requests', requests);
router.use('/speakers', speakers);
router.use('/medias', medias);
router.use('/sponsors', sponsors);
router.use('/exhibitors', exhibitors);
router.use('/packages', packages);
router.use('/visitors', visitors);
router.use('/notifications', notifications);
router.use('/upload', upload);
router.use('/countries', countries);
router.use('/agencies', agency);
router.use('/teamMembers', teamMembers);
router.use('/arenas', arenas);
router.use('/transactions', transactions);
router.use('/purchasedPackages', purchasedPackages);
router.use('/tickets', tickets);

router.use('/feedbacks', feedbacks);
router.use('/suggestions', suggestions);
router.use('/eventQuestions', eventQuestions);


module.exports = router