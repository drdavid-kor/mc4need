#!/bin/sh
set -eu
CLIENT="${1:-codex}"
case "$CLIENT" in codex|claude) ;; *) printf '%s\n' 'Usage: install.sh codex|claude'; exit 1;; esac
VERSION=0.1.1
BASE="${MC4NEED_DOWNLOAD_BASE:-https://mc4need.david-widgets.com}"
INSTALL_HOME="${MC4NEED_INSTALL_HOME:-$HOME}"
ROOT="$INSTALL_HOME/.local/share/mc4need"
BIN="$INSTALL_HOME/.local/bin"
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT HUP INT TERM
command -v curl >/dev/null 2>&1 || { printf '%s\n' 'curl is required. Install curl and run again.'; exit 1; }
sha256_file() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d ' ' -f 1; elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d ' ' -f 1; else printf '%s\n' 'SHA-256 utility missing' >&2; exit 1; fi; }
NODE="$(command -v node || true)"
if [ "${MC4NEED_FORCE_RUNTIME:-0}" = 1 ] || [ -z "$NODE" ] || ! "$NODE" -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' 2>/dev/null; then
  case "$(uname -s)" in Darwin) PLATFORM=darwin;; Linux) PLATFORM=linux;; *) printf '%s\n' 'Use install.ps1 for Windows'; exit 1;; esac
  case "$(uname -m)" in arm64|aarch64) ARCH=arm64;; x86_64|amd64) ARCH=x64;; *) printf '%s\n' 'Unsupported CPU architecture'; exit 1;; esac
  NODE_VERSION=v24.16.0
  NODE_ARCHIVE="node-$NODE_VERSION-$PLATFORM-$ARCH.tar.gz"
  curl -fLsS --proto '=https' "https://nodejs.org/dist/$NODE_VERSION/$NODE_ARCHIVE" -o "$TEMP/node.tar.gz"
  curl -fLsS --proto '=https' "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$TEMP/node-sha.txt"
  EXPECTED="$(awk -v f="$NODE_ARCHIVE" '$2==f {print $1}' "$TEMP/node-sha.txt")"
  [ -n "$EXPECTED" ] && [ "$(sha256_file "$TEMP/node.tar.gz")" = "$EXPECTED" ] || { printf '%s\n' 'Node checksum mismatch'; exit 1; }
  mkdir -p "$ROOT/runtime"
  tar -xzf "$TEMP/node.tar.gz" -C "$ROOT/runtime" --strip-components=1
  NODE="$ROOT/runtime/bin/node"
fi
curl -fLsS "$BASE/releases/mc4need-$VERSION.tar.gz" -o "$TEMP/package.tar.gz"
curl -fLsS "$BASE/releases/SHA256SUMS-$VERSION" -o "$TEMP/SHA256SUMS"
EXPECTED="$(awk -v f="mc4need-$VERSION.tar.gz" '$2==f {print $1}' "$TEMP/SHA256SUMS")"
[ -n "$EXPECTED" ] && [ "$(sha256_file "$TEMP/package.tar.gz")" = "$EXPECTED" ] || { printf '%s\n' 'Mc4Need checksum mismatch'; exit 1; }
tar -xzf "$TEMP/package.tar.gz" -C "$TEMP"
mkdir -p "$ROOT/versions" "$BIN"
if [ -d "$ROOT/versions/$VERSION" ]; then mv "$ROOT/versions/$VERSION" "$TEMP/old-version"; fi
mv "$TEMP/mc4need" "$ROOT/versions/$VERSION"
ln -sfn "$ROOT/versions/$VERSION" "$ROOT/current"
"$NODE" "$ROOT/current/scripts/register.mjs" "$CLIENT"
# Wrapper paths are single-quote escaped; HOME paths containing spaces are supported.
"$NODE" --input-type=module - "$NODE" "$ROOT/current/cli/mc4need.mjs" "$BIN/mc4need" <<'NODE'
import fs from 'node:fs';const [node,entry,target]=process.argv.slice(2);const q=s=>"'"+s.replaceAll("'","'\\''")+"'";fs.writeFileSync(target,`#!/bin/sh\nexec ${q(node)} ${q(entry)} "$@"\n`,{mode:0o755});fs.chmodSync(target,0o755);
NODE
"$BIN/mc4need" --version
printf '\nInstalled. Run: %s doctor\n' "$BIN/mc4need"
printf '%s\n' 'If mc4need is not on PATH, use the full path above or add ~/.local/bin to PATH.' 'Reload the AI client or read the installed SKILL.md. McDonald’s MCP must be connected in your own client settings.'
