/* ==========================================================================
   build.js — a dependency-free production copy.

     node tools/build.js

   Writes dist/ with:
     · the two HTML pages, data/, assets/, pages/
     · one js/bundle.js (core → schema → elements → render/* → app)
     · css/site.css
     · ?v=<hash> on the bundle and stylesheet, so caches turn over on deploy

   No minifier, no dependencies. The source stays exactly as written; the
   bundle is only a concatenation in load order.
   ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const SCRIPTS = [
  "js/core.js",
  "js/schema.js",
  "js/elements.js",
  "js/render/text.js",
  "js/render/data.js",
  "js/render/media.js",
  "js/render/structure.js",
  "js/app.js"
];

const COPY = ["data", "assets", "pages"];

function hash(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
}

function copyTree(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else fs.copyFileSync(source, target);
  }
}

function copyFile(relative) {
  const source = path.join(ROOT, relative);
  if (!fs.existsSync(source)) return 0;
  const target = path.join(DIST, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return fs.statSync(source).size;
}

/* --- clean ----------------------------------------------------------------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* --- bundle ---------------------------------------------------------------- */
const parts = SCRIPTS.map((relative) => {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) throw new Error("missing script: " + relative);
  return "/* " + relative + " */\n" + fs.readFileSync(file, "utf8");
});
const bundle = parts.join("\n\n");
fs.mkdirSync(path.join(DIST, "js"), { recursive: true });
fs.writeFileSync(path.join(DIST, "js", "bundle.js"), bundle, "utf8");

/* --- stylesheet ------------------------------------------------------------ */
const css = fs.readFileSync(path.join(ROOT, "css", "site.css"), "utf8");
fs.mkdirSync(path.join(DIST, "css"), { recursive: true });
fs.writeFileSync(path.join(DIST, "css", "site.css"), css, "utf8");

const jsVersion = hash(bundle);
const cssVersion = hash(css);

/* --- pages ----------------------------------------------------------------- */
let pages = 0;
for (const page of ["index.html", "page.html"]) {
  let html = fs.readFileSync(path.join(ROOT, page), "utf8");

  html = html.replace(
    /[ \t]*<script src="js\/(?:core|schema|elements|app)\.js[^"]*" defer><\/script>[ \t]*\r?\n?/g,
    ""
  );
  html = html.replace(
    /[ \t]*<script src="js\/render\/[^"]*" defer><\/script>[ \t]*\r?\n?/g,
    ""
  );
  html = html.replace(
    /\s*<\/body>/,
    '\n  <script src="js/bundle.js?v=' + jsVersion + '" defer></script>\n</body>'
  );
  html = html.replace(/(css\/site\.css)\?v=[^"]*/g, "$1?v=" + cssVersion);

  const orphan = html.match(/<script src="js\/(?!bundle\.js)[^"]*"/);
  if (orphan) throw new Error(page + ": script is not in the bundle → " + orphan[0]);

  fs.writeFileSync(path.join(DIST, page), html, "utf8");
  pages += 1;
}

/* --- data, assets, reader -------------------------------------------------- */
for (const folder of COPY) copyTree(path.join(ROOT, folder), path.join(DIST, folder));

function measure(folder, list) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      const inner = measure(full, list);
      files += inner.files;
      bytes += inner.bytes;
    } else {
      const size = fs.statSync(full).size;
      files += 1;
      bytes += size;
      if (list) list.push({ path: path.relative(DIST, full).replace(/\\/g, "/"), size });
    }
  }
  return { files, bytes };
}

const allFiles = [];
const copyStats = measure(DIST, allFiles);
const bundleSize = fs.statSync(path.join(DIST, "js", "bundle.js")).size;

/* What the browser actually downloads, before the server's own compression. */
function transfer(text) {
  const buffer = Buffer.from(text, "utf8");
  const gzip = zlib.gzipSync(buffer, { level: 9 }).length;
  const brotli = zlib.brotliCompressSync(buffer, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
  }).length;
  return Math.round(gzip / 1024 * 10) / 10 + " KB gzip / " +
    Math.round(brotli / 1024 * 10) / 10 + " KB brotli";
}

console.log("BUILD → dist/");
console.log("  pages       " + pages);
console.log("  bundle      " + (bundleSize / 1024).toFixed(1) + " KB  js/bundle.js?v=" + jsVersion);
console.log("              " + transfer(bundle) + " compressed");
console.log("  stylesheet  " + (fs.statSync(path.join(DIST, "css", "site.css")).size / 1024).toFixed(1) + " KB  css/site.css?v=" + cssVersion);
console.log("              " + transfer(css) + " compressed");
console.log("  copied      " + (copyStats.files - pages - 2) + " files  data/ assets/ pages/");
console.log("  total       " + (copyStats.bytes / 1024 / 1024).toFixed(1) + " MB");

const heaviest = allFiles.sort((a, b) => b.size - a.size).slice(0, 3);
if (heaviest.length) {
  console.log("");
  console.log("  heaviest");
  for (const file of heaviest) {
    console.log("    " + (file.size / 1024 / 1024).toFixed(1).padStart(5) + " MB  " + file.path);
  }
  if (heaviest[0].size > 5 * 1024 * 1024) {
    console.log("    demo media dominates — replace or compress the large files before a real deploy");
    console.log("    node tools/check-assets.js for the full breakdown");
  }
}
