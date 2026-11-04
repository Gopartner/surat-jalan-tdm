const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const js = fs.readFileSync("assets/js/app.js", "utf8");
const ids = [...js.matchAll(/el\("([a-z0-9-]+)"\)/g)].map((m) => m[1]);
const missing = [...new Set(ids)].filter((id) => !html.includes('id="' + id + '"'));
console.log("MISSING IDS:", missing.join(", ") || "none");
const dupes = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const seen = new Set(), dup = [];
for (const id of dupes) { if (seen.has(id)) dup.push(id); seen.add(id); }
console.log("DUPLICATE IDS:", dup.join(", ") || "none");
