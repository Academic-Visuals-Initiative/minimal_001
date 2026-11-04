#!/usr/bin/env node
/* ------------------------------------------------------------------
   check-content.js — the content contract.

   Reads data/site.json and every section it lists, then checks:

     structure   required fields, section files, ids
     elements    every add_* key exists in js/elements.js
     images      every image_path resolves on disk
     links       every @link points at a section, @cv, @email or @top
     tables      every row has as many cells as column_headers
     icons       every footer icon file exists

   Usage:
     node tools/check-content.js            report, exit 0
     node tools/check-content.js --strict   exit 1 on any problem

   No dependencies. Run from the site root (the folder holding data/).
------------------------------------------------------------------ */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const SITE_FILE = path.join(DATA, "site.json");
const SECTION_DIR = path.join(DATA, "sections");
const ELEMENTS_FILE = path.join(ROOT, "js", "elements.js");
const ICON_DIR = path.join(ROOT, "assets", "icons", "social");

const strict = process.argv.slice(2).includes("--strict");
const problems = [];
const warnings = [];
const counts = { sections: 0, elements: 0, images: 0, links: 0, tables: 0 };

function problem(where, message) { problems.push({ where, message }); }
function warn(where, message) { warnings.push({ where, message }); }

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    problem(path.relative(ROOT, file), "cannot be read as JSON — " + error.message);
    return null;
  }
}

/* --- the element registry, read from the engine itself ---------------- */
const known = new Set(["add_content_to_page"]);
const aliases = new Set();
try {
  const source = fs.readFileSync(ELEMENTS_FILE, "utf8");
  for (const match of source.matchAll(/RENDERERS\.(add_[a-z0-9_]+)\s*=/g)) known.add(match[1]);
  for (const match of source.matchAll(/ALIASES\.(add_[a-z0-9_]+)\s*=/g)) aliases.add(match[1]);
} catch (error) {
  problem("js/elements.js", "could not be read — " + error.message);
}

/* --- helpers ---------------------------------------------------------- */
function isObject(value) { return value != null && typeof value === "object" && !Array.isArray(value); }

function imagePath(value) {
  const src = String(value || "").trim();
  if (!src) return "";
  if (/^(https?:)?\/\//.test(src) || src.startsWith("data:") || src.startsWith("/")) return "";
  if (src.includes("/")) return src;
  return "assets/images/" + src;
}

function imageExists(value) {
  const rel = imagePath(value);
  return !rel || fs.existsSync(path.join(ROOT, rel.split("?")[0]));
}

function cells(row) {
  return Array.isArray(row)
    ? row.map((cell) => String(cell == null ? "" : cell).trim())
    : String(row == null ? "" : row).split(",").map((cell) => cell.trim());
}

/* --- sections --------------------------------------------------------- */
function walkSection(value, file) {
  const where = path.relative(ROOT, file).replace(/\\/g, "/");

  (function visit(node, elementLevel) {
    if (Array.isArray(node)) return node.forEach((child) => visit(child, elementLevel));
    if (!isObject(node)) return;

    for (const key of Object.keys(node)) {
      const child = node[key];

      if (elementLevel && /^add_/.test(key)) {
        counts.elements++;
        if (!known.has(key) && !aliases.has(key)) problem(where, "unknown element `" + key + "`");
      }

      if (key === "image_path" || key === "image" || key === "photo") {
        if (typeof child === "string" && child) {
          counts.images++;
          if (!imageExists(child)) problem(where, "image not found: " + child);
        }
      }

      if (key === "link" || key === "url" || key === "href" || key === "profile_link") {
        if (typeof child === "string" && child.startsWith("@")) {
          counts.links++;
          const target = child.slice(1);
          const ids = (siteData.sections || []).map(String);
          if (target === "cv") {
            const cv = siteData.header && siteData.header.cv;
            if (!cv || !cv.file || !fs.existsSync(path.join(ROOT, String(cv.file).split("?")[0]))) {
              problem(where, "@cv points at a file that does not exist");
            }
          } else if (target === "email") {
            if (!siteData.header || !siteData.header.email) problem(where, "@email needs header.email in site.json");
          } else if (target !== "top" && !ids.includes(target)) {
            problem(where, "`" + child + "` does not match a section id (" + ids.join(", ") + ")");
          }
        }
      }

      if (key === "add_table" || key === "table") {
        const head = child && (child.column_headers || child.head || child.columns);
        const rows = child && (child.content_of_rows_separated_by_comma || child.rows);
        if (head && Array.isArray(rows)) {
          counts.tables++;
          const width = Array.isArray(head) ? head.length : cells(head).length;
          rows.forEach((row, index) => {
            if (cells(row).length !== width) {
              problem(where, "table row " + (index + 1) + " has " + cells(row).length +
                " cells against " + width + " headers — write that row as an array of cells");
            }
          });
        }
      }

      visit(child, key === "add_content_to_page");
    }
  })(value, true);
}

/* --- site ------------------------------------------------------------- */
const siteData = readJson(SITE_FILE) || {};

if (!siteData.title) warn("data/site.json", "no title");
if (!siteData.header || !siteData.header.name) problem("data/site.json", "header.name is required");
if (!Array.isArray(siteData.sections) || !siteData.sections.length) {
  problem("data/site.json", "sections must list at least one section file");
}

if (siteData.header) {
  if (siteData.header.image_path && !imageExists(siteData.header.image_path)) {
    problem("data/site.json", "portrait not found: " + siteData.header.image_path);
  }
  const cv = siteData.header.cv;
  if (cv && cv.file && !fs.existsSync(path.join(ROOT, String(cv.file).split("?")[0]))) {
    problem("data/site.json", "CV not found: " + cv.file);
  }
}

const iconLinks = (siteData.footer && siteData.footer.links) || [];
iconLinks.forEach((link, index) => {
  if (!link || !link.link) warn("data/site.json", "footer link " + (index + 1) + " has no link");
  if (link && link.icon && !fs.existsSync(path.join(ICON_DIR, link.icon + ".svg"))) {
    problem("data/site.json", "footer icon not found: " + link.icon + ".svg");
  }
});

const seen = new Set();
(siteData.sections || []).forEach((entry) => {
  const id = typeof entry === "string" ? entry : entry && entry.id;
  if (!id) {
    problem("data/site.json", "a section entry has no id");
    return;
  }
  if (seen.has(id)) problem("data/site.json", "duplicate section id: " + id);
  seen.add(id);

  const file = path.join(SECTION_DIR, id + ".json");
  if (!fs.existsSync(file)) {
    problem("data/site.json", "section file missing: data/sections/" + id + ".json");
    return;
  }

  const data = readJson(file);
  if (!data) return;

  counts.sections++;
  if (data.id && data.id !== id) {
    problem(path.relative(ROOT, file), "id `" + data.id + "` does not match the file name `" + id + "`");
  }
  walkSection(data, file);
});

/* --- report ----------------------------------------------------------- */
console.log("");
console.log("CONTENT CONTRACT — " + counts.sections + " sections · " +
  counts.elements + " elements · " + counts.images + " images · " +
  counts.links + " @links · " + counts.tables + " tables");
console.log("");

if (!problems.length && !warnings.length) console.log("  ok  nothing to fix");

warnings.forEach((item) => console.log("  note  " + item.where + "  " + item.message));
problems.forEach((item) => console.log("  fail  " + item.where + "  " + item.message));

if (problems.length) {
  console.log("");
  console.log("  " + problems.length + " problem(s). See README.md → “Checking your content”.");
}

console.log("");
if (strict && problems.length) process.exit(1);
