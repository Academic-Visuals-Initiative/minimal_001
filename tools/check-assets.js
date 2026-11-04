/* ==========================================================================
   check-assets.js — how heavy is the site, and which files are carrying it.

     node tools/check-assets.js                          report
     node tools/check-assets.js --strict --max-total=10   fail above 10 MB
     node tools/check-assets.js --strict --max-file=2     fail above 2 MB/file

   --max-total and --max-file are in MB. --strict turns the report into a
   test; without a budget it has nothing to enforce and exits 0.

   The bundled code is measured separately by tools/build.js, which prints
   gzip and brotli transfer sizes.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const strict = args.includes("--strict");

function budget(name) {
  const match = args.find((arg) => arg.startsWith("--" + name + "="));
  if (!match) return null;
  const value = Number(match.split("=")[1]);
  return Number.isFinite(value) && value > 0 ? value * 1024 * 1024 : null;
}

const maxTotal = budget("max-total");
const maxFile = budget("max-file");

const FOLDERS = ["assets", "data", "pages", "css", "js"];
const files = [];

function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push({ path: path.relative(ROOT, full).replace(/\\/g, "/"), size: fs.statSync(full).size });
  }
}

for (const folder of FOLDERS) {
  const full = path.join(ROOT, folder);
  if (fs.existsSync(full)) walk(full);
}

/* Group by the folder people actually think in: assets/images, assets/3d,
   data, pages, and so on. */
function groupOf(file) {
  const parts = file.path.split("/");
  if (parts[0] === "assets" && parts.length > 2) return parts[0] + "/" + parts[1];
  return parts[0];
}

const groups = new Map();
for (const file of files) {
  const id = groupOf(file);
  const current = groups.get(id) || { files: 0, bytes: 0 };
  current.files += 1;
  current.bytes += file.size;
  groups.set(id, current);
}

const total = files.reduce((sum, file) => sum + file.size, 0);
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

console.log("ASSETS — " + files.length + " files · " + mb(total) + " MB");
console.log("");

const rows = [...groups.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
const width = Math.max(...rows.map(([name]) => name.length), 6);
for (const [name, data] of rows) {
  console.log("  " + name.padEnd(width) + "  " + String(data.files).padStart(3) + " files  " + mb(data.bytes).padStart(6) + " MB");
}

const largest = files.sort((a, b) => b.size - a.size).slice(0, 5);
console.log("");
console.log("  largest");
for (const file of largest) {
  console.log("    " + mb(file.size).padStart(6) + " MB  " + file.path);
}

const big = files.filter((file) => file.size > 1024 * 1024);
if (big.length) {
  console.log("");
  console.log("  " + big.length + " file" + (big.length === 1 ? "" : "s") + " over 1 MB — compress, resize or replace before a real deploy");
}

const overFile = maxFile ? files.filter((file) => file.size > maxFile) : [];
const overTotal = maxTotal && total > maxTotal;

if (!strict || (!maxFile && !maxTotal)) {
  console.log("");
  console.log("  ok  report only" + (strict ? " (pass --max-total=MB or --max-file=MB to enforce)" : ""));
  process.exit(0);
}

console.log("");
let failed = false;
if (overTotal) {
  console.log("  fail  total " + mb(total) + " MB is over the " + mb(maxTotal) + " MB budget");
  failed = true;
}
for (const file of overFile) {
  console.log("  fail  " + file.path + " is " + mb(file.size) + " MB, over " + mb(maxFile) + " MB");
  failed = true;
}
if (!failed) console.log("  ok  within budget");

process.exit(failed ? 1 : 0);
