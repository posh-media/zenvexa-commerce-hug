const { onRequest } = require("firebase-functions/v2/https");
const { routeStoreWebhook } = require("./store-routing");
exports.monnifyWebhook = onRequest(async (req, res) => {
  try {
    if (await routeStoreWebhook(req, res, "monnify")) return;
    res.status(404).json({ ok: false });
  } catch {
    res.status(503).json({ ok: false });
  }
});
