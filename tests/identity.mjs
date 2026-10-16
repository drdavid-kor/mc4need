import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const base = "http://127.0.0.1:8787",
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc4need-identity-"));
const env = {
  ...process.env,
  MC4NEED_API: base,
  MC4NEED_HOME: path.join(dir, "new-device"),
};
const checks = [];
async function api(route, body, token, status = 200) {
  const r = await fetch(base + "/api" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(r.status, status);
  return r.json();
}
function cli(args, fail = false) {
  try {
    const out = execFileSync(process.execPath, ["cli/mc4need.mjs", ...args], {
      env,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert(!fail, "Expected command to fail");
    return out;
  } catch (e) {
    if (!fail) throw e;
    return e.stderr.toString();
  }
}
try {
  const user = await api("/auth/guest", {}, undefined, 201);
  await api("/auth/cli-session", { confirmed: true }, undefined, 401);
  await api("/auth/cli-session", { confirmed: false }, user.token, 400);
  const downloaded = await api(
    "/auth/cli-session",
    { confirmed: true },
    user.token,
  );
  assert.equal(downloaded.userId, user.userId);
  assert.notEqual(downloaded.token, user.token);
  checks.push(
    "Only an authenticated confirmed action creates a separate CLI session",
  );
  const file = path.join(dir, "download.json");
  fs.writeFileSync(file, JSON.stringify(downloaded), { mode: 0o600 });
  const output = cli(["auth", "import-file", file]);
  assert(!output.includes(downloaded.token));
  assert.equal(JSON.parse(output).userId, user.userId);
  const identityFile = path.join(env.MC4NEED_HOME, "identity.json");
  assert.equal(fs.statSync(identityFile).mode & 0o777, 0o600);
  assert.equal(JSON.parse(cli(["auth", "me"])).user.id, user.userId);
  checks.push(
    "New CLI device restores the same identity without printing its credential",
  );
  const valid = fs.readFileSync(identityFile, "utf8");
  fs.writeFileSync(
    file,
    JSON.stringify({ ...downloaded, origin: "https://untrusted.example" }),
  );
  cli(["auth", "import-file", file], true);
  assert.equal(fs.readFileSync(identityFile, "utf8"), valid);
  checks.push(
    "Wrong-origin credential is rejected without changing local identity",
  );
  fs.writeFileSync(
    file,
    JSON.stringify({ ...downloaded, userId: "someone-else" }),
  );
  const wrong = cli(["auth", "import-file", file], true);
  assert(!wrong.includes(downloaded.token));
  assert.equal(fs.readFileSync(identityFile, "utf8"), valid);
  checks.push(
    "Declared identity cannot override the server-authenticated user",
  );
  const other = await api("/auth/guest", {}, undefined, 201);
  fs.writeFileSync(file, JSON.stringify({ ...other, origin: base }));
  cli(["auth", "import-file", file], true);
  assert.equal(fs.readFileSync(identityFile, "utf8"), valid);
  checks.push("Import does not silently overwrite a different saved identity");
  await api("/auth/revoke", {}, user.token);
  await api("/auth/identity", undefined, downloaded.token, 401);
  fs.writeFileSync(file, JSON.stringify(downloaded));
  cli(["auth", "import-file", file], true);
  assert.equal(fs.readFileSync(identityFile, "utf8"), valid);
  checks.push(
    "Revocation invalidates exported sessions and revoked imports preserve the existing local file",
  );
  fs.writeFileSync(
    "reports/identity-results.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment: "Isolated local Worker and CLI; no real email delivery",
        passed: checks.length,
        checks,
      },
      null,
      2,
    ) + "\n",
  );
  checks.forEach((x) => console.log("PASS", x));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
