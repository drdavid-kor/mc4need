import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = process.argv[2] || "codex";
const target =
  client === "codex"
    ? path.join(
        process.env.MC4NEED_INSTALL_HOME || os.homedir(),
        ".codex",
        "skills",
        "mc4need",
      )
    : client === "claude"
      ? path.join(
          process.env.MC4NEED_INSTALL_HOME || os.homedir(),
          ".claude",
          "skills",
          "mc4need",
        )
      : null;
if (!target)
  throw new Error(
    "Supported registration targets: codex, claude. WorkBuddy requires separate verification.",
  );
await fs.mkdir(path.dirname(target), { recursive: true });
try {
  await fs.access(target);
  const backup = path.join(
    process.env.MC4NEED_INSTALL_HOME || os.homedir(),
    ".mc4need",
    "skill-backups",
    `${client}-${Date.now()}`,
  );
  await fs.mkdir(path.dirname(backup), { recursive: true, mode: 0o700 });
  await fs.cp(target, backup, { recursive: true });
  console.log(`Previous Mc4Need skill preserved at ${backup}`);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await fs.cp(path.join(root, "skill"), target, { recursive: true });
await fs.writeFile(
  path.join(target, ".mc4need-managed"),
  "Installed by Mc4Need installer\n",
);
console.log(
  `Skill files installed: ${target}\nReload your client or explicitly read SKILL.md in this conversation. Existing McDonald’s MCP configuration was not changed.`,
);
