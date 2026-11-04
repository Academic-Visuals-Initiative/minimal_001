/* ==========================================================================
   elements.js — the content creation system.

   Every element is an `add_*` key in JSON; the renderer turns it into
   markup with the classes defined in css/site.css. A key may appear once
   at the top of a section, or any number of times inside
   `add_content_to_page` when order and repetition matter.
   ========================================================================== */
(function (global) {
  "use strict";

  var PF = global.PF;
  var esc = PF.esc;
  var format = PF.formatText;
  var src = PF.imageSrc;

  var RENDERERS = {};
  var ALIASES = {};

  function toArray(value) { return PF.toArray(value); }

  function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  function firstValue(obj, keys) {
    if (!obj) return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null) return obj[keys[i]];
    }
    return undefined;
  }

  function headingLabel(value) {
    if (!value) return "";
    return '<h3 class="el-heading__text el-heading__text--sub">' + format(value) + "</h3>";
  }

  function paragraphs(text) {
    return String(text == null ? "" : text)
      .split(/\n{2,}/)
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .map(function (part) { return "<p>" + format(part) + "</p>"; })
      .join("");
  }

  /* --- add_heading ------------------------------------------------------ */
  RENDERERS.add_heading = function (value) {
    var obj = isPlainObject(value) ? value : { heading_text: value };
    var level = Math.min(Math.max(Number(obj.level) || 3, 2), 4);
    var text = firstValue(obj, ["heading_text", "heading", "text", "title"]);
    var sub = firstValue(obj, ["subheading", "subheading_text", "kicker", "note"]);
    if (text == null && sub == null) return "";
    return [
      '<div class="el-heading">',
      text != null ? "<h" + level + ' class="el-heading__text">' + format(text) + "</h" + level + ">" : "",
      sub ? '<p class="el-heading__sub">' + format(sub) + "</p>" : "",
      "</div>"
    ].filter(Boolean).join("");
  };

  /* --- add_paragraph ---------------------------------------------------- */
  RENDERERS.add_paragraph = function (value) {
    if (Array.isArray(value)) {
      return value.map(function (v) { return RENDERERS.add_paragraph(v); }).join("");
    }
    var obj = isPlainObject(value) ? value : { text: value };
    var text = firstValue(obj, ["text", "paragraph", "content"]);
    if (text == null) return "";
    var heading = firstValue(obj, ["heading", "title", "label"]);
    var lead = obj.is_lead === true || obj.lead === true;
    var body = paragraphs(text);
    if (!body) return "";
    return '<div class="el-prose' + (lead ? " el-prose--lead" : "") + '">' +
      (heading ? '<p class="el-prose__label">' + format(heading) + "</p>" : "") +
      body +
      "</div>";
  };

  /* --- add_list --------------------------------------------------------- */
  function listItems(value, keys) {
    if (Array.isArray(value)) return value;
    var obj = isPlainObject(value) ? value : {};
    var items = firstValue(obj, keys);
    return Array.isArray(items) ? items : [];
  }

  function itemText(item) {
    if (isPlainObject(item)) return firstValue(item, ["text", "item", "label", "value"]);
    return item;
  }

  RENDERERS.add_list = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var items = listItems(value, ["add_items_to_list", "items", "list"]);
    if (!items.length) return "";
    var numbered = String(obj.style || "").toLowerCase() === "number";
    var heading = firstValue(obj, ["heading", "title", "label"]);
    var html = items.map(function (item) {
      var text = itemText(item);
      if (text == null || text === "") return "";
      return "<li>" + format(text) + "</li>";
    }).filter(Boolean).join("");
    if (!html) return "";
    return headingLabel(heading) +
      '<ul class="el-list' + (numbered ? " el-list--number" : "") + '">' + html + "</ul>";
  };

  /* --- add_focus_list --------------------------------------------------- */
  RENDERERS.add_focus_list = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var items = listItems(value, ["items_of_the_focus_list", "items", "focus"]);
    if (!items.length) return "";
    var heading = firstValue(obj, ["heading", "title", "label"]);
    var html = items.map(function (item) {
      var text = itemText(item);
      if (text == null || text === "") return "";
      return "<li>" + format(text) + "</li>";
    }).filter(Boolean).join("");
    if (!html) return "";
    return headingLabel(heading) + '<ul class="el-focus">' + html + "</ul>";
  };

  /* --- add_quote -------------------------------------------------------- */
  RENDERERS.add_quote = function (value) {
    return toArray(value).map(function (item) {
      var obj = isPlainObject(item) ? item : { text: item };
      var text = firstValue(obj, ["text", "quote", "blockquote"]);
      if (!text) return "";
      var author = firstValue(obj, ["author_of_the_quote", "author", "name"]);
      var role = firstValue(obj, ["position_of_the_author", "position", "role"]);
      var who = [author, role].filter(Boolean).map(function (part) {
        return esc(String(part));
      }).join(", ");
      return '<figure class="el-quote">' +
        "<blockquote>" + format(text) + "</blockquote>" +
        (who ? "<figcaption><strong>" + who + "</strong></figcaption>" : "") +
        "</figure>";
    }).filter(Boolean).join("");
  };

  /* --- add_special_note ------------------------------------------------- */
  var NOTE_TONES = {
    info: "info", blue: "info", note: "info",
    amber: "amber", warning: "amber", warn: "amber",
    green: "green", success: "green",
    dark: "dark", neutral: "dark",
    accent: "accent", primary: "accent"
  };

  RENDERERS.add_special_note = function (value) {
    return toArray(value).map(function (item) {
      var obj = isPlainObject(item) ? item : { text: item };
      var text = firstValue(obj, ["text", "special_note", "note", "content"]);
      if (!text) return "";
      var heading = firstValue(obj, ["heading", "title", "label"]);
      var tone = NOTE_TONES[String(obj.colour || obj.color || "accent").toLowerCase()] || "accent";
      return '<aside class="el-note el-note--' + tone + '">' +
        (heading ? '<p class="el-note__label">' + format(heading) + "</p>" : "") +
        '<div class="el-note__text">' + paragraphs(text) + "</div>" +
        "</aside>";
    }).filter(Boolean).join("");
  };

  /* --- add_table -------------------------------------------------------- */
  function splitCells(value) {
    if (Array.isArray(value)) {
      return value.map(function (cell) { return String(cell == null ? "" : cell).trim(); });
    }
    return String(value == null ? "" : value).split(",").map(function (cell) { return cell.trim(); });
  }

  RENDERERS.add_table = function (value) {
    var obj = isPlainObject(value) ? value : null;
    if (!obj) return "";

    var headRaw = firstValue(obj, ["column_headers", "head", "columns"]);
    var rowsRaw = firstValue(obj, ["content_of_rows_separated_by_comma", "rows", "content"]);
    var head = headRaw == null ? [] : splitCells(headRaw);
    var rows = toArray(rowsRaw).map(splitCells).filter(function (row) {
      return row.length && row.join("").trim();
    });
    if (!head.length && !rows.length) return "";

    var aligns = toArray(obj.align);
    function alignAt(index) {
      var value = String(aligns[index] || aligns[0] || "left").toLowerCase();
      return value === "right" ? " is-right" : (value === "center" ? " is-center" : "");
    }

    var heading = firstValue(obj, ["heading", "title", "label"]);
    var caption = firstValue(obj, ["table_caption", "caption"]);

    var html = ['<div class="el-table-wrap"><table class="el-table">'];
    if (caption) html.push("<caption>" + format(caption) + "</caption>");
    if (head.length) {
      html.push("<thead><tr>");
      head.forEach(function (cell, index) {
        html.push('<th scope="col" class="' + alignAt(index).trim() + '">' + format(cell) + "</th>");
      });
      html.push("</tr></thead>");
    }
    html.push("<tbody>");
    rows.forEach(function (row, rowIndex) {
      if (head.length && row.length !== head.length) {
        console.warn("[table] row " + (rowIndex + 1) + " has " + row.length + " cells but the table has " +
          head.length + " columns — a comma inside a cell splits it. Write that row as an array of cells.");
      }
      html.push("<tr>");
      row.forEach(function (cell, index) {
        html.push('<td class="' + alignAt(index).trim() + '">' + format(cell) + "</td>");
      });
      html.push("</tr>");
    });
    html.push("</tbody></table></div>");

    return headingLabel(heading) + html.join("");
  };

  /* --- add_cards -------------------------------------------------------- */
  RENDERERS.add_cards = function (value) {
    var obj = isPlainObject(value) ? value : { individual_card_details: value };
    var cards = toArray(firstValue(obj, ["individual_card_details", "cards", "items"]));
    if (!cards.length) return "";

    var columns = Math.min(Math.max(Number(obj.columns) || 3, 1), 4);
    var heading = firstValue(obj, ["heading", "title"]);
    var intro = firstValue(obj, ["intro", "introduction", "text"]);

    var html = cards.map(function (card) {
      if (!isPlainObject(card)) return "";
      var keyword = firstValue(card, ["individual_card_keyword", "keyword", "label", "eyebrow"]);
      var title = firstValue(card, ["heading", "title", "card_title"]);
      var text = firstValue(card, ["text", "body", "introduction", "description"]);
      var link = firstValue(card, ["link", "url", "href"]);
      var resolved = link ? PF.resolveLink(link) : "";
      var tag = resolved ? "a" : "div";
      var attrs = resolved
        ? ' href="' + esc(resolved) + '"' + PF.linkAttrs(resolved)
        : "";
      return "<" + tag + ' class="el-card"' + attrs + ">" +
        (keyword ? '<span class="el-card__keyword">' + format(keyword) + "</span>" : "") +
        (title ? '<span class="el-card__title">' + format(title) + "</span>" : "") +
        (text ? '<span class="el-card__text">' + format(text) + "</span>" : "") +
        (resolved ? '<span class="el-card__go">Read ' + PF.icon("outward") + "</span>" : "") +
        "</" + tag + ">";
    }).filter(Boolean).join("");

    if (!html) return "";
    return (heading ? headingLabel(heading) : "") +
      (intro ? '<p class="el-cards__intro">' + format(intro) + "</p>" : "") +
      '<div class="el-cards" style="--cols:' + columns + '">' + html + "</div>";
  };

  /* --- add_full_width_links --------------------------------------------- */
  RENDERERS.add_full_width_links = function (value) {
    var obj = isPlainObject(value) ? value : { links: value };
    var links = toArray(firstValue(obj, ["links", "items"]));
    if (!links.length) return "";
    var heading = firstValue(obj, ["heading", "title"]);

    var rows = links.map(function (link, index) {
      if (!isPlainObject(link)) return "";
      var label = firstValue(link, ["label", "text", "title"]);
      if (!label) return "";
      var href = PF.resolveLink(firstValue(link, ["link", "url", "href"]) || "");
      var note = firstValue(link, ["note", "meta", "kicker"]);
      var tag = href ? "a" : "div";
      return "<" + tag + ' class="el-link-row"' + (href ? ' href="' + esc(href) + '"' + PF.linkAttrs(href) : "") + ">" +
        '<span class="el-link-row__no">' + String(index + 1).padStart(2, "0") + "</span>" +
        '<span class="el-link-row__label">' + format(label) + "</span>" +
        (note ? '<span class="el-link-row__note">' + format(note) + "</span>" : '<span class="el-link-row__note"></span>') +
        '<span class="el-link-row__arrow">' + PF.icon("outward") + "</span>" +
        "</" + tag + ">";
    }).filter(Boolean).join("");

    if (!rows) return "";
    return (heading ? headingLabel(heading) : "") + '<div class="el-links">' + rows + "</div>";
  };

  /* --- add_image -------------------------------------------------------- */
  function figureHtml(item) {
    if (!isPlainObject(item)) item = { image_path: item };
    var path = firstValue(item, ["image_path", "image", "src", "photo"]);
    if (!path) return "";
    var alt = firstValue(item, ["image_alt", "alt", "alt_text"]) || "";
    var caption = firstValue(item, ["image_caption", "caption"]);
    var credit = firstValue(item, ["image_credit", "credit"]);
    var align = String(firstValue(item, ["align", "alignment"]) || "").toLowerCase();
    var zoom = item.zoom_on !== false && item.zoom !== false;
    var image = src(path);

    var cls = "el-figure" + (align === "right" ? " el-figure--right" : (align === "left" ? " el-figure--left" : ""));
    var zoomAttrs = zoom
      ? ' class="zoomable" data-lightbox="' + esc(image) + '" data-lightbox-alt="' + esc(alt) +
        '" data-lightbox-caption="' + esc(caption || "") + '"'
      : "";

    return '<figure class="' + cls + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(alt) + '" loading="lazy"' + zoomAttrs + ">" +
      ((caption || credit)
        ? "<figcaption>" +
          "<span>" + format(caption || "") + "</span>" +
          "<span>" + format(credit || "") + "</span>" +
          "</figcaption>"
        : "") +
      "</figure>";
  }

  RENDERERS.add_image = function (value) {
    return toArray(value).map(figureHtml).filter(Boolean).join("");
  };

  /* --- add_gallery ------------------------------------------------------ */
  var RATIOS = { "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1", "3:4": "3 / 4", "4:5": "4 / 5" };

  RENDERERS.add_gallery = function (value) {
    var obj = isPlainObject(value) ? value : { images: value };
    var images = toArray(firstValue(obj, ["images", "photos", "gallery"]));
    if (!images.length) return "";

    var heading = firstValue(obj, ["heading", "title"]);
    var columns = Math.min(Math.max(Number(obj.columns) || 2, 1), 4);
    var size = String(obj.size || obj.ratio || "").toLowerCase().replace("x", ":");
    var ratio = RATIOS[size] || "";
    var natural = size === "natural";

    var html = images.map(function (item) {
      if (!isPlainObject(item)) item = { image_path: item };
      var path = firstValue(item, ["image_path", "image", "src"]);
      if (!path) return "";
      var alt = firstValue(item, ["image_alt", "alt"]) || "";
      var caption = firstValue(item, ["image_caption", "caption"]);
      var credit = firstValue(item, ["image_credit", "credit"]);
      var zoom = item.zoom_on !== false;
      var image = src(path);
      return "<figure>" +
        '<img src="' + esc(image) + '" alt="' + esc(alt) + '" loading="lazy"' +
        (zoom ? ' class="zoomable" data-lightbox="' + esc(image) + '" data-lightbox-alt="' + esc(alt) +
          '" data-lightbox-caption="' + esc([caption, credit].filter(Boolean).join(" — ")) + '"' : "") + ">" +
        (caption || credit
          ? "<figcaption>" + format(caption || "") +
            (credit ? ' <span class="el-gallery__credit">' + format(credit) + "</span>" : "") +
            "</figcaption>"
          : "") +
        "</figure>";
    }).filter(Boolean).join("");

    if (!html) return "";
    return (heading ? headingLabel(heading) : "") +
      '<div class="el-gallery' + (natural ? " el-gallery--natural" : "") + '" style="--cols:' + columns +
      (ratio ? ";--ratio:" + ratio : "") + '">' + html + "</div>";
  };

  /* --- add_slideshow ---------------------------------------------------- */
  RENDERERS.add_slideshow = function (value) {
    var obj = isPlainObject(value) ? value : { images: value };
    var images = toArray(firstValue(obj, ["images", "photos", "slides"]));
    if (!images.length) return "";

    var heading = firstValue(obj, ["heading", "title"]);
    var interval = Math.max(Number(firstValue(obj, ["rotation_time_milliseconds", "interval", "speed"])) || 5000, 1500);

    var slides = images.map(function (item, index) {
      if (!isPlainObject(item)) item = { image_path: item };
      var path = firstValue(item, ["image_path", "image", "src"]);
      if (!path) return "";
      return '<img src="' + esc(src(path)) + '" alt="' + esc(firstValue(item, ["image_alt", "alt"]) || "") +
        '" data-slide="' + index + '"' + (index === 0 ? ' class="is-active"' : "") + ">";
    }).filter(Boolean).join("");

    var captions = images.map(function (item) {
      return isPlainObject(item) ? String(firstValue(item, ["image_caption", "caption"]) || "") : "";
    });

    var dots = images.map(function (item, index) {
      return '<button type="button" class="el-slideshow__dot' + (index === 0 ? " is-active" : "") +
        '" data-slide-to="' + index + '" aria-label="Show image ' + (index + 1) + '"></button>';
    }).join("");

    return (heading ? headingLabel(heading) : "") +
      '<div class="el-slideshow" data-slideshow data-interval="' + interval + '">' +
      '<div class="el-slideshow__stage">' + slides + "</div>" +
      '<div class="el-slideshow__bar">' +
      '<span data-slide-caption>' + esc(captions[0] || "") + "</span>" +
      '<span class="el-slideshow__dots">' + dots + "</span>" +
      '<span data-slide-count>01 / ' + String(images.length).padStart(2, "0") + "</span>" +
      "</div></div>";
  };

  /* --- add_people ------------------------------------------------------- */
  RENDERERS.add_people = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var people = toArray(firstValue(obj, ["people", "items", "add_people"]));
    if (!people.length) return "";

    var heading = firstValue(obj, ["heading", "title"]);
    var html = people.map(function (person) {
      if (!isPlainObject(person)) person = { name: person };
      var name = firstValue(person, ["name", "text"]);
      if (!name) return "";
      var role = firstValue(person, ["position", "role", "subtitle"]);
      var photo = firstValue(person, ["image_path", "image", "photo"]);
      var link = PF.resolveLink(firstValue(person, ["profile_link", "link", "url"]) || "");
      var tag = link ? "a" : "div";
      var initials = String(name).replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, "").split(/\s+/)
        .map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase();
      return "<" + tag + ' class="el-person"' + (link ? ' href="' + esc(link) + '"' + PF.linkAttrs(link) : "") + ">" +
        (photo
          ? '<img src="' + esc(src(photo)) + '" alt="' + esc(name) + '" loading="lazy">'
          : '<span class="el-person__placeholder" aria-hidden="true">' + esc(initials) + "</span>") +
        '<span class="el-person__name">' + format(name) + "</span>" +
        (role ? '<span class="el-person__role">' + format(role) + "</span>" : "") +
        "</" + tag + ">";
    }).filter(Boolean).join("");

    if (!html) return "";
    return (heading ? headingLabel(heading) : "") + '<div class="el-people">' + html + "</div>";
  };

  /* --- add_a_timeline --------------------------------------------------- */
  RENDERERS.add_a_timeline = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var items = toArray(firstValue(obj, ["items_of_the_timeline", "items", "steps"]));
    if (!items.length) return "";

    var heading = firstValue(obj, ["heading", "title"]);
    var html = items.map(function (item) {
      if (!isPlainObject(item)) item = { timeline_item_title: item };
      var when = firstValue(item, ["timeline_item_date", "date", "year"]);
      var title = firstValue(item, ["timeline_item_title", "title", "what"]);
      var note = firstValue(item, ["timeline_item_text", "text", "note"]);
      if (!when && !title) return "";
      return "<li>" +
        (when ? '<span class="el-timeline__when">' + format(when) + "</span>" : "") +
        (title ? '<span class="el-timeline__what">' + format(title) + "</span>" : "") +
        (note ? '<p class="el-timeline__note">' + format(note) + "</p>" : "") +
        "</li>";
    }).filter(Boolean).join("");

    if (!html) return "";
    return (heading ? headingLabel(heading) : "") + '<ol class="el-timeline">' + html + "</ol>";
  };

  /* --- add_tags --------------------------------------------------------- */
  RENDERERS.add_tags = function (value) {
    var tags = Array.isArray(value) ? value : toArray(value && value.tags);
    tags = tags.map(function (tag) {
      return isPlainObject(tag) ? firstValue(tag, ["tag", "text", "label"]) : tag;
    }).filter(Boolean);
    if (!tags.length) return "";
    return '<ul class="el-tags">' + tags.map(function (tag) {
      return '<li class="el-tag">' + format(tag) + "</li>";
    }).join("") + "</ul>";
  };

  /* --- add_button ------------------------------------------------------- */
  RENDERERS.add_button = function (value) {
    var buttons = Array.isArray(value) ? value : [value];
    var html = buttons.map(function (button) {
      if (!isPlainObject(button)) button = { label: button };
      var label = firstValue(button, ["label", "text", "title"]);
      if (!label) return "";
      var link = PF.resolveLink(firstValue(button, ["link", "url", "href"]) || "");
      var style = String(button.style || button.type || "fill").toLowerCase();
      var outline = style === "outline" || style === "ghost" || style === "secondary";
      var tag = link ? "a" : "span";
      return "<" + tag + ' class="el-btn' + (outline ? " el-btn--outline" : "") + '"' +
        (link ? ' href="' + esc(link) + '"' + PF.linkAttrs(link) : "") + ">" +
        format(label) + PF.icon("outward") + "</" + tag + ">";
    }).filter(Boolean).join("");
    return html ? '<div class="el-buttons">' + html + "</div>" : "";
  };

  /* --- add_divider ------------------------------------------------------ */
  RENDERERS.add_divider = function () {
    return '<hr class="el-divider">';
  };

  /* --- add_publication_or_more ------------------------------------------ */
  RENDERERS.add_publication_or_more = function (value) {
    var obj = isPlainObject(value) ? value : { items: value };
    var items = toArray(firstValue(obj, ["items", "publication_titles", "papers", "list", "publications"]));
    if (!items.length) return "";

    var heading = firstValue(obj, ["heading", "title"]);
    var showNumbers = obj.show_numbering !== false;

    var rows = items.map(function (item, index) {
      if (!isPlainObject(item)) item = { title: item };
      var title = firstValue(item, ["title", "publication_title", "name"]);
      if (!title) return "";
      var authors = firstValue(item, ["authors", "author", "by"]);
      var venue = firstValue(item, ["venue", "journal", "meta", "publisher"]);
      var year = firstValue(item, ["year", "date"]);
      var link = PF.resolveLink(firstValue(item, ["link", "url", "doi"]) || "");
      var titleHtml = link
        ? '<a href="' + esc(link) + '"' + PF.linkAttrs(link) + ">" + format(title) + "</a>"
        : format(title);
      var meta = [authors, venue].filter(Boolean).map(function (part) { return esc(String(part)); }).join(" &middot; ");
      return '<div class="el-pub">' +
        '<span class="el-pub__no">' + (showNumbers ? String(index + 1).padStart(2, "0") : "") + "</span>" +
        "<div>" +
        '<div class="el-pub__title">' + titleHtml + "</div>" +
        (meta ? '<div class="el-pub__meta">' + meta + "</div>" : "") +
        "</div>" +
        (year ? '<span class="el-pub__year">' + esc(year) + "</span>" : "<span></span>") +
        "</div>";
    }).filter(Boolean).join("");

    if (!rows) return "";
    return (heading ? headingLabel(heading) : "") + '<div class="el-pubs">' + rows + "</div>";
  };

  /* --- add_contact_information ----------------------------------------- */
  RENDERERS.add_contact_information = function (value) {
    var obj = isPlainObject(value) ? value : { email: value };
    var email = firstValue(obj, ["email", "address", "mail"]);
    if (!email) return "";
    var note = firstValue(obj, ["note", "label", "caption"]);
    return '<div class="el-contact">' +
      '<a class="el-contact__email" href="mailto:' + esc(email) + '">' + esc(email) + "</a>" +
      (note ? '<span class="el-contact__note">' + format(note) + "</span>" : "") +
      "</div>";
  };

  /* --- add_embed_media -------------------------------------------------- */
  function embedUrl(url) {
    var value = String(url || "");
    var youtube = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    if (youtube) return "https://www.youtube.com/embed/" + youtube[1];
    var vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return "https://player.vimeo.com/video/" + vimeo[1];
    return value;
  }

  RENDERERS.add_embed_media = function (value) {
    var obj = isPlainObject(value) ? value : { link: value };
    var link = firstValue(obj, ["link", "url", "src"]);
    if (!link) return "";
    var heading = firstValue(obj, ["heading", "title"]);
    var caption = firstValue(obj, ["caption", "text"]);
    var target = embedUrl(link);
    var isVideo = /youtube\.com\/embed|player\.vimeo\.com/.test(target);

    if (!isVideo) {
      return RENDERERS.add_full_width_links([{ label: link, link: link, note: "External" }]);
    }

    return (heading ? headingLabel(heading) : "") +
      '<figure class="el-embed">' +
      '<iframe src="' + esc(target) + '" title="' + esc(heading || "Embedded media") + '" ' +
      'loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      "allowfullscreen></iframe>" +
      (caption ? "<figcaption>" + format(caption) + "</figcaption>" : "") +
      "</figure>";
  };

  /* --- add_content_to_page ---------------------------------------------- */
  RENDERERS.add_content_to_page = function (value) {
    return toArray(value).map(function (entry) {
      if (!isPlainObject(entry)) return "";
      return Object.keys(entry).map(function (key) {
        return renderOne(key, entry[key]);
      }).join("");
    }).join("");
  };

  /* --- registry helpers ------------------------------------------------- */

  ALIASES.add_timeline = "add_a_timeline";
  ALIASES.add_publications = "add_publication_or_more";
  ALIASES.add_publication_list = "add_publication_or_more";
  ALIASES.add_embed = "add_embed_media";

  function rendererFor(key) {
    var name = ALIASES[key] || key;
    return RENDERERS[name];
  }

  function renderOne(key, value) {
    var renderer = rendererFor(key);
    if (!renderer) {
      if (/^add_/.test(key)) console.warn("[content] unknown element:", key);
      return "";
    }
    return renderer(value) || "";
  }

  /* Draw every `add_*` key of a section, in file order, expanding
     `add_content_to_page` where it stands. */
  function renderFlow(data) {
    if (!data || typeof data !== "object") return "";
    return Object.keys(data).map(function (key) {
      if (key !== "add_content_to_page" && key.indexOf("add_") !== 0) return "";
      return renderOne(key, data[key]);
    }).join("\n");
  }

  PF.elements = {
    render: renderOne,
    renderFlow: renderFlow,
    has: function (key) { return !!rendererFor(key); },
    registry: RENDERERS
  };
})(window);
