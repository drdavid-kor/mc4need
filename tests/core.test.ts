import test from "node:test";
import assert from "node:assert/strict";
import {
  payDeadline,
  classifySync,
  canExpireQuote,
  seal,
  unseal,
  needSchema,
} from "../server/core";
test("payment deadline starts at actual creation and respects official expiry", () => {
  assert.equal(payDeadline(1000, null, 600), 601000);
  assert.equal(payDeadline(1000, 2000, 600), 2000);
});
test("late creation stays locked and never appears normally accepted", () =>
  assert.deepEqual(classifySync("pending", 200, 100, false), {
    state: "late",
    release: false,
  }));
test("unknown outcomes and paid cancellations are never reopened automatically", () => {
  assert.equal(classifySync("unknown", 1, 2, false).release, false);
  assert.equal(classifySync("cancelled", 1, 2, true).release, false);
  assert.equal(classifySync("cancelled", 1, 2, false).release, true);
});
test("only quotation locks expire with local time", () => {
  for (const state of ["pending", "creating", "uncertain", "late", "paid"])
    assert.equal(canExpireQuote({ state, lock_until: 1 }, 2), false);
  assert.equal(canExpireQuote({ state: "quoting", lock_until: 1 }, 2), true);
});
test("recipient fields authenticated encryption rejects wrong key and tamper", async () => {
  const value = { phone: "PRIVATE-SENTINEL", detail: "UNIT-SENTINEL" };
  const enc = await seal(value, "test-secret");
  assert(!enc.includes("PRIVATE"));
  assert.deepEqual(await unseal(enc, "test-secret"), value);
  await assert.rejects(unseal(enc, "wrong"));
  await assert.rejects(unseal(enc.slice(0, -6) + "AAAAAA", "test-secret"));
});
test("reject unknown credential-shaped keys on need input", () => {
  assert.equal(needSchema.safeParse({ token: "do-not-store" }).success, false);
});
