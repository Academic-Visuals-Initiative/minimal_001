# Most Minimal — Stacked

The stacked variant of *Most Minimal*: a header, a vertical run of sections and
a footer. 1280 px wide, no build step, all words in JSON.

- **Header** — information on the left, portrait on the right, CV button under
  the portrait.
- **Sections** — each in its own file. The number/label/rule head spans the
  width, the title sits beneath it, the intro follows at full width, then the
  content elements. One flow serves every section: items stack unless they
  name a `column`, and an optional `layout: "text"` runs prose as two magazine
  columns.
- **Footer** — social icons, then the licence line.
- **Content system** — the same `add_*` element vocabulary as the larger
  templates. See [`VOCABULARY.md`](VOCABULARY.md).

---

## Run it

```bash
cd "most minimal"
python -m http.server 8000
# open http://localhost:8000
```

A static server is required — browsers do not fetch JSON from `file://`.

---

## What is where

```
most minimal/
├── index.html
├── page.html              free-standing JSON pages
├── css/
│   └── site.css             the whole design
├── js/
│   ├── core.js              loading, links, images, markup, lightbox
│   ├── schema.js            canonical keys and aliases
│   ├── elements.js          registry + shared helpers
│   ├── render/
│   │   ├── text.js          headings, paragraphs, lists, quotes, notes, tags
│   │   ├── media.js         image, gallery, slideshow, 3D, embeds, equations
│   │   ├── data.js          cards, people, timeline, publications, contact…
│   │   └── structure.js     links, buttons, dividers
│   └── app.js               header, sections, footer
├── data/
│   ├── site.json            metadata, header, section order, footer links
│   ├── sections/
│   │   ├── about.json
│   │   ├── research.json
│   │   ├── publications.json
│   │   ├── teaching.json
│   │   ├── education.json
│   │   └── contact.json
│   └── pages/
│       ├── new_examples1.json … new_examples7.json   the reference set
│       └── examples/
│           └── hello.json
├── assets/
│   ├── cv.pdf
│   ├── images/portrait.jpg
│   └── icons/
│   │   ├── custom_icons/
│       └── social/
├── pages/
│   └── reader.html          the PDF reader
├── tools/
│   ├── check-content.js
│   ├── check-schema.js
│   ├── check-assets.js     file sizes and deploy budgets
│   └── build.js             bundles the scripts into dist/
├── README.md
├── SCHEMA.md
├── NEW_EXAMPLES.md
└── VOCABULARY.md
```

---

## The header — `data/site.json`

```json
"header": {
  "subheading": "Portfolio — 2026",
  "name": "Dr. Naomi Reyes",
  "title": "Associate Professor of Environmental Chemistry",
  "affiliation": "Northfield University",
  "intro": "One or two sentences.",
  "additional_info": ["Bristol, United Kingdom", "naomi.reyes@northfield.ac.uk"],
  "image_path": "assets/images/portrait.jpg",
  "image_alt": "Portrait of Dr. Naomi Reyes",
  "email": "naomi.reyes@northfield.ac.uk",
  "cv": {
    "label": "View CV",
    "file": "assets/cv.pdf"
  }
}
```

| Key | What it does |
|-----|--------------|
| `subheading` | the small line above the name |
| `name` | the large serif name |
| `title` | academic title under the name — “PhD Student”, “Associate Professor”, … |
| `role` | optional second line under the title |
| `affiliation` | institution, in small caps |
| `intro` | an optional paragraph |
| `additional_info` | small facts under the intro |
| `image_path`, `image_alt` | the portrait on the right |
| `email` | used by `@email` |
| `cv` | `label` and `file`; the button sits under the portrait |

The CV button always opens the site's own PDF reader (`pages/reader.html`), and
the reader reads `header.cv.file` from this same file, so the two can never
disagree. Only the `file` and `label` are configurable; there is no viewer path
to maintain.

The reader renders with **pdf.js** from cdnjs (the same version the larger
templates use), so it needs a network connection; if the file cannot be
loaded it shows the error and a direct download link.

Leave `image_path` empty and the header becomes one column; the CV button moves
under the meta line instead. Remove `cv` and the button disappears.

The top-level `data/site.json` also holds `title`, `description`, `favicon`,
the ordered `sections` list, and `footer.links`.

---

## Sections

Each file in `data/sections/` is one section:

```json
{
  "id": "about",
  "number": "01",
  "label": "About",
  "heading": "A short profile.",
  "intro": "One sentence under the heading.",
  "add_content_to_page": [
    { "add_paragraph": "First paragraph.\n\nSecond paragraph." }
  ]
}
```

| Key | What it does |
|-----|--------------|
| `id` | anchor and file name (`#about`) |
| `number` | the number in the section head; defaults to position |
| `label` | the word after the number |
| `heading` | the serif title |
| `intro` | the sentence under the title |
| `layout` | optional; `text` runs prose in two magazine columns. Omit it for the normal flow. `stack` / `columns` are accepted as legacy no-ops |
| `add_content_to_page` | ordered elements |

There is no separate stack or columns mode. Every element may name its side
with `"column": "left"` or `"right"`, or sit beside the element as a sibling
key; elements without a side stack at full width. `layout: "text"` is the only
special mode, and it is per section.

Any `add_*` key can also sit at the top level of the section file; use
`add_content_to_page` when a type repeats or order matters.

### Add a section

1. Copy an existing file in `data/sections/`, rename it and set its `id`.
2. Write the `number`, `label`, `heading`, `intro` and elements.
3. Add the id to `sections` in `data/site.json`, in the position you want.

Remove the id from `sections` to hide a section; the file can stay.

---

## Pages

The site is one page, but any number of extra pages can be written entirely in
JSON. `page.html` reads one file and draws it with the same header, footer,
fonts, CSS and element engine:

```
page.html?page=methods            → data/pages/methods.json
page.html?page=research/field     → data/pages/research/field.json
page.html?page=examples/hello     → the example page in this folder
```

A page file names its sections. Each entry is either an inline section object
(the same keys as a file in `data/sections/`) or the id of an existing section:

```json
{
  "title": "Methods",
  "description": "How the lab measures carbon in upland streams.",
  "sections": [
    {
      "id": "methods",
      "heading": "How we measure.",
      "intro": "Field sheets, calibration and the parts that do not fit in the paper.",
      "add_content_to_page": [
        { "add_paragraph": "Every campaign starts with the same blank sheet." },
        { "add_quote": "If it cannot be repeated in the rain, it is not a method." }
      ]
    },
    "publications"
  ]
}
```

- `title` sets the browser title (`Methods — <site title>`) and `description`
  replaces the meta description.
- Inline sections carry their own headings and elements; an id like
  `"publications"` loads `data/sections/publications.json`.
- A standalone page has **no numbered section head**: the sticky bar carries
  the page title, and each section keeps only its title and intro. `number` and
  `label` are used by the home sections, not by pages.
- Footer and fonts still come from `data/site.json`, but the masthead is
  replaced by a slim sticky bar: a **Back** link (returns to the page you came from,
  or to `index.html`) and the page title.
- Addresses are sanitised: `..` and backslashes are refused with a message
  instead of loading an arbitrary file.
- `page.html` sits at the site root so relative paths (`assets/…`,
  `pages/reader.html`) keep working exactly as on the home page.

Link to a page with ordinary markup — it is just a URL:

```json
{ "label": "Methods", "link": "page.html?page=examples/example" }
```

or inline: `{Methods|page.html?page=examples/example}`. There is also a short
route: dots and slashes both work, `@pages.examples.example` and
`@pages/examples/example` both become `page.html?page=examples/example`.

`@pages.examples` alone points at `data/pages/examples.json` — include the file
name (`@pages.examples.example`) when the JSON lives inside a folder.

### A page without sections

A page may also be written as a bare content flow, copied straight from a
section file:

```json
{
  "title": "Methods",
  "description": "How the lab measures carbon.",
  "add_content_to_page": [
    { "add_paragraph": "Every campaign starts with the same blank sheet." },
    { "add_heading": { "level": 2, "heading_text": "Sampling" } }
  ]
}
```

The `title` becomes a single section heading, so every element renders as one
page. `add_paragraph`, `add_cards`, `add_table`, … work exactly as in a section.

To use left/right lanes on a page, just give elements a `column` — no layout
key is needed. Elements without a hint stack at full width.

```json
{
  "title": "Methods",
  "add_content_to_page": [
    { "add_heading": { "column": "left", "level": 2, "heading_text": "Sampling" } },
    { "add_image": { "column": "right", "image_path": "field.jpg", "image_alt": "…" } }
  ]
}
```

---

## Elements

The engine is the same one used by the larger templates. Every element is an
`add_*` key; [`VOCABULARY.md`](VOCABULARY.md) documents each shape with an
example. The complete worked reference is
[`NEW_EXAMPLES.md`](NEW_EXAMPLES.md), with live pages
`page.html?page=new_examples1` … `page.html?page=new_examples7`.

Available: `add_paragraph`, `add_heading`, `add_list`, `add_focus_list`,
`add_quote`, `add_special_note`, `add_table`, `add_cards`,
`add_full_width_links`, `add_image`, `add_gallery`, `add_slideshow`,
`add_people`, `add_a_timeline`, `add_tags`, `add_button`, `add_divider`,
`add_publication_or_more`, `add_featured_publication`,
`add_teaching_items`, `add_expandable_information`,
`add_contact_information`, `add_embed_media`, `add_content_to_page`.

Text accepts `**bold**`, `*italic*`, `` `code` ``, `==highlight==`,
`[label](https://example.com)`, and a blank line starts a new paragraph.

Cards and publications accept `tags` — an array or a comma-separated string —
used to filter them. When a group has two or more tags, a filter bar appears
above it; tags are not printed on the items. `categories`, `category` and
`keywords` are aliases. Set `show_categories: false` to hide the bar, or
`filter_position: "top"` to lift it to the start of the section.

---

## Links

| Written | Becomes |
|---------|---------|
| `@about` | `#about` |
| `@cv` | `header.cv.file` |
| `@email` | `mailto:` the header email |
| `@top` | `#top` |
| `https://…` | unchanged, new tab |
| `assets/…` | unchanged |

Images follow the same rule: a bare filename reads from `assets/images/`, a
path is used as written.

---

## Footer

```json
"footer": {
  "links": [
    { "link": "mailto:naomi.reyes@northfield.ac.uk", "icon": "mail" },
    { "link": "https://scholar.google.com/", "icon": "googlescholar-old" },
    { "link": "https://orcid.org/", "icon": "orcid" }
  ]
}
```

The label and tooltip come from the icon name (`mail` → Email,
`googlescholar-old` → Google Scholar, `github` → GitHub, and so on); an optional
`label` overrides it. Icons live in `assets/icons/social/`.

The licence line under the icons is hardcoded in `index.html` and restored by
`js/core.js` if it is removed. Replace `assets/cv.pdf` with your own CV.

---

## Check your content

```bash
node tools/check-content.js            # report
node tools/check-content.js --strict   # exit 1 on any problem
node tools/check-schema.js             # canonical keys, known elements, valid JSON
node tools/check-schema.js --strict    # exit 1 when a deprecated spelling is used
```

Canonical keys are listed in [`SCHEMA.md`](SCHEMA.md) and resolved in
`js/schema.js`; the renderers read them through `PF.schema.pick()`.

It checks required header fields, section files and ids, element names, image
paths, `@links`, table rows and footer icons.

---

## Build for deployment

```bash
node tools/build.js
```

Writes a self-contained `dist/` you can upload as-is:

- `index.html` and `page.html`, with the eight script tags replaced by one
  bundled `js/bundle.js`;
- `js/bundle.js` — core → schema → elements → render/text → render/data →
  render/media → render/structure → app, concatenated in load order. The
  source is not minified;
- `css/site.css`;
- `data/`, `assets/` and `pages/` copied unchanged, so `page.html?page=…` and
  the PDF reader also work from inside `dist/`;
- `?v=<hash>` on the bundle and stylesheet, derived from their contents, so a
  changed file gets a new URL and browser caches turn over.

`dist/` is disposable: re-run the build after editing the source, and never
edit files there directly. The build fails if a page still references a local
script that is not in the bundle, which catches a script added to the HTML but
forgotten in `SCRIPTS` (in `tools/build.js`).

The report prints the three heaviest files, and gzip/brotli transfer sizes for
the bundle and stylesheet (about 23 KB and 8 KB compressed). The demo GIFs in
`assets/images/` account for most of the weight, so replace or remove them
before a real deploy; the code itself is about 140 KB.

### Check the weight

```bash
node tools/check-assets.js                              # report
node tools/check-assets.js --strict --max-total=10      # fail above 10 MB
node tools/check-assets.js --strict --max-file=2        # fail above 2 MB/file
```

Prints the size of each asset folder, the five largest files and how many are
over 1 MB. Budgets are in MB and only enforced with `--strict`, so the template
as shipped still passes; set your own limits before deploying.

---

## Design notes

- 1280 px shell. The header is two columns; every section is a single, stacked
  column: head, title, intro, content.
- The portrait is a **square (1:1)** image, scaled on desktop so the image + CV
  button exactly match the height of the text block; on phones it fills the
  column and sits under the information.
- **Newsreader** for display type, section standfirsts and every heading level;
  **Inter** for eyebrows, metadata, controls and body copy.
- White ground, near-black ink, hairline rules. No theme switch, no sticky
  navigation, no decoration.
- All design lives in `css/site.css`; all words live in `data/`.

---

## Licence

Designed by [AVI](https://www.academicvisualsinitiative.org). Licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Hosted on [GitHub Pages](https://pages.github.com).
