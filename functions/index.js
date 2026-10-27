/**
 * ShopBeta Cloud Functions entry point.
 */
const { initializeApp } = require("firebase-admin/app");
const { paystackWebhook } = require("./src/paystackWebhook");
const { paystackInitialize } = require("./src/paystackInitialize");
const { korapayWebhook } = require("./src/korapayWebhook");
const { korapayInitialize } = require("./src/korapayInitialize");
const { squadWebhook } = require("./src/squadWebhook");
const { bachsWebhook } = require("./src/bachsWebhook");

initializeApp();

exports.paystackWebhook = paystackWebhook;
exports.paystackInitialize = paystackInitialize;
exports.korapayWebhook = korapayWebhook;
exports.korapayInitialize = korapayInitialize;
exports.squadWebhook = squadWebhook;
exports.bachsWebhook = bachsWebhook;
