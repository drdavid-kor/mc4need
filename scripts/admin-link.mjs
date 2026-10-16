import fs from "node:fs/promises";
const config = JSON.parse(
  await fs.readFile(
    new URL("../.private/admin-identity.json", import.meta.url),
    "utf8",
  ),
);
const r = await fetch("https://mc4need.david-widgets.com/api/auth/link", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const data = await r.json();
if (!r.ok) throw new Error(data.error);
console.log("Private, one-use, expires in 5 minutes:");
console.log(data.url);
