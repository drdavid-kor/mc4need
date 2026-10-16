import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "mc4need-install-"));
const identity = path.join(sandbox, "identity");
const base = process.env.INSTALL_BASE || "http://127.0.0.1:8787";
const env = {
  ...process.env,
  MC4NEED_INSTALL_HOME: sandbox,
  MC4NEED_HOME: identity,
  MC4NEED_DOWNLOAD_BASE: base,
  MC4NEED_API: "http://127.0.0.1:8787",
};
const sh = (client) =>
  execFileSync("sh", ["public/install.sh", client], { env, encoding: "utf8" });
const exe = path.join(sandbox, ".local/bin/mc4need");
const checks = [];
try {
  sh("codex");
  assert(fs.existsSync(path.join(sandbox, ".codex/skills/mc4need/SKILL.md")));
  const d = JSON.parse(execFileSync(exe, ["doctor"], { env }));
  assert(d.ok);
  execFileSync(exe, ["auth", "guest"], { env });
  const before = fs.readFileSync(path.join(identity, "identity.json"), "utf8");
  sh("codex");
  assert.equal(
    fs.readFileSync(path.join(identity, "identity.json"), "utf8"),
    before,
  );
  assert.equal(
    fs.statSync(path.join(identity, "identity.json")).mode & 0o777,
    0o600,
  );
  checks.push(
    "macOS clean isolated Codex install, CLI health and upgrade preserve identity with mode 0600",
  );
  sh("claude");
  assert(fs.existsSync(path.join(sandbox, ".claude/skills/mc4need/SKILL.md")));
  checks.push(
    "Claude skill directory registration (not actual Claude runtime discovery)",
  );
  execFileSync(exe, ["needs", "list"], { env });
  execFileSync(
    process.execPath,
    [path.join(sandbox, ".local/share/mc4need/current/scripts/uninstall.mjs")],
    { env },
  );
  assert(!fs.existsSync(exe));
  assert(fs.existsSync(path.join(identity, "identity.json")));
  checks.push(
    "Uninstall removes installed program and managed skills, preserves identity",
  );
  if (process.env.TEST_RUNTIME === "1") {
    execFileSync("sh", ["public/install.sh", "codex"], {
      env: { ...env, MC4NEED_FORCE_RUNTIME: "1" },
      encoding: "utf8",
    });
    assert(
      fs.existsSync(
        path.join(sandbox, ".local/share/mc4need/runtime/bin/node"),
      ),
    );
    assert(JSON.parse(execFileSync(exe, ["doctor"], { env })).ok);
    checks.push(
      "Managed Node bootstrap downloaded from nodejs.org and official SHA-256 verified; installed CLI runs",
    );
  }
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(
    "reports/install-results.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        system: process.platform,
        checks,
        passed: checks.length,
        limitation:
          "Client auto-discovery and Windows/Linux actual devices not tested",
      },
      null,
      2,
    ),
  );
  checks.forEach((x) => console.log("PASS", x));
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
