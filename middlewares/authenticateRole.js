'use strict';
module.exports = function(role){

    return function(req, res,next){
        // next();

        if(role.length==0){
            console.log("NO ROLE PASSED")
            return res.status(401).send({
                signature: req.data.signature,
                status: 401,
                message: "No role passed",
                error: true
                
            });
        }
        if(role.includes(req.data.auth.role)){
            next();
        }else{
            return res.status(401).send({
                signature: req.data.signature,
                status: 401,
                message: "Access Not Allowed",
                error: true
                
            });
        }
  
    }
}