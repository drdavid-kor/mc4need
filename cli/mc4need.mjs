#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const VERSION = "0.2.0";
const dir = process.env.MC4NEED_HOME || path.join(os.homedir(), ".mc4need");
const configFile = path.join(dir, "identity.json");
const base = process.env.MC4NEED_API || "https://mc4need.david-widgets.com";
const u = new URL(base);
if (
  u.origin !== "https://mc4need.david-widgets.com" &&
  !["127.0.0.1", "localhost"].includes(u.hostname)
)
  throw new Error("Refusing to send platform credentials to an untrusted host");
let config = {};
try {
  config = JSON.parse(await fs.readFile(configFile, "utf8"));
} catch {}
if (config.origin && config.origin !== u.origin)
  throw new Error(
    "This identity belongs to another API origin; use a separate MC4NEED_HOME.",
  );
const out = (x) => process.stdout.write(JSON.stringify(x, null, 2) + "\n");
async function request(endpoint, method = "GET", body, auth = true) {
  const r = await fetch(base + "/api" + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && config.token
        ? { Authorization: "Bearer " + config.token }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(`HTTP ${r.status}: non-JSON response`);
  }
  if (!r.ok)
    throw new Error(
      `HTTP ${r.status}: ${data.error || "request failed"}${data.details ? " " + JSON.stringify(data.details) : ""}`,
    );
  return data;
}
async function save(data) {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = path.join(dir, `.identity-${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, JSON.stringify(data), { mode: 0o600, flag: "wx" });
    await fs.rename(temp, configFile);
    await fs.chmod(configFile, 0o600);
  } finally {
    await fs.rm(temp, { force: true });
  }
  config = data;
}
async function importIdentity(file) {
  if (!file)
    throw new Error(
      "Provide the path to your private credential file. Never paste its contents into chat.",
    );
  const info = await fs.stat(file);
  if (!info.isFile() || info.size > 8192)
    throw new Error("Invalid credential file");
  let candidate;
  try {
    candidate = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    throw new Error("Invalid credential file");
  }
  if (
    !candidate ||
    candidate.origin !== u.origin ||
    typeof candidate.token !== "string" ||
    !/^[a-f0-9]{64}$/.test(candidate.token) ||
    typeof candidate.userId !== "string"
  )
    throw new Error(
      "Credential does not belong to this platform origin or has an invalid format",
    );
  const response = await fetch(base + "/api/auth/identity", {
    headers: { Authorization: "Bearer " + candidate.token },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new Error(
      "Credential is expired, revoked or unavailable. No local identity was changed.",
    );
  const verified = await response.json();
  if (verified.user?.id !== candidate.userId)
    throw new Error(
      "Credential identity does not match the file. No local identity was changed.",
    );
  if (config.token && config.userId !== candidate.userId)
    throw new Error(
      "Another platform identity is already saved. Use a separate MC4NEED_HOME to avoid losing it.",
    );
  await save({
    token: candidate.token,
    userId: candidate.userId,
    origin: u.origin,
    createdAt: candidate.createdAt ?? Date.now(),
  });
  return {
    ok: true,
    userId: candidate.userId,
    message:
      "Identity restored. Keep the credential file private or remove the temporary download after verifying access.",
  };
}
async function login() {
  if (config.token) {
    await request("/me");
    return { ok: true, existing: true, userId: config.userId };
  }
  const r = await request("/auth/guest", "POST", {}, false);
  await save({
    token: r.token,
    userId: r.userId,
    origin: u.origin,
    createdAt: Date.now(),
  });
  return { ok: true, userId: r.userId, warning: r.warning };
}
async function input() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += chunk;
    if (raw.length > 20000) throw new Error("Input exceeds 20 KB");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      "Provide a JSON object on stdin. Do not pass credentials on the command line.",
    );
  }
}
const args = process.argv.slice(2);
const [group, action, arg] = args;
const help = {
  version: VERSION,
  usage: "mc4need <group> <action> [id]  (JSON bodies from stdin)",
  commands: {
    doctor:
      "Check local runtime, platform and skill installation; does not prove MCP connection.",
    auth: [
      "guest",
      "browser",
      "me",
      "email (stdin: {email})",
      "recover (stdin: {email})",
      "import-file <private credential path>",
      "logout",
      "revoke",
    ],
    needs: [
      "list",
      "show <id>",
      "private <id>",
      "create (stdin: need fields)",
      "update <id> (stdin)",
      "publish <id> (stdin: {version,confirmed:true})",
      "next <id> (stdin: {confirmed:true})",
      "close <id> (stdin: {confirmed:true})",
      "claim <id> (stdin: {version,displayName,contact?})",
      "receipt <id> (stdin: {received,feedback?,publicConsent,issue?})",
    ],
    orders: [
      "show <id>",
      "quote <id> (stdin: quote)",
      "creating <id> (stdin: {revision,confirmed:true})",
      "sync <id> (stdin: minimal observation)",
      "uncertain <id>",
      "release <id>",
      "unavailable <id> (stdin: {reason})",
      "cancel <id> (stdin: {reason})",
      "message <id> (stdin: {body})",
    ],
    notifications: ["list", "read"],
    profile: ["preferences (stdin: {emailNotifications})"],
    identity:
      "export-file <absolute path> (sensitive backup, never paste into chat)",
    uninstall:
      "Remove installed program/skills via scripts/uninstall.mjs; identity retained by default",
  },
  safety:
    "CLI calls only Mc4Need API. Your AI calls your connected McDonald’s MCP. Never upload McDonald’s tokens or complete order objects.",
};
try {
  if (!group || ["help", "--help", "-h"].includes(group)) {
    out(help);
  } else if (group === "--version") {
    out({ version: VERSION });
  } else if (group === "doctor") {
    const health = await request("/health", "GET", undefined, false);
    out({
      ok: true,
      version: VERSION,
      node: process.version,
      platform: process.platform,
      api: u.origin,
      identityPresent: !!config.token,
      health,
      mcp: "Requires AI client to inspect its connected MCP tools; this check does not access a McDonald’s account.",
    });
  } else if (group === "auth") {
    if (action === "import-file") out(await importIdentity(arg));
    else if (action === "guest") out(await login());
    else if (action === "browser") {
      await login();
      out(await request("/auth/link", "POST", {}));
    } else if (action === "me") {
      const r = await request("/me");
      out({ user: r.user });
    } else if (action === "email")
      out(await request("/auth/email", "POST", await input()));
    else if (action === "recover")
      out(await request("/auth/recover", "POST", await input(), false));
    else if (action === "logout" || action === "revoke") {
      out(await request("/auth/" + action, "POST", {}));
      await fs.rm(configFile, { force: true });
    } else throw new Error("Unknown auth command");
  } else if (group === "needs") {
    const publicPaths = {
      list: "/needs",
      show: "/needs/" + encodeURIComponent(arg || ""),
    };
    if (publicPaths[action])
      out(await request(publicPaths[action], "GET", undefined, false));
    else {
      await login();
      const routes = {
        private: ["GET", `/private/needs/${arg}`],
        create: ["POST", "/needs"],
        update: ["PUT", `/needs/${arg}`],
        publish: ["POST", `/needs/${arg}/publish`],
        close: ["POST", `/needs/${arg}/close`],
        next: ["POST", `/needs/${arg}/next`],
        claim: ["POST", `/needs/${arg}/claim`],
        receipt: ["POST", `/needs/${arg}/receipt`],
      };
      const r = routes[action];
      if (!r) throw new Error("Unknown needs command");
      if (action !== "create" && !arg) throw new Error("Need id required");
      out(
        await request(r[1], r[0], r[0] === "GET" ? undefined : await input()),
      );
    }
  } else if (group === "orders") {
    if (!arg) throw new Error("Order attempt id required");
    const route = action === "message" ? "messages" : action;
    const allowed = [
      "show",
      "quote",
      "creating",
      "sync",
      "uncertain",
      "release",
      "unavailable",
      "cancel",
      "message",
    ];
    if (!allowed.includes(action)) throw new Error("Unknown orders command");
    out(
      await request(
        `/attempts/${encodeURIComponent(arg)}${action === "show" ? "" : "/" + route}`,
        action === "show" ? "GET" : "POST",
        action === "show"
          ? undefined
          : ["release", "uncertain"].includes(action)
            ? {}
            : await input(),
      ),
    );
  } else if (group === "notifications") {
    if (action === "list") {
      const r = await request("/me");
      out(r.notifications);
    } else if (action === "read")
      out(await request("/notifications/read", "POST", {}));
    else throw new Error("Unknown notification command");
  } else if (group === "profile" && action === "preferences") {
    out(await request("/preferences", "POST", await input()));
  } else if (group === "identity" && action === "export-file") {
    if (!arg || !path.isAbsolute(arg))
      throw new Error("Absolute backup path required");
    if (!config.token) throw new Error("No identity");
    await fs.writeFile(arg, JSON.stringify(config), {
      mode: 0o600,
      flag: "wx",
    });
    out({
      ok: true,
      path: arg,
      warning:
        "Private platform credential backup. Do not share, commit or paste into AI chat.",
    });
  } else throw new Error("Unknown command. Run mc4need help.");
} catch (e) {
  process.stderr.write(
    JSON.stringify({
      error: e.message,
      warning:
        "On a failed creating/sync request, inspect the existing record before retrying. Never repeat a McDonald’s create-order blindly.",
    }) + "\n",
  );
  process.exitCode = 1;
}
