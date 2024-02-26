const cryptoWallets = require("crypto-wallets");

const Web3 = require("web3");
const abi = require("../helpers/abis");
const BigNumber = require("bignumber.js");

const fetchTokenPrice = async function (data) {
  let sendData = {
    perTokenPrice: process.env.PER_TOKEN_PRICE,
  };
  return sendData;
};
exports.fetchTokenPrice = fetchTokenPrice;

