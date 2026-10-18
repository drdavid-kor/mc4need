import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@babel/parser";
import { makePrompt } from "../web/prompts";
import { validCover } from "../server/covers";
const en = JSON.parse(fs.readFileSync("web/en.json", "utf8"));
test("Every static UI translation key has an English entry", () => {
  const missing: string[] = [];
  function walk(n: any) {
    if (!n || typeof n !== "object") return;
    if (
      n.type === "CallExpression" &&
      n.callee?.name === "t" &&
      n.arguments[0]?.type === "StringLiteral"
    ) {
      const key = n.arguments[0].value;
      if (/[\p{Script=Han}]/u.test(key) && !en[key]) missing.push(key);
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === "loc") continue;
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  }
  for (const file of ["web/main.tsx", "web/covers.tsx"])
    walk(
      parse(fs.readFileSync(file, "utf8"), {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      }),
    );
  assert.deepEqual(missing, []);
});
test("Watch prompt is localized, read-only and does not promise unsupported scheduling", () => {
  const en = makePrompt("watch", true);
  assert(!/[\p{Script=Han}]/u.test(en));
  for (const text of [
    "persistent scheduling tool",
    "do not pretend",
    "previously notified need IDs",
    "no McDonald",
    "mainland China",
    "makes no payment",
  ])
    assert(en.includes(text));
  assert(makePrompt("watch", false).includes("不支持定时或通知时如实说明"));
});
test("Cover validator rejects metadata, animation, malformed size and active content", () => {
  const bytes = fs.readFileSync("public/images/covers/other.webp");
  assert(validCover(bytes));
  assert(!validCover(Buffer.from('<svg onload="x"/>')));
  const metadata = Buffer.alloc(10);
  metadata.write("EXIF");
  metadata.writeUInt32LE(2, 4);
  const withMetadata = Buffer.concat([bytes, metadata]);
  withMetadata.writeUInt32LE(withMetadata.length - 8, 4);
  assert(!validCover(withMetadata));
  const animated = Buffer.from(withMetadata);
  animated.write("ANIM", bytes.length);
  assert(!validCover(animated));
  const malformed = Buffer.from(bytes);
  malformed.writeUInt32LE(0, 4);
  assert(!validCover(malformed));
  const oversized = Buffer.alloc(400001);
  assert(!validCover(oversized));
});
