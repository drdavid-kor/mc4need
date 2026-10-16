import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
for (const p of [
  path.join(
    process.env.MC4NEED_INSTALL_HOME || os.homedir(),
    ".codex/skills/mc4need",
  ),
  path.join(
    process.env.MC4NEED_INSTALL_HOME || os.homedir(),
    ".claude/skills/mc4need",
  ),
  path.join(
    process.env.MC4NEED_INSTALL_HOME || os.homedir(),
    ".local/bin/mc4need",
  ),
]) {
  if (p.endsWith("/skills/mc4need")) {
    try {
      await fs.access(path.join(p, ".mc4need-managed"));
    } catch {
      continue;
    }
  }
  await fs.rm(p, { recursive: true, force: true });
}
const root =
  process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA, "Mc4Need")
    : path.join(
        process.env.MC4NEED_INSTALL_HOME || os.homedir(),
        ".local/share/mc4need",
      );
await fs.rm(root, { recursive: true, force: true });
console.log(
  "Mc4Need program and skill files removed. Platform identity in ~/.mc4need retained. Delete it only after backing up or revoking sessions if desired.",
);
