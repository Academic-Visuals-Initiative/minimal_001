# Most Minimal

A one-page portfolio template with almost no design: a header, a stack of
sections and a footer. 1280 px wide, no build step, all words in JSON.

- **Header** — information on the left, portrait on the right, CV button under
  the portrait.
- **Sections** — each in its own file. The number/label/rule head spans the
  width; below it the title and intro sit in a 260 px column with the content
  elements running beside them, so the page uses its width instead of leaving a
  long empty right-hand side.
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
├── css/
│   └── site.css             the whole design
├── js/
│   ├── core.js              loading, links, images, markup, lightbox
│   ├── elements.js          the content creation engine
│   └── app.js               header, sections, footer
├── data/
│   ├── site.json            metadata, header, section order, footer links
│   └── sections/
│       ├── about.json
│       ├── research.json
│       ├── publications.json
│       ├── teaching.json
│       └── contact.json
├── assets/
│   ├── cv.pdf
│   ├── images/portrait.jpg
│   └── icons/social/
├── tools/
│   └── check-content.js
├── README.md
└── VOCABULARY.md
```

---

## The header — `data/site.json`

```json
"header": {
  "eyebrow": "Portfolio — 2026",
  "name": "Dr. Naomi Reyes",
  "title": "Associate Professor of Environmental Chemistry",
  "affiliation": "Northfield University",
  "intro": "One or two sentences.",
  "meta": ["Bristol, United Kingdom", "naomi.reyes@northfield.ac.uk"],
  "image_path": "assets/images/portrait.jpg",
  "image_alt": "Portrait of Dr. Naomi Reyes",
  "email": "naomi.reyes@northfield.ac.uk",
  "cv": {
    "label": "Download CV",
    "file": "assets/cv.pdf"
  }
}
```

| Key | What it does |
|-----|--------------|
| `eyebrow` | the small line above the name |
| `name` | the large serif name |
| `title` | academic title under the name — “PhD Student”, “Associate Professor”, … |
| `role` | optional second line under the title |
| `affiliation` | institution, in small caps |
| `intro` | an optional paragraph |
| `meta` | small facts under the intro |
| `image_path`, `image_alt` | the portrait on the right |
| `email` | used by `@email` |
| `cv` | `label` and `file`; the button sits under the portrait |

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
| `add_content_to_page` | ordered elements |

Any `add_*` key can also sit at the top level of the section file; use
`add_content_to_page` when a type repeats or order matters.

### Add a section

1. Copy an existing file in `data/sections/`, rename it and set its `id`.
2. Write the `number`, `label`, `heading`, `intro` and elements.
3. Add the id to `sections` in `data/site.json`, in the position you want.

Remove the id from `sections` to hide a section; the file can stay.

---

## Elements

The engine is the same one used by the larger templates. Every element is an
`add_*` key; [`VOCABULARY.md`](VOCABULARY.md) documents each shape with an
example.

Available: `add_paragraph`, `add_heading`, `add_list`, `add_focus_list`,
`add_quote`, `add_special_note`, `add_table`, `add_cards`,
`add_full_width_links`, `add_image`, `add_gallery`, `add_slideshow`,
`add_people`, `add_a_timeline`, `add_tags`, `add_button`, `add_divider`,
`add_publication_or_more`, `add_contact_information`, `add_embed_media`,
`add_content_to_page`.

Text accepts `**bold**`, `*italic*`, `` `code` ``, `==highlight==`,
`[label](https://example.com)`, and a blank line starts a new paragraph.

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
```

It checks required header fields, section files and ids, element names, image
paths, `@links`, table rows and footer icons.

---

## Design notes

- 1280 px shell, one column of content; the header is the only two-column area.
- The portrait is a **square (1:1)** image, scaled on desktop so the image + CV
  button exactly match the height of the text block; on phones it fills the
  column and sits under the information.
- **Newsreader** for display type, **Inter** for everything else.
- White ground, near-black ink, hairline rules. No theme switch, no sticky
  navigation, no decoration.
- All design lives in `css/site.css`; all words live in `data/`.

---

## Licence

Designed by [AVI](https://www.academicvisualsinitiative.org). Licensed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Hosted on [GitHub Pages](https://pages.github.com).
