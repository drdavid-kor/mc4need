import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const version = JSON.parse(fs.readFileSync("package.json")).version;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mc4need-bundle-"));
const folder = path.join(temp, "mc4need");
fs.mkdirSync(folder);
for (const name of ["cli", "skill"])
  fs.cpSync(name, path.join(folder, name), { recursive: true });
fs.mkdirSync(path.join(folder, "scripts"));
for (const name of ["register.mjs", "uninstall.mjs"])
  fs.copyFileSync(
    path.join("scripts", name),
    path.join(folder, "scripts", name),
  );
fs.copyFileSync("public/install-guide.md", path.join(folder, "INSTALL.md"));
fs.copyFileSync("public/install-guide.en.md", path.join(folder, "INSTALL.en.md"));
for (const name of ["LICENSE"])
  if (fs.existsSync(name)) fs.copyFileSync(name, path.join(folder, name));
fs.writeFileSync(
  path.join(folder, "README.md"),
  "# Mc4Need CLI + Skill\n\nSponsor a meal. Be part of it.\n\nSee INSTALL.md for installation and identity backup. Read skill/SKILL.md and skill/references/workflows.md before operating.\n\nSource and verified limitations: https://github.com/drdavid-kor/mc4need\n",
);
fs.mkdirSync("public/releases", { recursive: true });
const names = [`mc4need-${version}.tar.gz`, `mc4need-${version}.zip`];
execFileSync(
  "tar",
  ["-czf", path.resolve("public/releases", names[0]), "-C", temp, "mc4need"],
  { env: { ...process.env, COPYFILE_DISABLE: "1" } },
);
execFileSync(
  "zip",
  ["-qr", path.resolve("public/releases", names[1]), "mc4need"],
  { cwd: temp },
);
const files = {};
for (const n of names)
  files[n] = {
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join("public/releases", n)))
      .digest("hex"),
  };
fs.writeFileSync(
  "public/releases/manifest.json",
  JSON.stringify({ version, files }, null, 2) + "\n",
);
const currentSums =
  Object.entries(files)
    .map(([n, v]) => `${v.sha256}  ${n}`)
    .join("\n") + "\n";
fs.writeFileSync(`public/releases/SHA256SUMS-${version}`, currentSums);
fs.writeFileSync(
  `public/releases/manifest-${version}.json`,
  JSON.stringify({ version, files }, null, 2) + "\n",
);
const allPackages = fs
  .readdirSync("public/releases")
  .filter((n) => /^mc4need-[\d.]+\.(tar\.gz|zip)$/.test(n))
  .sort();
fs.writeFileSync(
  "public/releases/SHA256SUMS",
  allPackages
    .map(
      (n) =>
        `${crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join("public/releases", n)))
          .digest("hex")}  ${n}`,
    )
    .join("\n") + "\n",
);
fs.mkdirSync("public/skill/references", { recursive: true });
fs.cpSync("skill", "public/skill", { recursive: true });
fs.rmSync(temp, { recursive: true });
console.log({ version, files });
