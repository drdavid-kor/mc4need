import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc4need-integrity-"));
const server = createServer((req, res) => {
  if (req.url.endsWith("SHA256SUMS"))
    res.end(fs.readFileSync("public/releases/SHA256SUMS"));
  else res.end("tampered package");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const code = await new Promise((resolve) => {
  const p = spawn("sh", ["public/install.sh", "codex"], {
    env: {
      ...process.env,
      MC4NEED_INSTALL_HOME: dir,
      MC4NEED_DOWNLOAD_BASE: `http://127.0.0.1:${server.address().port}`,
    },
    stdio: "pipe",
  });
  p.on("close", resolve);
});
server.close();
assert.notEqual(code, 0);
assert(!fs.existsSync(path.join(dir, ".local/bin/mc4need")));
fs.rmSync(dir, { recursive: true, force: true });
console.log("PASS tampered release rejected before installation");
