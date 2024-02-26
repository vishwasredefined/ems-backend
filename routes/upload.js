const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const uuid = require('uuid');

const router = express.Router();


/* Controllers */
const users = require('../controllers/users');

/* Middlewares */
const formatRequest = require('../middlewares/formatRequest');
router.use(formatRequest);
const authenticateRole = require('../middlewares/authenticateRole');
const role = JSON.parse(process.env.role);

const clients = {
    users: {
        host: process.env.SERVICE_RPC_HOST,
        port: process.env.SC_USER_PORT
    }
};

const data = {};
const authenticator = require('../middlewares/authenticator')(clients, data);

const s3 = new AWS.S3({
    accessKeyId:  `${process.env.AWS_ACCESS_KEY_ID}`,
    secretAccessKey: `${process.env.AWS_ACCESS_KEY_SECRET}`,
    region: `${process.env.AWS_REGION}`
});

var uploadFile = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET,
		limits: { fileSize: 1024 * 1024 * 15 },
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        // serverSideEncryption: 'AES256',
        metadata: function (req, file, cb) {
            cb(null, {
                fieldName: file.fieldname
            });
        },
        key: function (req, file, cb) {
			const folder = `ems/image`;
            const filename_new = folder + "/" +Date.now() + "." + file.originalname.split(".")[file.originalname.split(".").length - 1];
            cb(null, filename_new);
        }
    })
})

router.put('/v1/upload/file',uploadFile.single('file'),function (req, res, next) {

    let data = req.body;
    data.req = req.data;

    let response = {
        url: req.file.location
    }
    let status = 200;
     
    return res.status(status).send(response);
    
});

router.put('/v1/upload/multiple/files',uploadFile.array('files'),function (req, res, next) {

    let data = req.files;
    data.req = req.data;

    console.log("req.files ", req.files);

    let urlList = [];
    if(req.files.length > 0){
        req.files.map(el => urlList.push(el?.location))
    }
    let response = {
        urlList
    }
    let status = 200;
     
    return res.status(status).send(response);
    
});


module.exports = router;
