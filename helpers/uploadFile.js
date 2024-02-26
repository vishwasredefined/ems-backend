const AWS = require('aws-sdk');

const upload = function(data, response, cb) {
    if(!cb){
        cb = response;
    }
    let { pdfBuffer, eventName, folder } = data;
    var params = {
        Key : `ems/${folder}/`+ Date.now() +`${eventName}`+"eventPass.pdf",
        Body : pdfBuffer, //stream,
        Bucket : process.env.AWS_BUCKET,
        ContentType : 'application/pdf',
        ACL: "public-read"
    }
    const s3 = new AWS.S3({
        accessKeyId:  `${process.env.AWS_ACCESS_KEY_ID}`,
        secretAccessKey: `${process.env.AWS_ACCESS_KEY_SECRET}`,
        region: `${process.env.AWS_REGION}`
    });
    s3.upload(params, function(error, response) {
        console.log("aws error", error);
        console.log("aws response, ", response)
        if (error) {
            return cb(error);
        }
        return cb(null, response);
    });
   
};
exports.upload = upload;

