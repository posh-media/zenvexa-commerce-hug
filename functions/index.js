/**
 * ShopBeta Cloud Functions entry point.
 */
const { initializeApp } = require("firebase-admin/app");
const { paystackWebhook } = require("./src/paystackWebhook");
const { paystackInitialize } = require("./src/paystackInitialize");
const { korapayWebhook } = require("./src/korapayWebhook");
const { korapayInitialize } = require("./src/korapayInitialize");

initializeApp();

exports.paystackWebhook = paystackWebhook;
exports.paystackInitialize = paystackInitialize;
exports.korapayWebhook = korapayWebhook;
exports.korapayInitialize = korapayInitialize;
