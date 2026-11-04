# Content vocabulary

Every word on the page comes from JSON. This file lists every key the engine
knows, the shape it expects, and a working example.

Two rules before anything else:

1. **A JSON object holds each key once.** To repeat a heading, a list or a
   quote, put it in `add_content_to_page` — one object per entry.
2. **Keys are read in file order.** For most sections that is all the ordering
   you need; `add_content_to_page` makes it explicit.

---

## 1. The section file

```json
{
  "id": "research",
  "number": "02",
  "label": "Research",
  "heading": "Three questions I keep returning to.",
  "intro": "One sentence under the heading.",
  "add_content_to_page": []
}
```

| Key | Type | What it does |
|-----|------|--------------|
| `id` | text | anchor and file name — `research` opens `#research` |
| `number` | text | the number at the start of the section head; defaults to position |
| `label` | text | the word after the number |
| `heading` | text | section title (accepts inline markup) |
| `intro` | text | paragraph under the title |
| `add_content_to_page` | array | ordered elements |

Any other `add_*` key at section level is drawn too, in file order. Use
`add_content_to_page` whenever a type repeats or the order must be explicit.

---

## 2. Elements

### `add_paragraph`

```json
{ "add_paragraph": "One paragraph.\n\nA second paragraph." }

{ "add_paragraph": {
    "heading": "A small label above",
    "text": "The paragraph itself.",
    "is_lead": true
} }
```

A blank line starts a new paragraph. `heading` is drawn as a small mono label;
`is_lead` sets slightly larger text. Inline markup works.

### `add_heading`

```json
{ "add_heading": {
    "level": 3,
    "heading_text": "A heading",
    "subheading": "An optional line below"
} }
```

`level` is 2–4 (3 by default). Section titles are separate — this is a heading
*inside* the flow.

### `add_list`

```json
{ "add_list": {
    "heading": "Courses",
    "style": "number",
    "add_items_to_list": [
      "**Environmental Analytical Chemistry** — MSc",
      "**Field Methods** — BSc"
    ]
} }
```

Without `style: "number"` items take an accent dash. Items may be plain strings
or objects with a `text` key.

### `add_focus_list`

A two-column grid of numbered points, each with a hairline above it.

```json
{ "add_focus_list": {
    "heading": "At the moment",
    "items_of_the_focus_list": [
      "**Carbon export** — what leaves a catchment after drought",
      "**Sensors** — calibration and drift"
    ]
} }
```

### `add_quote`

```json
{ "add_quote": {
    "text": "A measurement is a promise about a place.",
    "author_of_the_quote": "Field notebook",
    "position_of_the_author": "Upper Wye, 2024"
} }
```

An array draws several quotes.

### `add_special_note`

```json
{ "add_special_note": {
    "colour": "amber",
    "heading": "How the group works",
    "text": "Every project starts with a blank field sheet."
} }
```

`colour` accepts:

| Write | Tone |
|-------|------|
| `info`, `blue`, `note` | slate blue |
| `amber`, `warning`, `warn` | amber |
| `green`, `success` | green |
| `dark`, `neutral` | ink block |
| `accent`, `primary` (default) | the site accent |

Text takes blank-line paragraphs and inline markup.

### `add_table`

```json
{ "add_table": {
    "heading": "Files in this release",
    "table_caption": "Optional caption above the grid.",
    "column_headers": ["File", "Rows", "Description"],
    "content_of_rows_separated_by_comma": [
      "cores.csv, 864, Labelled-core measurements",
      ["plots.csv", "36", "Plot location, region and soil texture"]
    ],
    "align": ["left", "right", "left"]
} }
```

A string row is split on every comma. **If a cell contains a comma, write the
row as an array** — otherwise the columns shift. `align` takes `left`,
`center` or `right` per column. The table scrolls sideways on narrow screens.

### `add_cards`

```json
{ "add_cards": {
    "heading": "Projects",
    "columns": 3,
    "individual_card_details": [
      {
        "individual_card_keyword": "Carbon",
        "heading": "What leaves a catchment, and when",
        "text": "Drought–rewet cycles flush stored carbon in a few days.",
        "link": "@publications"
      }
    ]
} }
```

Cards with a `link` become anchors and show a “Read” cue. `columns` is 1–4.

### `add_full_width_links`

Typographic link rows: number, label, note, arrow.

```json
{ "add_full_width_links": {
    "heading": "Elsewhere",
    "links": [
      { "label": "Google Scholar", "link": "https://scholar.google.com/", "note": "Papers" },
      { "label": "Download the CV", "link": "@cv", "note": "PDF" }
    ]
} }
```

### `add_image`

```json
{ "add_image": {
    "image_path": "assets/images/lab-bench.jpg",
    "image_alt": "A scientist loading samples onto an instrument",
    "image_caption": "Ion chromatography, mid-run.",
    "image_credit": "CLEAR WATER LAB",
    "align": "right",
    "zoom_on": true
} }
```

`align` may be `left` or `right` (default full width). `zoom_on: false` disables
the lightbox for that image.

### `add_gallery`

```json
{ "add_gallery": {
    "heading": "From the field",
    "columns": 3,
    "size": "4:3",
    "images": [
      {
        "image_path": "assets/images/field-stream.jpg",
        "image_alt": "Researchers sampling a stream",
        "image_caption": "Sampling after a storm.",
        "image_credit": "CLEAR WATER LAB"
      }
    ]
} }
```

`size` is `16:9`, `4:3`, `1:1`, `3:4`, `4:5` or `natural`. Caption and credit
share one line; credit is optional.

### `add_slideshow`

```json
{ "add_slideshow": {
    "heading": "The route",
    "rotation_time_milliseconds": 4500,
    "images": [
      { "image_path": "assets/images/coast.jpg", "image_alt": "Coast", "image_caption": "First" },
      { "image_path": "assets/images/alpine.jpg", "image_alt": "Alps", "image_caption": "Second" }
    ]
} }
```

Rotates only while in view, pauses on hover and when the tab is hidden. Dots and
a counter sit in the bar below.

### `add_people`

```json
{ "add_people": {
    "heading": "Collaborators",
    "people": [
      {
        "name": "Prof. Alan Whitfield",
        "position": "Catchment science",
        "image_path": "assets/images/portrait.jpg",
        "profile_link": "https://example.com/alan"
      },
      { "name": "Dr. Jide Okafor", "position": "Sediment chemistry" }
    ]
} }
```

A person without a photograph gets a monogram placeholder, so rows stay aligned.

### `add_a_timeline`

```json
{ "add_a_timeline": {
    "heading": "Recent talks",
    "items_of_the_timeline": [
      {
        "timeline_item_date": "2026",
        "timeline_item_title": "Keynote: the half-life of a measurement",
        "timeline_item_text": "British Society for Environmental Chemistry, Cardiff."
      }
    ]
} }
```

`add_timeline` is accepted as an alias.

### `add_tags`

```json
{ "add_tags": { "tags": ["Fieldwork", "Laboratory"] } }
```

A plain array works too.

### `add_button`

```json
{ "add_button": [
    { "label": "Full list on Google Scholar", "link": "https://scholar.google.com/", "style": "fill" },
    { "label": "Download the CV", "link": "@cv", "style": "outline" }
] }
```

A single object works as well. `style` is `fill` (default) or `outline`.

### `add_divider`

```json
{ "add_divider": true }
```

One hairline.

### `add_publication_or_more`

```json
{ "add_publication_or_more": {
    "heading": "Selected publications",
    "items": [
      {
        "title": "Drought legacies drive dissolved organic carbon flushes",
        "authors": "Reyes, N., Whitfield, A. & Okafor, J.",
        "venue": "Biogeochemistry",
        "year": "2026",
        "link": "https://doi.org/…"
      }
    ]
} }
```

`show_numbering: false` removes the left-hand numbers. `add_publications` and
`add_publication_list` are aliases.

### `add_contact_information`

```json
{ "add_contact_information": {
    "email": "naomi.reyes@northfield.ac.uk",
    "note": "Collaborations · reviews · student enquiries"
} }
```

The address is drawn large and links to `mailto:`.

### `add_embed_media`

```json
{ "add_embed_media": {
    "link": "https://www.youtube.com/watch?v=…",
    "heading": "A talk",
    "caption": "Recorded at the spring meeting."
} }
```

YouTube and Vimeo addresses become a 16:9 player; anything else becomes a link
row.

### `add_content_to_page`

```json
{ "add_content_to_page": [
    { "add_paragraph": "First." },
    { "add_heading": { "heading_text": "Then a heading" } },
    { "add_paragraph": "Third." }
] }
```

One object per entry, one element per object. This is the only way to repeat the
same element type in a defined order.

---

## 3. Values that recur

### Links

| Write | Result |
|-------|--------|
| `@about` | `#about` |
| `@cv` | the CV file from `header.cv` in `site.json` |
| `@email` | `mailto:` the profile email |
| `@top` | `#top` |
| `https://…` | as written, new tab |
| `mailto:…`, `#…`, `assets/…` | as written |

Any other `@name` is treated as a section id and becomes `#name`.

### Images

| Write | Read from |
|-------|-----------|
| `portrait.jpg` | `assets/images/portrait.jpg` |
| `assets/images/portrait.jpg` | as written |
| `https://…` | as written |
| `/assets/…` | from the site root |

### Text

| Markup | Result |
|--------|--------|
| `**bold**` | bold |
| `*italic*` | italic |
| `` `code` `` | code |
| `==highlight==` | highlighted |
| `~~struck~~` | struck through |
| `[label](https://example.com)` | link |
| blank line | new paragraph |

### Sizes and counts

| Key | Values |
|-----|--------|
| `columns` (cards, gallery) | 1–4 |
| `size` (gallery) | `16:9`, `4:3`, `1:1`, `3:4`, `4:5`, `natural` |
| `align` (image) | `left`, `right` |
| `align` (table) | one value per column: `left`, `center`, `right` |
| `level` (heading) | 2–4 |
| `rotation_time_milliseconds` | number, minimum 1500 |

---

## 4. Adding an element

`js/elements.js` is a registry. To add your own:

```js
RENDERERS.add_my_element = function (value) {
  return '<div class="el-note">' + PF.esc(String(value)) + "</div>";
};
```

Add the styling to `css/site.css`, then use it like any other element. Run
`node tools/check-content.js` — it reads the registry from the same file, so a
new element is accepted everywhere immediately.

---

## 5. Writing well inside this page

- One idea per section. The layout gives every section a title, an intro and a
  column of elements; that is enough room for a summary, not a chapter.
- Keep the header intro to one sentence. The sections carry the detail.
- Use `split` for sections with a short body (about, teaching, contact) and
  `stack` for lists that need the full width (publications, gallery).
- Captions should say something the photograph does not; credits keep the
  attribution honest.
- Alt text is content. Describe what is in the frame.
