const async = require("async");
const moment = require("moment");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
// const pdf = require("pdf-creator-node");
const crypto = require("crypto");
const pdfGenerator = require('html-pdf-node');

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

//Helpers
const responseUtilities = require("../helpers/sendResponse");
const coinsPayment = require('../helpers/coinPayment');
const transactionService = require('../helpers/transactionService');
const helpers = require('../helpers/web3Service');
const notify = require("../helpers/notification");

const role = JSON.parse(process.env.role);

//Modals
const Transactions = require("../models/transactions");
const notifications = require("../models/notifications");
const Events = require("../models/events");

const Users = require('../models/users');
const Visitors = require("../models/visitors");
const PurchasePackages = require("../models/purchasedPackages");

//Controllers
const { getEventById } = require("../controllers/events");
const { getPackageById } = require("../controllers/packages");

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for create transaction COIN PAYMENT
 */
const createTransaction = function (data, response, cb) {
	if (!cb) {
		cb = response;
	};

	if (!data.eventId || !data.packageId || !data.visitorId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "createTransaction", null, data.req.signature));
	};

	if (!data.zeroPricePurchase && (!data.gatewayName && !["COIN_PAYMENTS", "STRIPE"].includes(data.gatewayName))) {
		return cb(responseUtilities.sendResponse(400, "Choose Valid Gateway", "createTransaction", null, data.req.signature));
	};

	data.paymode = "card"; // Stripe
	data.checkIfExpiredEvent = true;
	data.initiateTransaction = true;

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(getEventById, data));
	waterfallFunctions.push(async.apply(getPackageById, data));

	if (!data.zeroPricePurchase) {
		if (data.gatewayName == "STRIPE") {
			waterfallFunctions.push(async.apply(createStripePaymentIntent, data));

		} else {
			return cb(responseUtilities.sendResponse(400, "Choose Valid Gateway", "createTransaction", null, data.req.signature));
		};
	};

	waterfallFunctions.push(async.apply(insertTransaction, data));

	if (data.zeroPricePurchase) {
		waterfallFunctions.push(async.apply(generatePurchasePass, data));
		waterfallFunctions.push(async.apply(checkEventAndUpdateVisitorPassStatus, data));
		// waterfallFunctions.push(async.apply(updateVisitorPurchasePassStatus, data));

	}
	async.waterfall(waterfallFunctions, cb);
}
exports.createTransaction = createTransaction;


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for get Token Price
 */
const getTokenPrice = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.usdAmount) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getTokenPrice", null, null));
	}
	let tokenPrice = await helpers.fetchTokenPrice();
	let tokenAmount = parseFloat(data.usdAmount) / parseFloat(tokenPrice.perTokenPrice);
	data.cryptoAmount = tokenAmount;
	console.log("data.cryptoAmount => ", data.cryptoAmount);
	return cb(null, responseUtilities.sendResponse(200, "get token price", "getTokenPrice", { tokenAmount }, null));

}
exports.getTokenPrice = getTokenPrice;


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for createStripePaymentIntent
 */
const createStripePaymentIntent = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.usdAmount) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "createStripePaymentIntent", null, null));
	};

	try {
		const paymentIntent = await stripe.paymentIntents.create({

			amount: data.usdAmount * 100, //Amount in Cents of that currency
			currency: data.currency.toString(), // Currency should be in usd

			payment_method_types: ["card"],
			// automatic_payment_methods: { enabled: true, allow_redirects:"never" }, // Capture all available methods via my dashboard
			metadata: {
				"userId": data.req.auth.id.toString(),
				"visitorId": data.visitorId.toString()
			},
			description: 'Software management services',
			shipping: {
			  name: 'Jenny Rosen', // (data?.visitorData?.name || null),
			  address: {
				line1: '13th Street 47 W 13th St',
				postal_code: '10011',
				city: 'New York',
				state: 'NY',
				country: 'US', //(data?.visitorData?.mobileCode || null),
			  },
			},
			// confirm: true //Create intent and confirm that you're doing it.
		});
		console.log("Payment Intent Created => ", paymentIntent);

		// Add Gateway Data to store in Transaction
		data.gatewayData = paymentIntent;
		data.txn_id = paymentIntent.id;

		// Cleint secret will be sent to frontend to pay against this transaction.
		data.clientSecret = paymentIntent.client_secret;

		return cb(null, responseUtilities.sendResponse(200, "Payment intent created...", "createStripePaymentIntent", paymentIntent, null));

	} catch (err) {
		console.log("Error in creating payment intent...", err);
		return cb(responseUtilities.sendResponse(500, "Payment intent not created...", "createStripePaymentIntent", null, null));
	}
}


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Insert Transaction
 */
const insertTransaction = async function (data, response, cb) {
	if (!cb) {
		cb = response
	}
	console.log("Response on Create Transactions => ", response.data);
	let createData = {};

	if (data.zeroPricePurchase) {
		data.gatewayData = {};
		data.gatewayName = "ZERO_PAYMENT_TRANSACTION";
		data.paymode = null;
		data.isPackagePurchased = true;
		data.status = "COMPLETED"
	};

	if (data.adminTransaction) {
		data.gatewayData = {};
		data.gatewayName = "DIRECT_ADMIN_PAYMENT_TRANSACTION";
		data.paymode = null;
		data.isPackagePurchased = true;
		data.status = "COMPLETED"
	};
	let orderId = crypto.randomBytes(8).toString('hex');
	orderId = orderId.toUpperCase();
	orderId = `OD${orderId}`

	createData = {
		txnId: data.txn_id || mongoose.Types.ObjectId(),
		transactionType: 'PACKAGE_PURCHASE',
		userId: data.userId || data.req.auth.id,
		status: data.status || 'PENDING',
		paymode: data.paymode,
		amount: parseFloat(data.amount),
		usdAmount: parseFloat(data.amount), //In case of Stripe amount is in its currency and no usdAmount.
		// currentPrice: parseFloat(data.amount / data.cryptoAmount),
		eventId: data.eventDetails?._id,
		eventAdminId: data.eventDetails?.managedBy,
		packageId: data.packageId,
		gatewayName: data.gatewayName,
		gatewayData: data.gatewayData,
		orderId: orderId
	};

	if (data.status == "COMPLETED") {
		let invoiceNumber = await generateInvoiceNumber();
		if (invoiceNumber.error) {
			return cb(responseUtilities.sendResponse(400, "Invoice couldnot be generated", "insertTransaction", null, data.req.signature));
		};

		invoiceNumber = invoiceNumber.data;
		console.log("Invoice Number =>", invoiceNumber)

		createData.invoiceNumber = invoiceNumber;
	}
	if (data.visitorId) {
		createData.visitorId = data.visitorId
	};
	console.log("Inserting transaction data => ", createData);

	Transactions.create(createData, (err, res) => {
		if (err) {
			console.log(err);
			return cb(responseUtilities.sendResponse(500, null, "insertTransaction", null, data.req.signature));
		};
		data.gatewayId = res.gatewayData?.txnId;

		let sendData = {};
		if (data.gatewayName == "STRIPE") {
			sendData = {
				client_secret: data.gatewayData.client_secret,
				visitorId: data.visitorId
			}
		} else if (data.gatewayData == "COIN_PAYMENTS") {
			sendData = {
				cryptoCoins: parseFloat(data.gatewayData.amount),
				qrcodeUrl: data.gatewayData.qrcode_url,
				address: data.gatewayData.address
			}
		} else {
			sendData = res;
		}

		// Final Response
		data.sendData = sendData;
		console.log("Send Data => ", data.sendData);

		return cb(null, responseUtilities.sendResponse(200, "Transaction Created", "createTransaction.insertTransaction", sendData, data.req.signature));

	});
};
exports.insertTransaction = insertTransaction;

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for get all transactions
 */
exports.getTransactionsPagination = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		// status: "COMPLETED"
		"gatewayName": { $ne: "DIRECT_ADMIN_PAYMENT_TRANSACTION" }
	};

	if (data.status) {
		findData.status = data.status
	};


	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};

	if ([role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	};

	if (data.userId) {
		findData.userId = data.userId
	};

	if (data.packageId) {
		findData.packageId = data.packageId
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	let createdAt = {}
	if (data.fromDate) createdAt["$gte"] = new Date(new Date(data.fromDate).setUTCHours(0, 0, 0, 0));
	if (data.toDate) createdAt["$lte"] = new Date(new Date(data.toDate).setUTCHours(23, 59, 59, 0));

	if (data.fromDate || data.toDate) findData.createdAt = createdAt;

	let limit = process.env.pageLimit || 20;
	if (data.limit) {
		limit = parseInt(data.limit)
	}
	let skip = 0;

	if (data.currentPage) {
		skip = data.currentPage > 0 ? (data.currentPage - 1) * limit : 0;
	};

	let populateArray = [];

	if (data.search) {
		populateArray[0] = {
			path: "userId",
			select: "email name",
			match: {
				$or: [
					{ name: { $regex: data.search, "$options": "i" } },
					{ email: { $regex: data.search, "$options": "i" } }
				]
			},
			model: "User"
		}
	} else {
		populateArray[0] = {
			path: "userId",
			select: "email name",
			model: "User"
		}
	};

	if (data.type) {
		populateArray[1] = {
			path: "packageId",
			select: "title type currencyId price",
			match: {
				type: data.type,
			},
			populate: [{
				path: "currencyId"
			}],
			model: "packages"
		}
	} else {
		populateArray[1] = {
			path: "packageId",
			select: "title type",
			populate: [{
				path: "currencyId"
			}],
			model: "packages"
		}
	};


	populateArray[2] = {
		path: "eventId",
		select: "name ",
		model: "event"
	};

	if (data.req.auth.role == role.user) {
		findData.userId = data.req.auth.id
	};

	console.log("FindTransactions => ", findData, populateArray)
	Transactions.find(findData)
		.populate(populateArray)
		// .limit(limit)
		// .skip(skip)
		.sort({ updatedAt: -1 })
		.exec((err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "getTransactionsPagination", null, null));
			};

			let resU = res.filter(e => ((e.userId != null) && (e.packageId != null)));
			let DTS = {
				transactions: resU.slice(skip, Math.min(resU.length, skip + limit)),
				count: resU.length,
				pageLimit: limit
			}
			// Transactions.countDocuments(findData, (errC, resC) => {
			// 	if (errC) {
			// 		return cb(responseUtilities.sendResponse(500, null, "getTransactionsPagination", null, null));
			// 	};
			// 	let DTS = {
			// 		transactions: res,
			// 		count: resC,
			// 		pageLimit: limit
			// 	}
			// })
			return cb(null, responseUtilities.sendResponse(200, "Latest Transactions fetched", "getTransactionsPagination", DTS, null));
		});
};



/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for transaction invoice pdf
 */
exports.createTransactionInvoice = function (data, response, cb) {

	if (!cb) {
		cb = response;
	}

	if ((!data.transactionId && !data.id)) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "transactionInvoice", null, data.req.signature));
	};

	let findData = {
		_id: data.transactionId || data.id
	};

	console.log("Find Transaction to export => ", findData)
	Transactions.findOne(findData)
		.populate([
			{
				path: "userId",
				populate: {
					path: "country state city",
				},
			},
			{
				path: "packageId",
				select: "title type",
				model: "packages"
			},
			{
				path: "visitorId",
				// select: "title type",
				model: "visitors"
			},
			{
				path: "eventId",
				select: "name venue startDate endDate",
				populate: [
					{
						path: 'venue.country',
						model: 'countries'
					},
					{
						path: 'venue.state',
						model: 'states'
					},
					{
						path: 'venue.city',
						model: 'cities'
					},
					{
						path: 'managedBy',
						model: 'User'
					}
				],
				// model: "event"
			}
		])
		.exec(function (err, res) {
			if (err) {
				console.log("Error => ", err)
				return cb(responseUtilities.sendResponse(500, "Error", "transactionInvoice", err, data.req.signature));
			}
			console.log("Transaction => ", res?._id)
			if (!res) {
				return cb(responseUtilities.sendResponse(400, "Transaction not found", "transactionInvoice", null, null));
			}


			let amountPaid = +res.amount
			let createdAt = res.createdAt
			let paymentTrasactionId = null
			if (res.gatewayData) {
				paymentTrasactionId = res.txnId
			}

			let amountInWords = "";
			let wordsOne = [
				"",
				"One ",
				"Two ",
				"Three ",
				"Four ",
				"Five ",
				"Six ",
				"Seven ",
				"Eight ",
				"Nine ",
				"Ten ",
				"Eleven ",
				"Twelve ",
				"Thirteen ",
				"Fourteen ",
				"Fifteen ",
				"Sixteen ",
				"Seventeen ",
				"Eighteen ",
				"Nineteen ",
			];
			let wordsTen = [
				"",
				"",
				"Twenty",
				"Thirty",
				"Forty",
				"Fifty",
				"Sixty",
				"Seventy",
				"Eighty",
				"Ninety",
			];

			let num = (amountPaid || 0);
			num = parseInt(num)
			console.log("AMount for this payment => ", num)
			if ((num = num.toString()).length > 9) amountInWords = "";
			n = ("000000000" + num)
				.substr(-9)
				.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
			if (!n) amountInWords = "";
			let str = "";
			str +=
				n[1] != 0
					? (wordsOne[Number(n[1])] ||
						wordsTen[n[1][0]] + " " + wordsOne[n[1][1]]) + "Crore "
					: "";
			str +=
				n[2] != 0
					? (wordsOne[Number(n[2])] ||
						wordsTen[n[2][0]] + " " + wordsOne[n[2][1]]) + "Lakh "
					: "";
			str +=
				n[3] != 0
					? (wordsOne[Number(n[3])] ||
						wordsTen[n[3][0]] + " " + wordsOne[n[3][1]]) + "Thousand "
					: "";
			str +=
				n[4] != 0
					? (wordsOne[Number(n[4])] ||
						wordsTen[n[4][0]] + " " + wordsOne[n[4][1]]) + "Hundred "
					: "";
			str +=
				n[5] != 0
					? (str != "" ? "and " : "") +
					(wordsOne[Number(n[5])] ||
						wordsTen[n[5][0]] + " " + wordsOne[n[5][1]]) +
					"only "
					: "";
			if (!str.includes("only")) {
				str += "only "
			};


			amountInWords = str;
			console.log("Amount in words => ", amountInWords);
			let username = res.userId && res.userId.name ? res.userId.name : null
			let mobile = res.userId && res.userId.userMeta.mobile ? res.userId.userMeta.mobile : null
			let transactionDate = moment(res.createdAt.toUTCString()).format('MMMM Do YYYY, h:mm:ss a');
			let currency = ((res.gatewayData?.currency !== undefined) ? res.gatewayData?.currency?.toUpperCase() : "")
		
			/*
			let htmlPath = path.join(
				__dirname,
				"..",
				"htmlTemplate",
				"invoice.html"
			);
			var html = fs.readFileSync(htmlPath, "utf8");
			var options = {
				format: "A3",
				orientation: "portrait",
				border: "10mm",
			};
			let filePath = path.join(
				__dirname,
				"../",
				"public/invoice.pdf"
			);
			console.log("filePath => ", filePath);
			let DTS = {
				userName: username,
				userEmail: res?.userId?.email || "N/A",
				date: transactionDate,
				eventName: res.eventId?.name,
				eventStartDate: moment(res.eventId?.startDate).format('MMMM Do YYYY'),
				eventEndDate: moment(res.eventId?.endDate).format('MMMM Do YYYY'),
				packageName: res.packageId?.title,
				packageType: res.packageId?.type,
				status: res?.status,
				transactionId: res._id,
				price: parseFloat(res.usdAmount),
				currency: res.gatewayData?.currency?.toUpperCase(),
				gatewayName: res.gatewayName,
				visitorName: res.visitorId?.name,
				country: res?.eventId?.venue?.country?.name,
				state: res?.eventId?.venue?.state?.name,
				city: res.eventId?.venue?.city?.name,
				mobile: res?.userId?.userMeta?.mobile || "N/A",
				agencyEmail: res?.eventId?.managedBy?.email,
				invoiceNumber: res?.invoiceNumber || "N/A"
			};
			console.log("DTS => ", DTS)
			var document = {
				html: html,
				data: DTS,
				path: filePath,
				type: "",
			};
			pdf
				.create(document, options)
				.then((transactionPdf) => {
					console.log("transactionPdf ", transactionPdf)
					return cb(null, responseUtilities.sendResponse(200, "Invoice generated", "transactionInvoice", transactionPdf, null));
				})
				.catch((err) => {
					console.log(err.message);
					return cb(responseUtilities.sendResponse(400, "Invoice could not be generated", "transactionInvoice", null, null));
				});
				*/
			console.log("currency", currency);
			let htmlCreated = `<!DOCTYPE html>
			<html lang="en">
			<head>
			  <meta charset="UTF-8" />
			  <title>Invoice Email</title>
			  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
			  <style>
				body {
				  font-family: "Inter", sans-serif !important;
				}
				p {
				  margin: 5px 0px;
				  color: #6f6f84;
				  font-size: 13px;
				}
				p b {
				  font-weight: 600;
				  color: #000;
				}
				table {
				  width: 100%;
				}
				table tr td {
				  border: 0px;
				  padding: 5px 10px;
				}
				.product tr td {
				  padding: 5px 0px;
				  color: #6f6f84;
				  font-weight: 600;
				  border-style: hidden !important;
				}
				.product {
				  margin-top: 15px;
				  border-bottom: #f1ac1c 1px solid;
				}
				.product tr td span {
				  color: #222234;
				}
				.bill tr td {
				  border-bottom: #f1ac1c 1px solid;
				  padding: 5px 0px;
				  font-weight: 600;
				  color: #6f6f84;
				}
				.bill tr td span {
				  color: #222234;
				}
			  </style>
			</head>
			<body>
			  <html>			
			  <body style="
					  background-color: #e2e1e0;
					  font-family: Open Sans, sans-serif;
					  font-size: 100%;
					  font-weight: 400;
					  line-height: 1.4;
					  color: #000;
					">
				<div style="
						max-width: 600px;
						margin: 20px auto 10px;
						background-color: #fff;
						padding: 25px;
					  ">
				  <table>
					<tr>
					  <td style="text-align: left; width: 50%">
						<img style="max-width: 70px" src="https://staging.femzi.in/assets/img/tdefi_logo-transparent.png"
						  alt="bachana tours" />
					  </td>
					  <td style="text-align: right; font-weight: 400; width: 50%">
						<h4 style="
								text-align: right;
			
								color: #6f6f84;
								margin: 0;
			
								font-size: 34px;
								font-style: normal;
								font-weight: 600;
								line-height: normal;
							  ">
						  Invoice
						</h4>
						<p style="
								text-align: right;
								color: #6f6f84;
								font-size: 15px;
								font-style: normal;
								font-weight: 400;
								margin: 0;
								line-height: normal;
							  ">
						  Todayevents@tech.com
						</p>
					  </td>
					</tr>
				  </table>
				  <table>
					<tr>
					  <td style="width: 50%">
						<p style="margin-top: 30px">Billed to,</p>
						<p><b>${res.visitorId?.name}</b></p>
					  </td>
					  <td align="right" style="width: 50%">
						<p style="margin-top: 30px">Invoice number</p>
						<p><b>${(res?.invoiceNumber || "N/A")}</b></p>
						<p>Reference</p>
						<p><b>${res?._id}</b></p>
					  </td>
					</tr>
				  </table>
				  <table cellpadding="0" cellspacing="0">
					<tr style="background: #fff6e3">
					  <td style="width: 25%">
						<p>Event Name</p>
						<p><b>${res.eventId?.name}</b></p>
					  </td>
					  <td style="width: 25%">
						<p>Event Date</p>
						<p><b>${(moment(res.eventId?.startDate).format('MMMM Do YYYY'))} - ${(moment(res.eventId?.endDate).format('MMMM Do YYYY')) }</b></p>
					  </td>
					  <td style="width: 25%">
						<p>Event Location</p>
						<p><b>${(res.eventId?.venue?.city?.name)}, ${(res?.eventId?.venue?.country?.name)}</b></p>
					  </td>
					  <td style="width: 25%">
						<p>Invoice Date (UTC)</p>
						<p><b>${transactionDate} </b></p>
					  </td>
					</tr>
				  </table>
				  <div style="background: #f1ac1c; height: 1px"></div>
				  <table class="product">
					<tr>
					  <td>Product Description</td>
					  <td align="right">Total Amount</td>
					</tr>
					<tr>
					  <td><span>Visitor Pass</span></td>
					  <td style="border: 0" align="right">
						<span style="color: #F1AC1C; font-weight: 700;">${(currency)} ${ parseFloat(res.usdAmount) }
						</span>
					  </td>
					</tr>
				  </table>
				  <table style="margin-top: 50px;" cellpadding="0" cellspacing="0">
					<tr>
					  <td>
						<p>
						  ${username}
						</p>
						<p><strong>Email :</strong> ${res?.userId?.email || "N/A" }</p>
						<p><strong>Payment method:</strong> ${res.gatewayName }</p>
					  </td>
					</tr>
					<tr>
					  <td>
						<p><strong>Note:</strong></p>
						<p>If you have any questions or concerns regarding this invoice, please don't hesitate to contact us at ${(res?.eventId?.managedBy?.email)}.</p>
					  </td>
					</tr>
				  </table>
				</div>
			  </body>
			  </html>
			</body>
			</html>`
			let options = {
				format: "A4",
				orientation: "portrait",
				border: "10mm",
			};
			pdfGenerator.generatePdf({ content: htmlCreated }, options).then(buffer => {
				fs.writeFileSync(path.join(__dirname,"..", "public/invoice.pdf"), buffer);
				console.log("pdfBuffer ", buffer);
				return cb(null, responseUtilities.sendResponse(200, "Invoice generated", "transactionInvoice", buffer, null));
			}).catch(err => {
				console.log("pass generate error ", err);
				return cb(responseUtilities.sendResponse(500, "Pass not generated", "generatePdf", null, null));
			})
		});
};


const getUsdForTokens = async function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.tokenAmount) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "getTokenPrice", null, null));
	}
	let tokenPrice = await helpers.fetchTokenPrice();
	let usdAmount = parseFloat(data.tokenAmount) * parseFloat(tokenPrice.perTokenPrice);
	// data.usdAmount=usdAmount;
	return cb(null, responseUtilities.sendResponse(200, "get token price", "getTokenPrice", { usdAmount }, null));

}
exports.getUsdForTokens = getUsdForTokens

// const getAllTransactions = function (data, response, cb) {
// 	if (!cb) {
// 		cb = response;
// 	}



// 	let findData = {
// 		userId: data.req.auth.id
// 	};

// 	if (data.transactionType) {
// 		findData.transactionType = data.transactionType;
// 	}

// 	if (data.fromDate && data.toDate) {
// 		findData.createdAt = {
// 			$gte: new Date(new Date(data.fromDate).setHours(0, 0, 0, 0)),
// 			$lte: new Date(new Date(data.toDate).setHours(23, 59, 59, 999)),
// 		};
// 	}

// 	if (data.fromDate && !data.toDate) {
// 		findData.createdAt = {
// 			$gte: new Date(new Date(data.fromDate).setHours(0, 0, 0, 0)),
// 		};
// 	}

// 	if (data.toDate && !data.fromDate) {
// 		findData.createdAt = {
// 			$lte: new Date(new Date(data.toDate).setHours(23, 59, 59, 999)),
// 		};
// 	}

// 	let limit = parseInt(process.env.pageLimit)
// 	let skip = 0;

// 	if (data.limit) {
// 		limit = parseInt(data.limit)
// 	}
// 	if (data.currentPage) {
// 		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
// 	}
// 	if (data.transactionType) {
// 		findData.transactionType = data.transactionType
// 	}

// 	Transactions.find(findData).populate({
// 		path: "packageId",
// 		model: "Package",
// 		select: "name"

// 	}).populate(
// 		{
// 			path: "userId",
// 			select: "email name",
// 			model: "User"
// 		},
// 	).sort({ createdAt: -1 }).skip(skip).limit(limit).exec((err, res) => {
// 		if (err) {
// 			return cb(responseUtilities.sendResponse(500, null, "getAllTransactions", null, data.req.signature));
// 		}
// 		Transactions.countDocuments(findData, (errC, count) => {
// 			if (errC) {
// 				console.log(errC);
// 				return cb(responseUtilities.sendResponse(500, null, "getAllTransactions", null, data.req.signature));

// 			}
// 			let sendData = {
// 				data: res,
// 				count: count,
// 				pageLimit: limit
// 			}
// 			return cb(null, responseUtilities.sendResponse(200, null, "getAllTransactions", sendData, data.req.signature));
// 		})
// 	})

// }
// exports.getAllTransactions = getAllTransactions;



const adminGetAllTransactions = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
	};

	let limit = parseInt(process.env.pageLimit)
	let skip = 0;

	if (data.limit) {
		limit = parseInt(data.limit)
	}
	if (data.currentPage) {
		skip = data.currentPage > 0 ? ((data.currentPage - 1) * limit) : 0
	}

	if (data.userId) {
		findData.userId = data.userId
	}



	if (data.fromDate && data.toDate) {
		findData.createdAt = {
			$gte: new Date(new Date(data.fromDate).setHours(0, 0, 0, 0)),
			$lte: new Date(new Date(data.toDate).setHours(23, 59, 59, 999)),
		};
	}

	if (data.fromDate && !data.toDate) {
		findData.createdAt = {
			$gte: new Date(new Date(data.fromDate).setHours(0, 0, 0, 0)),
		};
	}

	if (data.toDate && !data.fromDate) {
		findData.createdAt = {
			$lte: new Date(new Date(data.toDate).setHours(23, 59, 59, 999)),
		};
	}



	if (data.status) {
		findData.status = data.status
	}


	let populate = [
		{
			path: "userId",
			select: "email name",
			model: "User"
		},
		{
			path: "packageId",
			model: "Package",
			select: "name"
		},
	];

	if (data.search) {
		if (mongoose.isValidObjectId(data.search)) {
			findData._id = mongoose.Types.ObjectId(data.search)
		} else {
			populate[0] = {
				path: "userId",
				select: "email name",
				match: {
					$or: [
						{ name: { $regex: data.search, "$options": "i" } },
						{ email: { $regex: data.search, "$options": "i" } }
					]
				},
				model: "User"
			}
		}
	}
	Transactions.find(findData).populate(populate)
		.sort({ createdAt: -1 }).exec((err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "getAllTransactions", null, data.req.signature));
			}

			// let walletTransaction = res.filter(log => log.userId!=null );
			// walletTransaction = res.filter(e => e._id != null);

			let dts = [];
			for (let i = 0; i < res.length; i++) {
				if (res[i].userId && res[i]._id) dts.push(res[i]);
			}
			let sendData = {
				data: dts.slice(skip, Math.min(dts.length, skip + limit)),
				count: dts.length,
				pageLimit: limit
			}

			// let sendData = {
			// 	data: walletTransaction.slice(skip, Math.min(walletTransaction.length, skip + limit)),
			// 	count: walletTransaction.length,
			// 	pageLimit: limit
			// }
			return cb(null, responseUtilities.sendResponse(200, null, "createWalletLogs", sendData, data.req.signature));
		})


}
exports.adminGetAllTransactions = adminGetAllTransactions;



const adminRejectTransaction = function (data, response, cb) {
	if (!cb) {
		cb = response
	}
	console.log("hi");
	if (!data.txnId || !data.reason) {
		console.log('p');
		return cb(responseUtilities.sendResponse(400, "Missing params", "adminRejectTransaction", null, null));
	}
	// Finalising status
	data.status = 'REJECTED';

	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkTransactionDetails, data));

	waterfallFunctions.push(async.apply(updateTransactionStatus, data));

	async.waterfall(waterfallFunctions, cb);
}
exports.adminRejectTransaction = adminRejectTransaction;

exports.adminDepositSettle = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.txnId || !data.amount) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "adminDepositSettle", null, null));

	}
	if (parseFloat(data.amount) < 1) {
		return cb(responseUtilities.sendResponse(400, "amount should be more than zero", "adminDepositSettle", null, null));
	}

	// Finalising status
	data.status = 'SETTLED';


	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkTransactionDetails, data));
	waterfallFunctions.push(async.apply(adminUpdateUserWallet, data));
	waterfallFunctions.push(async.apply(updateTransactionStatus, data));

	async.waterfall(waterfallFunctions, cb);

}

const adminDepositApprove = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.txnId) {
		return cb(responseUtilities.sendResponse(400, "Missing params", "adminDepositApprove", null, null));

	}

	data.status = 'APPROVED';
	let waterfallFunctions = [];
	waterfallFunctions.push(async.apply(checkTransactionDetails, data));
	waterfallFunctions.push(async.apply(updateTransactionStatus, data));
	async.waterfall(waterfallFunctions, cb);


}
exports.adminDepositApprove = adminDepositApprove;



const checkTransactionDetails = function (data, response, cb) {
	if (!cb) {
		cb = response
	}

	let find_data = {
		'_id': data.txnId
	}
	console.log("checkTransactionDetails")

	Transactions.findOne(find_data, function (err, res) {
		if (err) {
			console.error(err)
			return cb(responseUtilities.sendResponse(500, "something went wrong", "checkTransactionDetails", null, null));
		}
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "No transaction found", "checkTransactionDetails", null, null));
		}
		if (res.status == 'COMPLETED' || res.status == 'PENDING') {
			return cb(responseUtilities.sendResponse(400, "transaction status not ONHOLD or PROCESSING", "checkTransactionDetails", null, null));

		}

		console.log("data amount", data.amount);
		if (data.status == 'REJECTED') {

			data.amount = res.amount
		}

		if (data.status == 'SETTLED') {

			let recievedTokens = (parseFloat(data.amount) / parseFloat(res.currentPrice))
			let recievedUsd = parseFloat(data.amount)

			data.amount = recievedTokens
			data.usdAmount = recievedUsd

		}


		if (data.status == 'APPROVED') {
			// Required amount to approve
			data.amount = res.amount
		}

		// Required Data to process further
		data.userId = res.userId
		data.type = res.transactionType
		return cb(null, responseUtilities.sendResponse(200, "Transaction list", "checkTransactionDetails", null, null));

	});
};

const updateTransactionStatus = function (data, response, cb) {
	if (!cb) {
		cb = response
	}
	let find_data = {
		_id: data.txnId
	}
	let update_data = {
		status: data.status,
		rejectionReason: data.reason,
		updatedBy: data.req.auth.id
	};

	if (data.status != 'REJECTED') {
		update_data.settledAmount = data.amount
		delete update_data.rejectionReason
	}
	// data.amount=recievedTokens
	if (data.status == 'SETTLED') {
		update_data.settledAmount = data.amount
		update_data.amount = data.amount
		update_data.usdAmount = data.usdAmount
		delete update_data.rejectionReason

	}
	console.log(update_data)
	Transactions.updateOne(find_data, update_data, function (err, res) {
		if (err) {
			console.error(err);
			return cb(responseUtilities.sendResponse(500, "transaction status updated", "updateTransactionStatus", null, null));

		}
		return cb(null, responseUtilities.sendResponse(200, "transaction status updated", "updateTransactionStatus", null, null));

	});
};




/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for get total Revenue
 */
exports.getTotalRevenue = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		status: "COMPLETED",
		"gatewayName": { $ne: "DIRECT_ADMIN_PAYMENT_TRANSACTION" }
	};

	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};

	if ([role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	};

	if (data.userId) {
		findData.userId = data.userId
	};

	if (data.packageId) {
		findData.packageId = data.packageId
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	console.log("FindTransactions => ", findData)
	Transactions.find(findData)
		.exec((err, res) => {
			if (err) {
				return cb(responseUtilities.sendResponse(500, null, "getTransactionsPagination", null, null));
			};
			let totalRevenue = 0;
			for (let i = 0; i < res.length; i++) totalRevenue += parseFloat(res[i].usdAmount);
			let DTS = {
				revenueGenerated: totalRevenue.toFixed(2),
				ticketsSold: res.length
			};
			return cb(null, responseUtilities.sendResponse(200, "Latest Transactions fetched", "getTransactionsPagination", DTS, null));
		})
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Stripe Webhook
 */
const checkStripeTransaction = function (data, response, cb) {

	if (!cb) {
		cb = response;
	};

	console.log("Stripe webhook has been called......");
	// console.log("Webhook Data => ", data);
	if (data && data.data && data.data.object && data.data.object.id) {

		data.txnId = data.data.object.id;

		let waterfallFunctions = [];
		waterfallFunctions.push(async.apply(getSpecificTransaction, data));
		waterfallFunctions.push(async.apply(checkStripeTrasactionStatus, data));
		waterfallFunctions.push(async.apply(updateStripeTransactionStatus, data));
		waterfallFunctions.push(async.apply(generatePurchasePass, data));
		waterfallFunctions.push(async.apply(updateVisitorPurchasePassStatus, data));

		waterfallFunctions.push(async.apply(sendNotificationTicketPurchaseConfirmation, data));

		async.waterfall(waterfallFunctions, cb);

	} else {
		return cb(null, responseUtilities.sendResponse(200, "Stripe :Not valid response", "checkTransaction", null, data.req.signature));
	}
}
exports.checkStripeTransaction = checkStripeTransaction;


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for Stripe Webhook
 */
const checkEventAndUpdateVisitorPassStatus = function (data, response, cb) {

	if (!cb) {
		cb = response;
	};
	console.log("inside checkEventAndUpdateVisitorPassStatus method ", data);
	let waterfallFunctions = [];
	if(data.eventId) {
		waterfallFunctions.push(async.apply(getEventById, data));
	}
	waterfallFunctions.push(async.apply(updateVisitorPurchasePassStatus, data));
	async.waterfall(waterfallFunctions, cb);

}
exports.checkEventAndUpdateVisitorPassStatus = checkEventAndUpdateVisitorPassStatus;
/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Send notification after ticket purchase
 */
const sendNotificationTicketPurchaseConfirmation = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	if (!data.visitorId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "sendNotificationTicketPurchaseConfirmation", null, data.req.signature));
	};

	let findData = {
		_id: data.visitorId
	};

	Visitors.findOne(findData).populate('eventAdminId eventId userId')
		.exec((err, resVisitor)  => {
		if (err) {
			console.error("Unable to find Visitor", err);
			return cb(responseUtilities.sendResponse(500, null, "sendNotificationTicketPurchaseConfirmation", null, null));
		}
		if (!resVisitor) {
			return cb(responseUtilities.sendResponse(400, "Ticket purchase mail not sent", "sendNotificationTicketPurchaseConfirmation", null, null));
		}
		console.log("data.status ", data.status);
		if (resVisitor.userId.deviceInfo[0] && (data.status == "COMPLETED")) {
			let titleData = "Ticket purchased!";
			let messageData = `You're all set! See you at ${resVisitor?.eventId?.name}.`;
			let insertNotification = {
				alertType: "PUSH_NOTIFICATION",
				targetUser : "ALL_USERS",
				message: messageData,
				title: titleData,
				createdBy:  resVisitor?.userId?._id,
				userId: resVisitor?.userId?._id,
				eventAdminId:  resVisitor?.eventAdminId?._id,
			}
			notifications.create(insertNotification, (errN, resN) => {
				if (errN) {
					console.log('Error', errN);
				}
				console.log(resN)
				if(resN){
					let deviceTokens = resVisitor.userId.deviceInfo;
	
					let payload = {};
					
					let notification = {
						message: messageData,
						title: titleData,
						imageUrl: "",
					};

					deviceTokens.forEach(async (element) => {
						if (element.platform == "ios" || element.platform == "android") {
							console.log("token android ios", element);
							
							let notifRes = await notify.sendSingleNotification(
								element.token,
								notification,
								payload
							);
							console.log("Ticket purchase notification resp====", typeof notifRes, typeof i);
							if (notifRes.success) {
								console.log("Ticket purchase notification sent");		
								
								notifications.findOneAndUpdate({ _id: resN._id },{ isSent: true }, (err, response) => {
									if (err) {
										console.error("Unable to update notification: ", err);
									}
									console.log("Success, Notification updated successfully", response)
								});
							}
						}
					});
						
				}
			});
		}

		return cb(
			null,
			responseUtilities.sendResponse(
				200,
				null,
				"sendNotificationTicketPurchaseConfirmation",
				null,
				null
			)
		);
	});
};


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for getting CP/Stripe Webhook associated transaction 
 */
const getSpecificTransaction = function (data, response, cb) {
	if (!cb) {
		cb = response
	}
	let findData = {};

	if (data && data.txnId) {
		findData = {
			"txnId": data.txnId
		}
	}
	console.log("Get Specific Transaction findData => ", findData);

	Transactions.findOne(findData).populate("packageId").exec(function (err, res) {
		if (err) {
			return cb(responseUtilities.sendResponse(500, "Something went wrong", "getSpecificTransaction", null, null));
		};
		if (!res) {
			return cb(responseUtilities.sendResponse(400, "Transaction not found...", "getSpecificTransaction", null, data.req.signature));
		}
		console.log("Transaction for corrosponding webhook id fetched => ", res._id);

		data.visitorId = res.visitorId;
		data.packageDetails = res.packageId;
		return cb(null, responseUtilities.sendResponse(200, "getSpecificTransaction", "getSpecificTransaction", res, null));
	});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking Transaction Status
 */
const checkStripeTrasactionStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	// if (!response || !response.data) {
	// 	console.log("TransactionService: No transaction found")
	// 	return cb(null, responseUtilities.sendResponse(200, "TransactionService: No transaction found", "checkTransactionStatus", null, data.req.signature));
	// } else {
	// }

	let transactionObject = response.data;
	data.transactionId = transactionObject._id;

	let event, eventType, eventData;

	// Check if webhook signing is configured.
	if (process.env.STRIPE_WEBHOOK_SECRET) {

		// Retrieve the event by verifying the signature using the raw body and secret.
		let signature = data.req.request.headers["stripe-signature"];
		try {
			event = stripe.webhooks.constructEvent(
				data.rawBody,
				signature,
				process.env.STRIPE_WEBHOOK_SECRET
			);
			console.log("Event retrieved from stripe signature and body provided in webhook....", event)
		} catch (err) {
			console.log(`Webhook signature verification failed.`, err);
			return cb(responseUtilities.sendResponse(400, "Webhook signature verification failed.", "checkStripeTrasactionStatus", null, data.req.signature));
		};

		eventData = event.data;
		eventType = event.type;

	} else {
		// Webhook signing is recommended, but if the secret is not configured in `config.js`,
		// we can retrieve the event data directly from the request body.
		eventData = req.body.data;
		eventType = req.body.type;
	};

	console.log("Data has been captured via signing....");
	data.webhookData = event;

	// // Funds have been captured
	// if (eventType === 'payment_intent.succeeded') {
	// 	console.log('💰 Payment captured!');
	// 	data.status = "COMPLETED";
	// 	data.isPackagePurchased = true;

	// }
	// //Failed Payment
	// else if (eventType === 'payment_intent.payment_failed') {

	// 	console.log('Payment failed.');
	// 	data.status = "FAILED";
	// 	data.isPackagePurchased = false;


	// }
	// //Intent created or Processing
	// else if (eventType === 'payment_intent.created' || eventType === 'payment_intent.processing') {
	// 	console.log('Payment Pending');
	// 	data.status = "PENDING";
	// 	data.isPackagePurchased = false;


	// } else {
	// 	return cb(responseUtilities.sendResponse(400, "Action not supported...", "checkStripeTrasactionStatus", null, null));
	// };
	// if (data.status) {
	// 	return cb(null, responseUtilities.sendResponse(200, "fetched successfully", "checkStripeTrasactionStatus", transactionObject, null));
	// }


	// Handle the event
	switch (eventType) {

		// case 'payment_intent.amount_capturable_updated':
		// 	const paymentIntentAmountCapturableUpdated = event.data.object;
		// 	// Then define and call a function to handle the event payment_intent.amount_capturable_updated
		// 	break;

		case 'payment_intent.canceled':
			console.log('Payment Cancelled');
			data.status = "CANCELLED";
			data.isPackagePurchased = false;
			// Then define and call a function to handle the event payment_intent.canceled
			break;

		case 'payment_intent.created':

			console.log('Payment Pending');
			data.status = "PENDING";
			data.isPackagePurchased = false;
			break;

		case 'payment_intent.partially_funded':

			console.log('Partial Payment Pending');
			data.status = "PARTIAL";
			data.isPackagePurchased = false;
			break;

		case 'payment_intent.payment_failed':

			console.log('Payment failed.');
			data.status = "FAILED";
			data.isPackagePurchased = false;
			break;

		case 'payment_intent.processing':

			console.log('Payment Processing.');
			data.status = "PROCESSING";
			data.isPackagePurchased = false;
			break;

		case 'payment_intent.requires_action':

			console.log('Payment Requires Action.');
			data.status = "PROCESSING";
			data.isPackagePurchased = false;
			break;

		case 'payment_intent.succeeded':
			console.log('💰 Payment captured!');
			data.status = "COMPLETED";
			data.isPackagePurchased = true;
			break;

		default:
			console.log(`Unhandled event type ${event.type}`);
			break;
	};

	if (data.status) {
		return cb(null, responseUtilities.sendResponse(200, "fetched successfully", "checkStripeTrasactionStatus", transactionObject, null));
	} else {
		return cb(responseUtilities.sendResponse(400, "Action not supported...", "checkStripeTrasactionStatus", null, null));
	}
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update Stripe Transaction Status
 */
const updateStripeTransactionStatus = async function (data, response, cb) {
	if (!cb) {
		cb = response
	};

	let transactionObject = response.data


	let findData = {
		"txnId": transactionObject.txnId
	}
	let updateData = {
		"status": data.status,
		$push: {
			webhookData: data.webhookData
		},
	};

	if (data.status == "COMPLETED") {
		let invoiceNumber = await generateInvoiceNumber();
		if (invoiceNumber.error) {
			return cb(responseUtilities.sendResponse(400, "Invoice couldnot be generated", "updateStripeTransactionStatus", null, data.req.signature));
		};

		invoiceNumber = invoiceNumber.data;
		console.log("Invoice Number =>", invoiceNumber?.data)
		updateData.invoiceNumber = invoiceNumber
	};

	let options = {
		new: true
	}
	console.log("Transaction Status Update => ", updateData);
	Transactions.findOneAndUpdate(findData, updateData, options, function (err, res) {
		if (err) {
			console.error("updateStripeTransactionStatus => ", err);
		}
		console.log("Transaction status updated....", data.status);
		return cb(null, responseUtilities.sendResponse(200, "Status updated", "updateStripeTransactionStatus", res, null));
	});
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for generate Ticket after transaction Confirmation
 */
const generatePurchasePass = function (data, response, cb) {
	if (!cb) {
		cb = response
	};

	if (!response || !response.data) {
		console.log("No transaction was updated....")
		return cb(null, responseUtilities.sendResponse(200, "generatePurchasePass", "generatePurchasePass", null, null));
	} else if (response.data.status != "COMPLETED") {
		console.log("Transaction not completed....", response.data.status);
		return cb(null, responseUtilities.sendResponse(200, "Transaction not completed...", "generatePurchasePass", null, null));
	} else {
		let transactionObject = response.data;
		let insertData = {
			packageId: transactionObject.packageId,
			eventId: transactionObject.eventId,
			packageType: transactionObject?.packageId?.type || data.packageDetails?.type,

			userId: transactionObject.userId,
			transactionId: transactionObject._id,
			visitorId: transactionObject.visitorId,

			// isPassActivated: false,
			isExpired: false,
			isBlocked: false,
			isUpgraded: false
		}

		console.log("Generate Puchase Package DOC = > ", insertData)
		PurchasePackages.create(insertData, function (err, res) {
			if (err) {
				return cb(responseUtilities.sendResponse(500, "Something went wrong", "generatePurchasePass", null, null));
			};
			data.eventDataId = response.data.eventId;
			console.log("inside generate pass purchase method", data.eventId)
			return cb(null, responseUtilities.sendResponse(200, "Inactive Pass Generated", "generatePurchasePass", data.sendData, null));
		});
	}
};
exports.generatePurchasePass = generatePurchasePass;


/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for updating visitor
 */
const updateVisitorPurchasePassStatus = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}
	if (!data.visitorId) {
		return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitorPurchasePassStatus", null, data.req.signature));
	};

	let findData = {
		_id: data.visitorId
	};
	console.log("event pass active status ", data.eventDetails);
	let updateVisitorData = {
		isPackagePurchased: data.isPackagePurchased
	}
	if(data.eventDataId){
		Events.findOne({ _id: data.eventDataId }, (errE, resE) => {
			if (errE) {
				console.error("Unable to fetch event", errE);
				return cb(responseUtilities.sendResponse(500, null, "updateVisitorPurchasePassStatus", null, null));
			}
			if (!resE) {
				console.error("Event not found");
				return cb(responseUtilities.sendResponse(400, null, "updateVisitorPurchasePassStatus", null, null));
			}
			
			if(resE && (resE.category == "PAID") && resE.passActivatedStatus && (resE.passActivatedStatus.isVisitorPassActivated == true)){
				updateVisitorData.isPassActivated = true
			}
			Visitors.findOneAndUpdate(findData, updateVisitorData, (err, res) => {
				if (err) {
					console.error("Unable to update Visitors with pass activated", err);
					return cb(responseUtilities.sendResponse(500, null, "updateVisitorPurchasePassStatus", null, null));
				}
				return cb(null, responseUtilities.sendResponse(200, "Visitor updated", "updateVisitorPurchasePassStatus", null, null));
			});
		});
	}else{
		console.log("Update Visitor Package purchase boolean => ", updateVisitorData)
		Visitors.findOneAndUpdate(findData, updateVisitorData, (err, res) => {
			if (err) {
				console.error("Unable to update Visitors", err);
				return cb(responseUtilities.sendResponse(500, null, "updateVisitorPurchasePassStatus", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Visitor updated", "updateVisitorPurchasePassStatus", null, null));
		});
	}
};




/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Export all transactions 
 */
exports.exportAllTransactions = function (data, response, cb) {
	if (!cb) {
		cb = response;
	}

	let findData = {
		// status: "COMPLETED"
	};

	if (data.status) {
		findData.status = data.status
	};


	if (data.req.auth.role == role.eventadmin) {
		findData.eventAdminId = data.req.auth.id
	};

	if ([role.eventmanager, role.staff, role.marketingmanager, role.financemanager].includes(data.req.auth.role)) {
		findData.eventId = { $in: data.req.auth.filteredEvents };
		findData.eventAdminId = data.req.auth.eventAdminId;
	};

	if (data.userId) {
		findData.userId = data.userId
	};

	if (data.packageId) {
		findData.packageId = data.packageId
	};

	if (data.eventId) {
		findData.eventId = data.eventId
	};

	let createdAt = {}
	if (data.fromDate) createdAt["$gte"] = new Date(new Date(data.fromDate).setUTCHours(0, 0, 0, 0));
	if (data.toDate) createdAt["$lte"] = new Date(new Date(data.toDate).setUTCHours(23, 59, 59, 0));
	if (data.fromDate || data.toDate) findData.createdAt = createdAt;


	let populateArray = [];

	if (data.search) {
		populateArray[0] = {
			path: "userId",
			select: "email name",
			match: {
				$or: [
					{ name: { $regex: data.search, "$options": "i" } },
					{ email: { $regex: data.search, "$options": "i" } }
				]
			},
			model: "User"
		}
	} else {
		populateArray[0] = {
			path: "userId",
			select: "email name",
			model: "User"
		}
	};

	if (data.type) {
		populateArray[1] = {
			path: "packageId",
			select: "title type",
			match: {
				type: data.type,
			},
			model: "packages"
		}
	} else {
		populateArray[1] = {
			path: "packageId",
			select: "title type",
			model: "packages"
		}
	};

	populateArray[2] = {
		path: "eventId",
		select: "name ",
		model: "event"
	};

	populateArray[3] = {
		path: "visitorId",
		select: "name email",
		model: "visitors"
	};
	Transactions.find(findData)
		.populate(populateArray)
		.sort({ createdAt: -1 })
		.exec((err, res) => {
			if (err) {
				console.log('error in finding exportAlltransactions => ', err)
				return cb(responseUtilities.sendResponse(500, "Something Went Wrong", "exportAllTransactions", err, null));
			}

			if (!res.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllTransactions", null, null));
			};

			let resU = res.filter(e => ((e.userId != null) && (e.packageId != null) && (e.eventId != null)));


			let dataArray = [];
			for (let i = 0; i < resU.length; i++) {

				let transaction = resU[i];
				if (data.eventId && !transaction.eventId) {
					continue;
				}
				if (data.agencyId && !transaction.eventAdminId) {
					continue;
				}

				let fieldObject = {
					"Event": transaction?.eventId?.name,
					"id": transaction._id,
					"Email": transaction.userId?.email,
					"Name": transaction?.userId?.name,
					"Status": transaction?.status,
					"Amount": transaction?.usdAmount || transaction?.amount,
					"Gateway": transaction?.gatewayName,
					"Visitor Email": transaction?.visitorId?.email
				}
				dataArray.push(fieldObject);
			}

			if (!dataArray.length) {
				return cb(responseUtilities.sendResponse(400, "No Record(s) found", "exportAllTransactions", null, null));

			}
			return cb(null, responseUtilities.sendResponse(200, "Record(s) found", "exportAllTransactions", dataArray, null));
		})
}


// let webookData = {
// 	id: 'evt_3O0ISPSC2iOuz9Ve11a1YpYK',
// 	object: 'event',
// 	api_version: '2023-08-16',
// 	created: 1697092415,
// 	data: {
// 		object: {
// 			id: 'pi_3O0ISPSC2iOuz9Ve12kjYoKn',
// 			object: 'payment_intent',
// 			amount: 12000,
// 			amount_capturable: 0,
// 			amount_details: [Object],
// 			amount_received: 12000,
// 			application: null,
// 			application_fee_amount: null,
// 			automatic_payment_methods: null,
// 			canceled_at: null,
// 			cancellation_reason: null,
// 			capture_method: 'automatic',
// 			client_secret: 'pi_3O0ISPSC2iOuz9Ve12kjYoKn_secret_3b20TPyVfn8vYouViTCATmiCD',
// 			confirmation_method: 'automatic',
// 			created: 1697092397,
// 			currency: 'inr',
// 			customer: null,
// 			description: null,
// 			invoice: null,
// 			last_payment_error: null,
// 			latest_charge: 'ch_3O0ISPSC2iOuz9Ve1uRgIico',
// 			livemode: false,
// 			metadata: [Object],
// 			next_action: null,
// 			on_behalf_of: null,
// 			payment_method: 'pm_1O0ISdSC2iOuz9VeEEbZt8N3',
// 			payment_method_configuration_details: null,
// 			payment_method_options: [Object],
// 			payment_method_types: [Array],
// 			processing: null,
// 			receipt_email: null,
// 			review: null,
// 			setup_future_usage: null,
// 			shipping: null,
// 			source: null,
// 			statement_descriptor: null,
// 			statement_descriptor_suffix: null,
// 			status: 'succeeded',
// 			transfer_data: null,
// 			transfer_group: null
// 		}
// 	},
// 	livemode: false,
// 	pending_webhooks: 2,
// 	request: {
// 		id: null,
// 		idempotency_key: 'pi_3O0ISPSC2iOuz9Ve12kjYoKn-src_1O0ISeSC2iOuz9VejSqva67H'
// 	},
// 	type: 'payment_intent.succeeded'
// }



//Generate Invocie Number
async function generateInvoiceNumber() {

	try {
		let allSucessTransactionCount = await Transactions.countDocuments({ status: "COMPLETED" });
		allSucessTransactionCount = allSucessTransactionCount + 1;
		if (allSucessTransactionCount < 1) {
			return "TE0001";
		}

		const digitCount = Math.floor(Math.log10(allSucessTransactionCount)) + 1;
		const zerosToAdd = Math.max(0, 4 - digitCount);
		const formattedNumber = "TE" + "0".repeat(zerosToAdd) + allSucessTransactionCount;
		return {
			error: false,
			data: formattedNumber
		};

	} catch (err) {
		return {
			error: true,
			data: err
		}
	}
};

/**
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update Stripe Transaction Status
 */
exports.validateStripeTransaction = async function  (data, response, cb) {
	if (!cb) {
		cb = response
	};
	if (!data.txnId && !data.txnStatus) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "validateStripeTransaction", null, null));
    };

    let waterfallFunctions = [];
    waterfallFunctions.push(async.apply(validateStripeTransationStatus, data));
    waterfallFunctions.push(async.apply(updateVisitorStatus, data));
    waterfallFunctions.push(async.apply(updateTransactionStatusAfterPaymentComplete, data));
    async.waterfall(waterfallFunctions, cb);

};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for checking valid transaction
 */
const validateStripeTransationStatus = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };

	if (!data.txnId && !data.txnStatus) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "validateStripeTransationStatus", null, null));
    };

    let findData = {
		"txnId": data.txnId,
		"transactionType": "PACKAGE_PURCHASE"
	}
	
	Transactions.findOne(findData,{ webhookData:0, gatewayData: 0 }, function (err, res) {
		if (err) {
			console.error("validateStripeTransationStatus => ", err);
		}
		if(!res){
			return cb(responseUtilities.sendResponse(400, "Transaction not valid", "validateStripeTransationStatus", null, null));
		}

		data.visitorId = res.visitorId;
		data.transactionId = res._id;
		data.status = res.status;

		console.log("response status", res.status);
		// console.log("Transaction response", res);
		if((res.status != data.txnStatus) || (data.txnStatus == 'FAILED') || (data.txnStatus == 'PENDING')){
			data.status = data.txnStatus;
		}
		return cb(null, responseUtilities.sendResponse(200, "Transaction status fetched", "validateStripeTransationStatus", null, null));
	});
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update visitor status
 */
const updateVisitorStatus = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
	console.log("data.visitorId ", data.visitorId);
	console.log("data.status ", data.status);

	if (!data.visitorId || !data.status) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "updateVisitorStatus", null, null));
    };

    let findData = {
		_id: data.visitorId
	}
	let updateData = {
		$set: {
			isDeleted: true,
			isPackagePurchased: false
		}
	}
	let options = {
		new: true
	}
	if(data.status == "PENDING" || data.status == "FAILED"){
		Visitors.findOneAndUpdate(findData, updateData, options, function (err, res) {
			if (err) {
				console.error("updateVisitorStatus => ", err);
			}
			if(!res){
				return cb(responseUtilities.sendResponse(400, "Unable to update transaction", "updateVisitorStatus", null, null));
			}
			return cb(null, responseUtilities.sendResponse(200, "Visitor updated", "updateVisitorStatus", null, null));
		});
	}else{
		return cb(null, responseUtilities.sendResponse(200, "Visitor not updated", "updateVisitorStatus", null, null));
	}
};

/**
 * 
 * @param {JSON} data 
 * @param {JSON} response 
 * @param {Functon} cb 
 * @description Contoller for update transaction status after payment complete
 */
const updateTransactionStatusAfterPaymentComplete = function (data, response, cb) {
    if (!cb) {
        cb = response;
    };
	console.log("data.transactionId ", data.transactionId);
	console.log("data.status ", data.status);

	if (!data.transactionId || !data.status) {
        return cb(responseUtilities.sendResponse(400, "Missing Params", "updateTransactionStatusAfterPaymentComplete", null, null));
    };

    let findData = {
		_id: data.transactionId
	}
	let updateData = {
		$set: {
			status: data.status
		}
	}
	let options = {
		new: true
	}
	Transactions.findOneAndUpdate(findData, updateData, options, function (err, res) {
		if (err) {
			console.error("updateTransactionStatusAfterPaymentComplete => ", err);
		}
		if(!res){
			return cb(responseUtilities.sendResponse(400, "Unable to update transaction", "updateTransactionStatusAfterPaymentComplete", null, null));
		}
		return cb(null, responseUtilities.sendResponse(200, "Transaction updated", "updateTransactionStatusAfterPaymentComplete", null, null));
	});
}

