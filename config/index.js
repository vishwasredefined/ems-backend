// Fetching the environment
const env = process.env.NODE_ENV || 'development';

// Common Environment Variables
const commonVariables = {
	//New Password algorithms

	PASS_SALT_ROUNDS: 10,
	// JWT_SECRET: "dSDFSDasdas@$(&sdasdaFSDFs#^Q(*DNnkFDSdn##hks2332hd766sar7^^#&W^FSDBGxg7dgqw3FSQ",
	// HASH_SALT: "$(&sdasdaFSDFs#^(*DNnkFDSdn#^^#&W^FSDBG",

	PASS_SALT_STATIC: 'dSDFeFenyL2jaSDasdaeFenyL2jas@766sar7^^#&W^FSDBGxg7dgBGxg7dgqw3FSQ',


	STATUS: [200, 500, 400, 401],
	IMAGE_PATH: 'https://xyz-api.ems',
	SERVICE_RPC_HOST: 'http://localhost',
	SERVICE_REST_PORT: '3000',
	SERVICE_RPC_PORT: '3500',
	CORE_USER_PORT: '3500',
	SC_USER_PORT: '3500',
	DB_ENV: 'development',

	mongoConnectionString: 'mongodb://localhost/ems',
	pageLimit: 10,
	appMemberLimit: 4,

	// CLIENT_URL: 'https://dev-api.femzi.in/',
	CLIENT_URL: 'https://staging.femzi.in/',
	// CLIENT_URL: 'http://localhost:4200/',

	MAILGUN_API_KEY: '1633e6243e3bf3a9c45b3c2f02499c8d-e470a504-d1c09e10',
	MAILGUN_DOMAIN: 'connect.pureolife.com',

	MAILJET_PUBLIC_API_KEY: 'da8ea56b7a068540758709a80f2906a4',
	MAILJET_PRIVATE_API_KEY: '464b6e23d4677932703fd46c32fd6222',

	EMAIL_HOST: 'no-reply@ems.io',
	EMAIL_MAILJET_HOST: 'mohit@ith.tech',
	role: '{"eventadmin":"eventadmin", "user":"user","superadmin":"superadmin", "eventmanager" : "eventmanager", "marketingmanager" : "marketingmanager", "financemanager" : "financemanager", "staff" : "staff","dynamic":"dynamic"}',
	secondaryUserRole: '{"eventmanager" : "eventmanager", "marketingmanager" : "marketingmanager", "financemanager" : "financemanager", "staff" : "staff"}',
	secondaryUserShortName: '{"eventmanager" : "em", "marketingmanager" : "mm", "financemanager" : "fm", "staff" : "st"}',

	PACKAGES_TYPES: '{"SPONSOR":"Sponsor", "EXHIBITOR":"Exhibitor","VISITOR_PASS":"Visitor"}',

	PROFILE_COMPLETION_WEIGHTAGE: `{ "profilePicture": "10", "description": "10", "title": "7.5", "name": "7.5", "email": "7.5", "mobile": "7.5", "contactEmail": "5", "website": "5", "twitter": "5", "linkedin": "5", "telegram": "5", "company": "5", "contactPersonDesignation": "5", "businessSector": "5", "interestTopics": "5", "country":"5" }`,
	GATEWAY: '[{ "bitcoin": "btc" }, { "litecoin": "ltc" }]',
	PER_TOKEN_PRICE: 0.5,
	baseCurrency: "USD",
}

//setting the common variables
Object.keys(commonVariables).forEach((key) => {
	process.env[key] = commonVariables[key];
	// console.log(key, ' => ',  commonVariables[key])
})

if (env === 'development') {

	var developmentEnvConfig = require('./development');
	Object.keys(developmentEnvConfig).forEach((key) => {
		process.env[key] = developmentEnvConfig[key];
		// console.log(key, ' => ',  developmentEnvConfig[key])
	})


} else { // PRODUCTION

	var productionEnvConfig = require('./production');
	Object.keys(productionEnvConfig).forEach((key) => {
		process.env[key] = productionEnvConfig[key];
	})
}

