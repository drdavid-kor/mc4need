# Install Mc4Need CLI + Skill

Mc4Need serves mainland China. Prices are in CNY; meal times and deadlines are displayed in China time (UTC+8). English is an interface language, not an extension of delivery coverage.

The CLI talks only to Mc4Need. Your AI uses your own connected McDonald's MCP for food ordering. The platform never receives a McDonald's Token. Read-only discovery and scheduled following do not require McDonald's login.

## macOS / Linux

Use an AI client that can run local terminal commands:

```sh
curl -fsSL https://mc4need.david-widgets.com/install.sh -o /tmp/mc4need-install.sh
sh /tmp/mc4need-install.sh codex
# Claude Code: sh /tmp/mc4need-install.sh claude
~/.local/bin/mc4need doctor
```

You can inspect the script before execution. It checks for Node.js 22+. If necessary, it downloads an isolated runtime from nodejs.org and verifies the official SHA-256. It also checks Mc4Need package hashes. It needs no sudo and does not replace another application's Node.

## Windows PowerShell

The script is provided; **installation on a real Windows device has not been verified**.

```powershell
Invoke-WebRequest https://mc4need.david-widgets.com/install.ps1 -OutFile "$env:TEMP\mc4need-install.ps1"
& "$env:TEMP\mc4need-install.ps1" -Client codex
& "$env:LOCALAPPDATA\Mc4Need\bin\mc4need.cmd" doctor
```

For Claude Code use `-Client claude`. Follow your environment's execution-policy requirements; do not lower the global policy automatically.

## Load the Skill

- Codex: `~/.codex/skills/mc4need/SKILL.md`.
- Claude Code: `~/.claude/skills/mc4need/SKILL.md`.
- Explicitly read the Skill if the current conversation does not discover it; reload the client when required. File installation alone does not prove discovery.
- For publishing or sponsoring, reuse your existing McDonald's MCP. If absent, follow the [official guide](https://github.com/M-China/mcd-mcp-server) in client settings. Never paste Tokens into chat or the Mc4Need website.
- WorkBuddy discovery and actual Claude workflows have not been verified. A basic chat without terminal/Skill/MCP execution cannot complete ordering.

## Follow needs

Use the home page's **Follow meal needs** button to copy instructions for your AI. It will ask about locations, categories, budget and schedule. Persistent tasks and notifications depend on your AI client's capabilities. Copying the prompt alone creates no task. Following is read-only, requires no McDonald's account and never places an order. If scheduling is unsupported, the AI must explain that and offer manual checks.

## First participation

```sh
mc4need auth guest
mc4need needs list
mc4need auth browser
```

`auth guest` creates a reusable local platform identity without requiring email. `auth browser` returns a five-minute, one-use private website sign-in link. Do not share it. Your platform token lives in `~/.mc4need/identity.json`; never print its contents into chat or commit it.

After creating a draft with your AI, open **My space → Needs I started → Manage cover** to optionally upload a JPG, PNG or WebP file up to 10 MB. The browser compresses it and removes photo metadata. Confirm that you have permission to make the image public. Draft covers are private; published covers are visible with the need. Removing an upload restores the category illustration.

## Updates, backups and removal

Run the installer again to upgrade. Program files and identity are separate, so upgrades preserve the identity. Back up with `mc4need identity export-file /absolute/private/backup.json`. Restore using `mc4need auth import-file /absolute/private/backup.json`. Imports verify the origin and authenticated identity; they refuse to overwrite a different existing identity. Use a separate `MC4NEED_HOME` if needed.

Uninstall:

```sh
node ~/.local/share/mc4need/current/scripts/uninstall.mjs
```

If there is no system Node, use `~/.local/share/mc4need/runtime/bin/node`. On Windows run `%LOCALAPPDATA%\Mc4Need\current\scripts\uninstall.mjs` with the installed Node. Uninstalling preserves your identity by default. `mc4need auth revoke` revokes all server sessions. Losing the last credential without a recoverable linked email loses access.

A signed-in website user can download a private credential in My space and import it on another device. It grants platform access for 90 days and contains no McDonald's Token. Keep it private; do not paste the file contents into AI chat. This does not replace email recovery if all access has already been lost. Email is currently disabled.

See the [verification record](https://github.com/drdavid-kor/mc4need/blob/main/docs/verification.md) for actual test coverage. `doctor` checks the CLI and platform, not delivery, payment or receipt. Demo examples are fictional. Real ordering still requires the user's explicit confirmation of the exact order and total.
