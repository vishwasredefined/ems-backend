const teade = require('teade');
const auth = require('./helpers/security');


let server = new teade.Server();
server.addService({
    'validate_token': validate_token,
});

server.bind(process.env.SERVICE_RPC_PORT);
console.log(`EMS RPC Server started at port: ${process.env.SERVICE_RPC_PORT}`);
server.start();

function validate_token(call, callback) {
    auth.validate_token(call, function(err, response) {
        if (err) {
            let error = new Error();
            error.message = err;
            error.code = err.status;
            callback(error);
        } else {
            callback(null, response);
        }
    });
}

module.exports = server;