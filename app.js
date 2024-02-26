if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

// Required Files to make default Connection
require('./config/index');
require('./models/db');
require('path');
require('./server');


//Required Modules for framework connection
const express = require('express');
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const device = require('express-device');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const passport = require('passport');
const passportConfiguration = require('./helpers/social');
const routerIndex = require('./routes/index')
const util = require('util'); // Import the 'util' module

const winstonLogger = require('./helpers/logger');
const logObject = new winstonLogger();

let app = express();

app.use(
  expressSession({
    secret: "ff7cfd574bb621230804b0c9b2cd9e45a96a6f88",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
)
// use passport session
app.use(passport.initialize());
app.use(passport.session());

console.error = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? util.inspect(arg, { depth: null }) : arg)).join(' ');
  logObject.log(message, 'error');
};

console.info = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? util.inspect(arg, { depth: null }) : arg)).join(' ');
  logObject.log(message, 'info');
};

let swagger = require('swagger-node-express').createNew(app);

var whitelistOrigin = [
  'http://localhost:3000',
  'http://localhost:3500',
  'http://localhost:4200',
  'http://localhost:4300',
  'https://staging.femzi.in',
  'http://staging.femzi.in',
];
app.set('whitelistOrigin', whitelistOrigin);
app.use(cors({ credentials: true, origin: whitelistOrigin, allowedHeaders: ["X-Access-User", "X-Access-Token", "Accept", "Accept-Datetime", "Accept-Encoding", "Accept-Language", "Accept-Params", "Accept-Ranges", "Access-Control-Allow-Credentials", "Access-Control-Allow-Headers", "Access-Control-Allow-Methods", "Access-Control-Allow-Origin", "Access-Control-Max-Age", "Access-Control-Request-Headers", "Access-Control-Request-Method", "Access-Control-Allow-Headers", "Origin", "X-Requested-With", "Content-Type", "Accept", "X-Access-User", "X-Access-Token", "Authorization", "Age", "Allow", "Alternates", "Authentication-Info", "Authorization", "Cache-Control", "Compliance", "Connection", "Content-Base", "Content-Disposition", "Content-Encoding", "Content-ID", "Content-Language", "Content-Length", "Content-Location", "Content-MD5", "Content-Range", "Content-Script-Type", "Content-Security-Policy", "Content-Style-Type", "Content-Transfer-Encoding", "Content-Type", "Content-Version", "Cookie", "DELETE", "Date", "ETag", "Expect", "Expires", "From", "GET", "GetProfile", "HEAD", "Host", "IM", "If", "If-Match", "If-Modified-Since", "If-None-Match", "If-Range", "If-Unmodified-Since", "Keep-Alive", "OPTION", "OPTIONS", "Optional", "Origin", "Overwrite", "POST", "PUT", "Public", "Referer", "Refresh", "Set-Cookie", "Set-Cookie2", "URI", "User-Agent", "X-Powered-By", "X-Requested-With", "_xser"] }));


app.use((req, res, next) => {
  const origin = req.get('Origin');
  const logString = `A request has been made with  ${req.url}. Origin is ${origin}. User agent is ${req.headers['user-agent']} ,Ip is ${req.ip}. Body is ${JSON.stringify(req.body)}`;
  logObject.log(logString, 'verbose');
  if (process.env.DEV === 'false' && !whitelistOrigin.includes(origin)) {
    logObject.log('Request not from whitelisted origin', 'info');
    res.status(403).json({ error: 'Access denied' });
  } else {
    next();
  }
});

app.use(helmet());

app.use(logger('dev'));
// app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(device.capture());

app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.

    verify: function (req, res, buf) {
      if (req.originalUrl == '/transactions/v1/stripe/webhook') {
        console.log("Webhook Route..." )
        req.rawBody = buf.toString();
      }
    },
  })
);

app.set('trust proxy', true);

//routes
app.use(routerIndex);

app.use(express.static('apiDoc'));

swagger.setApiInfo({
  title: "EMS API",
  description: "All API divided into groups as per there functionality."
});

app.get('/api', function (req, res) {
  res.sendFile(__dirname + '/apiDoc/index.html');
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  logObject.log(`${req.url} , The url you are trying to reach is not hosted on our server`, 'error');
  // render the error page
  res.status(err.status || 500);
  res.send({
    success: false,
    message: res.locals.message,
    error: res.locals.error
  });
});


module.exports = app;
