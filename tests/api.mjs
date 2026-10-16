import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const base = process.env.TEST_BASE || "http://127.0.0.1:8787";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Mutation suite runs only against local test databases.");
const checks = [];
const ip = `127.${Math.floor(Math.random() * 200) + 1}.0.1`;
async function req(
  path,
  method = "GET",
  value,
  token,
  expected = 200,
  headers = {},
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...headers,
    },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const b = await r.json();
  assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(b)}`);
  return { b, r };
}
const check = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
const guest = async () => (await req("/auth/guest", "POST", {}, null, 201)).b;
const owner = await guest(),
  sp1 = await guest(),
  sp2 = await guest();
const payload = () => ({
  title: "LOCAL TEST ONLY",
  story: "Synthetic integration fixture, never a real meal.",
  organizer: "Test fixture",
  scene: "other",
  meals: [
    { name: "Synthetic meal", quantity: 30, specification: "Do not order" },
  ],
  location: {
    name: "Test public location",
    address: "PUBLIC-STREET",
    lat: 31,
    lng: 121,
  },
  mealAt: Date.now() + 3600000,
  acceptBy: Date.now() + 1800000,
  referenceCents: 30000,
  referenceAt: Date.now(),
  recurringDays: 30,
  privateDelivery: {
    contactName: "TEST-RECIPIENT",
    phone: "PRIVATE-PHONE-SENTINEL",
    detail: "PRIVATE-UNIT-SENTINEL",
  },
  consent: true,
  deliveryCheckedAt: Date.now(),
});
async function create() {
  const p = payload();
  const n = (await req("/needs", "POST", p, owner.token, 201)).b;
  await req(
    `/needs/${n.id}/publish`,
    "POST",
    { version: 1, confirmed: true },
    owner.token,
  );
  return n;
}
const n = await create();
check("Guest requester publishes without email or invitation");
const pub = (await req(`/needs/${n.id}`)).b;
assert(!JSON.stringify(pub).includes("PRIVATE-"));
assert(!JSON.stringify(pub).includes(owner.userId));
check("Public response excludes private delivery and owner identity");
await req(`/private/needs/${n.id}`, "GET", undefined, sp1.token, 403);
await req("/admin/overview", "GET", undefined, sp1.token, 403);
check("Cross-user private data and admin access rejected");
const claims = await Promise.all(
  [sp1, sp2].map(async (s) => {
    const r = await fetch(base + `/api/needs/${n.id}/claim`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + s.token,
        "Content-Type": "application/json",
        "CF-Connecting-IP": ip,
      },
      body: JSON.stringify({ version: 1, displayName: "Test sponsor" }),
    });
    return { status: r.status, b: await r.json(), s };
  }),
);
assert.deepEqual(claims.map((x) => x.status).sort(), [201, 409]);
const win = claims.find((x) => x.status === 201),
  a = win.b,
  s = win.s,
  loser = claims.find((x) => x.status === 409).s;
check("Concurrent claims create exactly one active sponsor");
await req(`/attempts/${a.id}`, "GET", undefined, loser.token, 403);
await req(`/needs/${n.id}`, "PUT", payload(), owner.token, 409);
check("Nonparty order reads and post-claim menu changes rejected");
const q = (
  await req(
    `/attempts/${a.id}/quote`,
    "POST",
    {
      amountCents: 33000,
      deliveryCents: 3000,
      summary: "Synthetic quote",
      checkedAt: Date.now(),
      needVersion: 1,
      exactMenuConfirmed: true,
    },
    s.token,
  )
).b;
await req(
  `/attempts/${a.id}/creating`,
  "POST",
  { revision: q.revision, confirmed: true },
  s.token,
);
await req(
  `/attempts/${a.id}/creating`,
  "POST",
  { revision: q.revision, confirmed: true },
  s.token,
  409,
);
await req(`/attempts/${a.id}/release`, "POST", {}, s.token, 409);
check(
  "Creating acknowledgement cannot repeat and cannot release a potential order",
);
await req(`/attempts/${a.id}/uncertain`, "POST", {}, s.token);
await req(
  `/needs/${n.id}/claim`,
  "POST",
  { version: 1, displayName: "Second sponsor" },
  loser.token,
  409,
);
check("Unknown create response keeps the whole need locked");
const created = Date.now(),
  orderId = crypto.randomUUID();
const observation = {
  key: "pending-1",
  orderId,
  createdAt: created,
  officialExpiry: created + 300000,
  status: "pending",
  observedAt: Date.now(),
};
const sync = (await req(`/attempts/${a.id}/sync`, "POST", observation, s.token))
  .b;
assert.equal(sync.payBy, created + 300000);
const repeat = (
  await req(`/attempts/${a.id}/sync`, "POST", observation, s.token)
).b;
assert(repeat.duplicate);
check("Order sync is idempotent and official expiry shortens payment window");
await req(
  `/attempts/${a.id}/sync`,
  "POST",
  { ...observation, key: "paid", status: "paid", observedAt: Date.now() },
  s.token,
);
await req(
  `/attempts/${a.id}/sync`,
  "POST",
  {
    ...observation,
    key: "delivered",
    status: "delivered",
    observedAt: Date.now(),
  },
  s.token,
);
assert.notEqual((await req(`/needs/${n.id}`)).b.status, "completed");
check("Official delivered report does not complete the platform need");
await req(
  `/attempts/${a.id}/messages`,
  "POST",
  { body: "PRIVATE-MESSAGE-SENTINEL" },
  owner.token,
  201,
);
const priv = (await req(`/attempts/${a.id}`, "GET", undefined, s.token)).b;
assert.equal(priv.messages[0].body, "PRIVATE-MESSAGE-SENTINEL");
assert(!JSON.stringify((await req(`/needs/${n.id}`)).b).includes("PRIVATE-"));
check("Order message shared with counterpart but never public");
await req(
  `/needs/${n.id}/receipt`,
  "POST",
  { received: true, publicConsent: false },
  s.token,
  403,
);
await req(
  `/needs/${n.id}/receipt`,
  "POST",
  { received: true, publicConsent: false },
  owner.token,
);
assert.notEqual((await req(`/needs/${n.id}`)).b.status, "completed");
await req(
  `/needs/${n.id}/receipt`,
  "POST",
  {
    received: true,
    feedback: "Public synthetic feedback",
    publicConsent: true,
  },
  owner.token,
);
const completed = (await req(`/needs/${n.id}`)).b;
assert.equal(completed.status, "completed");
await req(
  `/needs/${n.id}/receipt`,
  "POST",
  { received: true, feedback: "Overwrite attempt", publicConsent: true },
  owner.token,
);
assert.equal(
  (await req(`/needs/${n.id}`)).b.feedback,
  "Public synthetic feedback",
);
check(
  "Only requester receipt plus feedback completes, repeat cannot overwrite",
);
const next = (
  await req(
    `/needs/${n.id}/next`,
    "POST",
    { confirmed: true },
    owner.token,
    201,
  )
).b;
await req(`/needs/${next.id}`, "GET", undefined, undefined, 404);
await req(
  `/needs/${next.id}/publish`,
  "POST",
  { version: 1, confirmed: true },
  owner.token,
  409,
);
check("Next occurrence stays private draft and requires fresh delivery check");
const link = (await req("/auth/link", "POST", {}, owner.token)).b.url;
const t = new URL(link).hash.slice(1);
const ex = await req("/auth/exchange", "POST", { token: t });
assert(ex.r.headers.get("set-cookie").includes("HttpOnly"));
await req("/auth/exchange", "POST", { token: t }, undefined, 401);
await req("/auth/guest", "POST", {}, undefined, 403, {
  Origin: "https://evil.example",
});
check(
  "One-use login cannot replay; cookie HttpOnly; cross-origin mutations rejected",
);
await req(
  "/needs/demo-birthday/claim",
  "POST",
  { version: 1, displayName: "No demo checkout" },
  sp1.token,
  409,
);
const stats = (await req("/needs")).b.stats;
assert(stats.completed >= 1);
check("Demo cannot enter real checkout");
const n2 = await create();
const a2 = (
  await req(
    `/needs/${n2.id}/claim`,
    "POST",
    { version: 1, displayName: "Sponsor" },
    sp1.token,
    201,
  )
).b;
await req(
  `/attempts/${a2.id}/cancel`,
  "POST",
  { reason: "Please cancel" },
  owner.token,
);
const cancelled = (await req(`/attempts/${a2.id}`, "GET", undefined, sp1.token))
  .b;
assert(cancelled.cancel_requested_at);
assert.equal(cancelled.state, "quoting");
assert.equal(cancelled.refund_state, "unknown");
assert(cancelled.messages.some((m) => m.body.includes("Please cancel")));
check(
  "Cancellation request retains separate actual state/refund and contact thread",
);
await req(
  `/attempts/${a2.id}/unavailable`,
  "POST",
  { reason: "Exact menu unavailable" },
  sp1.token,
);
assert.equal((await req(`/needs/${n2.id}`)).b.status, "update");
await req(
  `/needs/${n2.id}/claim`,
  "POST",
  { version: 1, displayName: "Sponsor" },
  sp2.token,
  409,
);
check("Unavailable menu pauses need until requester updates");
const ended = (await req(`/attempts/${a2.id}`, "GET", undefined, sp1.token)).b;
assert.equal(ended.privateDelivery, null);
check("Released sponsor cannot read current private delivery data");
fs.mkdirSync("reports/private", { recursive: true });
fs.writeFileSync(
  "reports/private/local-fixture.json",
  JSON.stringify({
    ownerToken: owner.token,
    ownerId: owner.userId,
    attemptId: a.id,
    needId: n.id,
  }),
  { mode: 0o600 },
);
fs.writeFileSync(
  "reports/api-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      environment: "local Wrangler D1; synthetic orders only",
      passed: checks.length,
      checks,
    },
    null,
    2,
  ),
);
console.log(`${checks.length} integration checks passed.`);
