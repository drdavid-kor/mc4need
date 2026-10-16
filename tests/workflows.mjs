import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import crypto from "node:crypto";
const base = "http://127.0.0.1:8787",
  ip = `127.${Math.floor(Math.random() * 200) + 1}.2.1`,
  checks = [];
async function api(p, method = "GET", body, token, status = 200) {
  const r = await fetch(base + "/api" + p, {
    method,
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const b = await r.json();
  assert.equal(r.status, status, `${p}: ${JSON.stringify(b)}`);
  return b;
}
const sql = (s) =>
  execFileSync(
    "node_modules/.bin/wrangler",
    ["d1", "execute", "mc4need-db", "--local", "--command", s],
    { stdio: "pipe" },
  );
const guest = () => api("/auth/guest", "POST", {}, undefined, 201);
const owner = await guest(),
  sp = await guest(),
  other = await guest();
const payload = (title) => ({
  title,
  story: "Synthetic fixture only. No actual meal or delivery.",
  organizer: "Local testing",
  scene: "other",
  meals: [
    { name: "Synthetic meal", quantity: 2, specification: "Never order" },
  ],
  location: {
    name: "Public test point",
    address: "Public test street",
    lat: 31,
    lng: 121,
  },
  mealAt: Date.now() + 3600000,
  acceptBy: Date.now() + 1800000,
  referenceCents: null,
  referenceAt: null,
  recurringDays: null,
  privateDelivery: {
    contactName: "LOCAL-PERSON",
    phone: "LOCAL-PRIVATE-PHONE",
    detail: "LOCAL-PRIVATE-UNIT",
    contact: "LOCAL-PRIVATE-CONTACT",
  },
  consent: true,
  deliveryCheckedAt: Date.now(),
});
async function create(title, recurring = false) {
  const p = payload(title);
  if (recurring) p.recurringDays = 1;
  const n = await api("/needs", "POST", p, owner.token, 201);
  await api(
    `/needs/${n.id}/publish`,
    "POST",
    { version: 1, confirmed: true },
    owner.token,
  );
  return { n, p };
}
async function claim(n, who = sp) {
  return api(
    `/needs/${n.id}/claim`,
    "POST",
    {
      version: n.version,
      displayName: "匿名支持者",
      contact: "SPONSOR-PRIVATE-CONTACT",
    },
    who.token,
    201,
  );
}
async function creating(a) {
  const q = await api(
    `/attempts/${a.id}/quote`,
    "POST",
    {
      amountCents: 1000,
      deliveryCents: 100,
      summary: "Synthetic full quote",
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
const report = (createdAt = Date.now()) => ({
  key: crypto.randomUUID(),
  orderId: crypto.randomUUID(),
  createdAt,
  officialExpiry: null,
  status: "pending",
  observedAt: Date.now(),
});
let { n, p } = await create("Quote expiry fixture");
let a = await claim(n);
sql(`UPDATE attempts SET lock_until=1 WHERE id='${a.id}'`);
await api("/needs");
const replacement = await claim(n, other);
await api(`/attempts/${replacement.id}/release`, "POST", {}, other.token);
checks.push("Expired pre-create lock releases and another sponsor can claim");
await api(
  `/needs/${n.id}`,
  "PUT",
  { ...p, title: "Updated fixture" },
  owner.token,
);
await api(
  `/needs/${n.id}/publish`,
  "POST",
  { version: 2, confirmed: true },
  owner.token,
);
await api(
  `/needs/${n.id}/claim`,
  "POST",
  { version: 1, displayName: "Stale prompt" },
  sp.token,
  409,
);
checks.push(
  "Old need version cannot sponsor after requester update and re-publication",
);
({ n } = await create("Delayed report fixture"));
a = await claim(n);
await creating(a);
const created = Date.now() - 2000;
sql(`UPDATE needs SET accept_by=${created + 1000} WHERE id='${n.id}'`);
let b = report(created);
const synced = await api(`/attempts/${a.id}/sync`, "POST", b, sp.token);
assert.equal(synced.state, "pending");
assert.equal(synced.payBy, created + 600000);
checks.push(
  "Creation before cutoff is accepted even if status report arrives after cutoff",
);
await api(
  `/attempts/${a.id}/sync`,
  "POST",
  { ...b, key: "paid", status: "paid", observedAt: Date.now() },
  sp.token,
);
for (const [i, result] of ["failed", "unknown"].entries()) {
  await api(
    `/attempts/${a.id}/sync`,
    "POST",
    {
      ...b,
      key: "cancel-" + i,
      status: "paid",
      cancelResult: result,
      observedAt: Date.now(),
    },
    sp.token,
  );
  const detail = await api(`/attempts/${a.id}`, "GET", undefined, sp.token);
  assert.equal(detail.cancel_result, result);
  assert.equal(detail.refund_state, "unknown");
}
await api(
  `/attempts/${a.id}/sync`,
  "POST",
  {
    ...b,
    key: "cancelled",
    status: "cancelled",
    cancelResult: "succeeded",
    refundState: "pending",
    observedAt: Date.now(),
  },
  sp.token,
);
let detail = await api(`/attempts/${a.id}`, "GET", undefined, owner.token);
assert.equal(detail.state, "cancelled");
assert.equal(detail.refund_state, "pending");
checks.push(
  "Failed, unknown and successful cancellation outcomes preserve independent refund status",
);
({ n } = await create("Receipt with stale logistics"));
a = await claim(n);
await creating(a);
b = report();
await api(`/attempts/${a.id}/sync`, "POST", b, sp.token);
await api(
  `/needs/${n.id}/receipt`,
  "POST",
  {
    received: true,
    feedback: "Public synthetic receipt despite stale client report",
    publicConsent: true,
  },
  owner.token,
);
let current = await api(`/needs/${n.id}`);
assert.equal(current.status, "completed");
assert.equal(current.progress.state, "pending");
assert(current.receivedAt);
checks.push(
  "Requester receipt completes while preserving stale official-client status as separate evidence",
);
const before = (await api("/me", "GET", undefined, sp.token)).notifications
  .length;
await Promise.all(
  [1, 2].map(() =>
    api(
      `/needs/${n.id}/receipt`,
      "POST",
      { received: true, feedback: "Duplicate", publicConsent: true },
      owner.token,
    ),
  ),
);
assert.equal(
  (await api("/me", "GET", undefined, sp.token)).notifications.length,
  before,
);
checks.push(
  "Repeated completed feedback does not add duplicate completion notifications",
);
await api(
  `/needs/${n.id}/receipt`,
  "POST",
  {
    received: false,
    issue: "Later discrepancy reported",
    publicConsent: false,
  },
  owner.token,
);
current = await api(`/needs/${n.id}`);
assert.equal(current.status, "completed");
assert.equal(
  current.feedback,
  "Public synthetic receipt despite stale client report",
);
assert.equal(current.issue, "Later discrepancy reported");
checks.push(
  "Later discrepancy is visible without deleting the original completed feedback",
);
assert.equal(current.progress.name, "匿名支持者");
assert(!JSON.stringify(current).includes("PRIVATE-"));
checks.push(
  "Anonymous public thanks does not expose either counterpart contact",
);
fs.mkdirSync("reports/private", { recursive: true });
fs.writeFileSync(
  "reports/private/workflow-fixture.json",
  JSON.stringify({ needId: n.id }),
  { mode: 0o600 },
);
({ n } = await create("Cron next-draft fixture " + crypto.randomUUID(), true));
sql(
  `UPDATE needs SET accept_by=${Date.now() - 2000},data=json_set(data,'$.mealAt',${Date.now() - 1000},'$.acceptBy',${Date.now() - 2000}) WHERE id='${n.id}'`,
);
const scheduled = await fetch(base + "/cdn-cgi/local/scheduled");
assert.equal(scheduled.status, 200);
let list;
for (let i = 0; i < 20; i++) {
  list = (await api("/me", "GET", undefined, owner.token)).needs.filter(
    (x) => x.recurringDays === 1 && x.id !== n.id,
  );
  if (list.length) break;
  await new Promise((r) => setTimeout(r, 50));
}
assert.equal(list.length, 1);
const next = list[0];
assert.equal(next.status, "draft");
await api(`/needs/${next.id}`, "GET", undefined, undefined, 404);
await api(
  `/needs/${next.id}/publish`,
  "POST",
  { version: 1, confirmed: true },
  owner.token,
  409,
);
await fetch(base + "/cdn-cgi/local/scheduled");
list = (await api("/me", "GET", undefined, owner.token)).needs.filter(
  (x) => x.recurringDays === 1 && x.id !== n.id,
);
assert.equal(list.length, 1);
assert.equal(
  (await api("/me", "GET", undefined, owner.token)).attempts.filter(
    (x) => x.need_id === next.id,
  ).length,
  0,
);
checks.push(
  "Scheduled recurrence creates one private unverified draft, never publishes or orders",
);
fs.writeFileSync(
  "reports/workflow-results.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      environment: "Local Worker and synthetic D1 only; no official orders",
      passed: checks.length,
      checks,
    },
    null,
    2,
  ) + "\n",
);
checks.forEach((x) => console.log("PASS", x));
