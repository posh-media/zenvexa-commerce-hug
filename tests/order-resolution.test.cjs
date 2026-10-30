const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader, database } = require("./payment-test-helpers.cjs");

test("order-number resolution requires authentication, owner/staff permission and correct store before returning an ID", async () => {
  process.env.NEXT_PUBLIC_STORE_ID = "zenvexa";
  process.env.STORE_ID = "zenvexa";
  const f = database({
    "orders/foreign": { orderNumber: "SAME", userId: "owner", storeId: "shopbeta" },
    "orders/local": { orderNumber: "SAME", userId: "owner", storeId: "zenvexa" },
    "users/admin": { role: "admin" },
    "users/suspended": { role: "admin", status: "suspended" },
    "users/inactive": { role: "admin", active: false },
  });
  const load = loader({
    "@/lib/server/firebase-admin": { getAdminDb: () => f.db, getAdminApp: () => ({}) },
    "firebase-admin/auth": { getAuth: () => ({ verifyIdToken: async (token) => ({ uid: token }) }) },
    "@/lib/server/create-order": {},
    "@/lib/server/rate-limit": { rateLimit: () => ({ ok: true }), clientKeyFromRequest: () => "fixture" },
  });
  const get = load("@/app/api/orders/route").GET;
  const request = (number, token) => new Request(`https://example.test/api/orders?order=${number}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  assert.equal((await get(request("SAME"))).status, 401);
  for (const token of ["intruder", "suspended", "inactive"]) assert.equal((await get(request("SAME", token))).status, 403);
  assert.equal((await get(request("foreign", "admin"))).status, 404);
  for (const token of ["owner", "admin"]) {
    const response = await get(request("SAME", token));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, orderId: "local" });
  }
});
