/* ==========================================================================
   check-schema.js — report content that uses a deprecated key spelling, an
   unknown add_* element, or a JSON file that will not parse.

     node tools/check-schema.js            report, exit 0
     node tools/check-schema.js --strict   exit 1 when anything is reported

   Canonical keys live in SCHEMA.md. Only unambiguous renames are reported
   here: `title`/`label` are canonical in page/section/link contexts, so they
   are not flagged globally.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE = path.join(ROOT, "data", "site.json");
const SECTION_DIR = path.join(ROOT, "data", "sections");
const PAGE_DIR = path.join(ROOT, "data", "pages");
const strict = process.argv.includes("--strict");

/* Deprecated spelling → canonical. */
const DEPRECATED = new Map([
  ["alignment", "align"],
  ["column_position", "column"],
  ["alt", "image_alt"],
  ["alt_text", "image_alt"],
  ["url", "link"],
  ["href", "link"],
  ["doi", "link"]
]);

/* Keys that start with add_ but are data, not element names. */
const DATA_KEYS = new Set([
  "add_content_to_page",
  "add_items_to_list",
  "add_information_to_expandable_item",
  "add_embedded_media_to_row",
  "add_as_inline_equation"
]);

/* Elements the engine knows, read from the registry files. */
const renderDir = path.join(ROOT, "js", "render");
const sources = [path.join(ROOT, "js", "elements.js")];
if (fs.existsSync(renderDir)) {
  for (const entry of fs.readdirSync(renderDir)) {
    if (entry.endsWith(".js")) sources.push(path.join(renderDir, entry));
  }
}
const source = sources.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const known = new Set(DATA_KEYS);
source.replace(/(?:RENDERERS|ALIASES)\.(add_[a-z0-9_]+)\s*=/g, (m, key) => {
  known.add(key);
  return m;
});

const files = [];
if (fs.existsSync(SITE)) files.push(SITE);
for (const dir of [SECTION_DIR, PAGE_DIR]) {
  const walk = (folder) => {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".json")) files.push(full);
    }
  };
  walk(dir);
}

const aliases = [];
const unknown = [];
const invalid = [];
let objects = 0;

function walk(value, where, trail) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, where, trail + "[" + index + "]"));
    return;
  }
  objects += 1;
  for (const key of Object.keys(value)) {
    if (DEPRECATED.has(key)) {
      aliases.push(where + trail + "." + key + " → " + DEPRECATED.get(key));
    }
    if (key.startsWith("add_") && !known.has(key)) {
      unknown.push(where + trail + "." + key);
    }
    walk(value[key], where, trail + "." + key);
  }
}

for (const file of files) {
  const where = path.relative(ROOT, file).replace(/\\/g, "/");
  let text = fs.readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    invalid.push(where + " — " + error.message);
    continue;
  }
  walk(data, where, "");
}

console.log("SCHEMA — " + files.length + " files · " + objects + " objects");
console.log("");

for (const item of invalid) console.log("  fail  " + item);
for (const item of aliases) console.log("  alias " + item);
for (const item of unknown) console.log("  unknown " + item);

if (!invalid.length && !aliases.length && !unknown.length) {
  console.log("  ok  canonical keys, known elements");
}

const problems = invalid.length + aliases.length + unknown.length;
console.log("");
console.log("  " + problems + " note" + (problems === 1 ? "" : "s"));
if (strict && problems) process.exit(1);
