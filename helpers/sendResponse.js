
exports.sendResponse = function (status, message, action, data, signature){
    let response = {};
    let statusArr = process.env.STATUS.split(',');
    statusArr = statusArr.map((status)=>+status);
   
    switch (status){
        case  statusArr[0]:  // status = 200
            response={
                action:action,
                status: status,
                message: message,
                data: data,
                error: false
            };
            break;
        case statusArr[1]:  // status = 500
            response={
                action:action,
                status: status,
                message: message? message: "Something went wrong",
                data: data,
                error: true
            };
            break;
        case statusArr[2]:  // status = 400
            response={
                signature:signature,
                action:action,
                status: status,
                message: message? message : "Missing params",
                data: data,
                error: true
            };
            break;
        default:
            response={
                action:action,
                status: status,
                message: message,
                error: true
            };
    }
    return response;
}

