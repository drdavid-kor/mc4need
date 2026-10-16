import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
const base = "http://127.0.0.1:8787",
  ip = `127.${Math.floor(Math.random() * 200) + 1}.1.1`,
  checks = [];
async function api(p, method = "GET", value, token, status = 200) {
  const r = await fetch(base + "/api" + p, {
    method,
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const b = await r.json();
  assert.equal(r.status, status, JSON.stringify(b));
  return b;
}
const sql = (s) =>
  execFileSync(
    "node_modules/.bin/wrangler",
    ["d1", "execute", "mc4need-db", "--local", "--command", s],
    { stdio: "pipe" },
  );
const owner = await api("/auth/guest", "POST", {}, null, 201),
  sp = await api("/auth/guest", "POST", {}, null, 201),
  other = await api("/auth/guest", "POST", {}, null, 201);
async function setup() {
  const p = {
    title: "LOCAL EDGE TEST",
    story: "Synthetic no real order",
    organizer: "Test",
    scene: "other",
    meals: [{ name: "Test meal", quantity: 1, specification: "Test only" }],
    location: { name: "TEST", address: "TEST", lat: 0, lng: 0 },
    mealAt: Date.now() + 3600000,
    acceptBy: Date.now() + 1800000,
    referenceCents: null,
    referenceAt: null,
    recurringDays: null,
    privateDelivery: { contactName: "Test", phone: "Test", detail: "Test" },
    consent: true,
    deliveryCheckedAt: Date.now(),
  };
  const n = await api("/needs", "POST", p, owner.token, 201);
  await api(
    `/needs/${n.id}/publish`,
    "POST",
    { version: 1, confirmed: true },
    owner.token,
  );
  const a = await api(
    `/needs/${n.id}/claim`,
    "POST",
    { version: 1, displayName: "Test" },
    sp.token,
    201,
  );
  return { n, a, p };
}
async function creating(a) {
  const q = await api(
    `/attempts/${a.id}/quote`,
    "POST",
    {
      amountCents: 100,
      deliveryCents: 0,
      summary: "Test",
      checkedAt: Date.now(),
      needVersion: 1,
      exactMenuConfirmed: true,
    },
    sp.token,
  );
  await api(
    `/attempts/${a.id}/creating`,
    "POST",
    { revision: q.revision, confirmed: true },
    sp.token,
  );
}
const obs = (created = Date.now()) => ({
  key: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  createdAt: created,
  officialExpiry: null,
  status: "pending",
  observedAt: Date.now(),
});
let { n, a } = await setup();
await creating(a);
sql(`UPDATE needs SET accept_by=${Date.now() - 1000} WHERE id='${n.id}'`);
let b = obs();
let r = await api(`/attempts/${a.id}/sync`, "POST", b, sp.token);
assert.equal(r.state, "late");
await api(
  `/needs/${n.id}/claim`,
  "POST",
  { version: 1, displayName: "Other" },
  other.token,
  409,
);
checks.push("Late official creation remains locked, no second sponsor");
await api(
  `/attempts/${a.id}/sync`,
  "POST",
  {
    ...b,
    key: "cancel-late",
    status: "cancelled",
    unpaidConfirmed: true,
    observedAt: Date.now(),
  },
  sp.token,
);
assert.equal((await api(`/needs/${n.id}`)).status, "closed");
checks.push("Confirmed unpaid cancellation after cutoff closes occurrence");
({ n, a } = await setup());
await creating(a);
b = obs(Date.now() - 2000);
b.officialExpiry = Date.now() - 1000;
r = await api(`/attempts/${a.id}/sync`, "POST", b, sp.token);
assert.equal(r.state, "uncertain");
await api(
  `/needs/${n.id}/claim`,
  "POST",
  { version: 1, displayName: "Other" },
  other.token,
  409,
);
checks.push(
  "Expired local/official deadline without terminal outcome retains lock",
);
await api(
  `/attempts/${a.id}/sync`,
  "POST",
  {
    ...b,
    key: "mutated-time",
    createdAt: b.createdAt + 1,
    observedAt: Date.now(),
  },
  sp.token,
  409,
);
checks.push("Actual order creation timestamp cannot be rewritten");
await api(
  `/attempts/${a.id}/sync`,
  "POST",
  { ...b, key: "paid", status: "paid", observedAt: Date.now() },
  sp.token,
);
r = await api(
  `/attempts/${a.id}/sync`,
  "POST",
  { ...b, key: "regressed", status: "pending", observedAt: Date.now() },
  sp.token,
);
assert.equal(r.state, "uncertain");
checks.push("Pending after paid is a traceable conflict, not a reset");
await api(
  `/attempts/${a.id}/sync`,
  "POST",
  {
    ...b,
    key: "cancel-paid",
    status: "cancelled",
    unpaidConfirmed: true,
    observedAt: Date.now(),
  },
  sp.token,
);
assert.equal(
  (await api(`/attempts/${a.id}`, "GET", undefined, sp.token)).active,
  1,
);
checks.push(
  "Previously paid cancellation cannot reopen even with conflicting unpaid claim",
);
({ n, a } = await setup());
await creating(a);
b = obs();
const results = await Promise.all(
  ["parallel-a", "parallel-b"].map(async (key) => {
    const r = await fetch(base + `/api/attempts/${a.id}/sync`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + sp.token,
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
      },
      body: JSON.stringify({ ...b, key }),
    });
    return r.status;
  }),
);
const detail = await api(`/attempts/${a.id}`, "GET", undefined, sp.token);
assert.equal(
  detail.observations.length,
  results.filter((s) => s === 200).length,
);
checks.push(
  "Concurrent sync only writes observations for successful mutations",
);
({ n, a } = await setup());
await api(
  `/attempts/${a.id}/cancel`,
  "POST",
  { reason: "Cancel before creation" },
  owner.token,
);
await api(
  `/attempts/${a.id}/quote`,
  "POST",
  {
    amountCents: 100,
    deliveryCents: 0,
    summary: "Test",
    checkedAt: Date.now(),
    needVersion: 1,
    exactMenuConfirmed: true,
  },
  sp.token,
);
await api(
  `/attempts/${a.id}/creating`,
  "POST",
  { revision: 3, confirmed: true },
  sp.token,
  409,
);
checks.push("Cancellation request prevents a new create call");
const l = await api("/auth/link", "POST", {}, owner.token);
const hash = crypto
  .createHash("sha256")
  .update(new URL(l.url).hash.slice(1))
  .digest("hex");
sql(`UPDATE login_links SET expires_at=1 WHERE hash='${hash}'`);
await api(
  "/auth/exchange",
  "POST",
  { token: new URL(l.url).hash.slice(1) },
  null,
  401,
);
checks.push("Expired one-use link is rejected");
fs.writeFileSync(
  "reports/edge-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      environment: "local synthetic D1 fixtures only",
      passed: checks.length,
      checks,
    },
    null,
    2,
  ),
);
checks.forEach((x) => console.log("PASS", x));
