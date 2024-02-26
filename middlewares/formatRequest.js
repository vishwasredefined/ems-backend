'use strict';

// const {promisify} = require('util'); //<-- Require promisify
// const getIP = promisify(require('external-ip')()); // <-- And then wrap the library
//  var publicIP
// getIP().then((ip)=> {
//     console.log(ip);
//      publicIP = ip
// }).catch((error) => {
//     console.error(error);
// });

module.exports = function(req, res, next) {
    let method = req.method;
    req.data = {};
    req.data.signature = gensig();
    req.data.request = {
        method: req.method,
        baseUrl: req.baseUrl,
        cookies: req.cookies,
        signedCookies: req.signedCookies,
        fresh: req.fresh,
        ip: req.ip,
        // publicIp:publicIP,
        ips: req.ips,
        secure: req.secure,
        subdomains: req.subdomains,
        xhr: req.xhr,
        hostname: req.hostname,
        protocol: req.protocol,
        originalUrl: req.originalUrl,
        route: req.route,
        headers: req.headers
    }
    // req.data.auth = {
    //     id: 1,
    //     accountId: 1234,
    //     token: ""
    // }
    next();
}


const gensig = function(){
    const randomstring = require("randomstring");
    let sig = Date.now() + '.'
    sig += randomstring.generate({
        length: 13
    })
    return sig;
}