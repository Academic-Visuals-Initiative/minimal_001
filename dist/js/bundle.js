/* js/core.js */
/* ==========================================================================
   core.js — the small shared layer.

   Loads JSON, escapes text, resolves links and images, formats inline
   markup, owns the theme, the reveal animation, the lightbox and the
   credit line. No dependencies.
   ========================================================================== */
(function (global) {
  "use strict";

  var PF = {};

  /* The CV always opens in the bundled reader; only the PDF is configurable. */
  var CV_VIEWER = "pages/reader.html";

  /* --- data ------------------------------------------------------------- */

  PF.loadJson = function (url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Could not load " + url + " (" + res.status + ")");
      return res.json();
    });
  };

  /* --- small helpers ---------------------------------------------------- */

  PF.esc = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  PF.toArray = function (value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  };

  PF.slug = function (value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  PF.firstValue = function (obj, keys) {
    if (!obj) return undefined;
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null) return obj[keys[i]];
    }
    return undefined;
  };

  /* --- site context ----------------------------------------------------- */

  var site = null;

  PF.setSite = function (value) { site = value || null; };
  PF.site = function () { return site; };

  /* --- links ------------------------------------------------------------

     @about          the section with id "about"  →  #about
     @cv             the CV file from site.json
     @email          the address in site.json
     @top            the top of the page
     anything else   used as written (https://, mailto:, #, pages/…)
  ------------------------------------------------------------------------ */

  /* A written-out address without a scheme ("www.example.com" or
     "example.com/paper") is external; without one the browser reads it as a
     file sitting beside the page. Local names keep their extension. */
  function looksExternal(link) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return false;
    if (/^[#.?\/]/.test(link)) return false;
    if (/\s/.test(link)) return false;
    var host = link.split(/[\/?#]/)[0];
    if (!/^[^\/?#]+\.[a-z]{2,}$/i.test(host)) return false;
    return !/\.(html?|json|pdf|jpe?g|png|gif|webp|svg|css|js|md|txt|zip|mp4|webm|mp3|docx?|xlsx?|pptx?)$/i.test(host);
  }

  PF.resolveLink = function (value) {
    var link = String(value == null ? "" : value).trim();
    if (!link) return "";
    if (link.charAt(0) !== "@") {
      return looksExternal(link) ? "https://" + link : link;
    }

    var key = link.slice(1);
    if (key === "top") return "#top";
    if (key === "home") return "index.html";
    if (key === "email") return "mailto:" + (site && site.header && site.header.email ? site.header.email : "");
    if (key === "cv") {
      var cv = site && site.header && site.header.cv;
      return cv && cv.file ? CV_VIEWER : "";
    }

    /* @pages.folder.file → page.html?page=folder/file
       (also @page.… and slashes: @pages/folder/file) */
    var pageKey = key.match(/^pages?[./](.+)$/i);
    if (pageKey) {
      var path = pageKey[1].replace(/\.json$/i, "").replace(/[./]+/g, "/")
        .replace(/^\/+|\/+$/g, "");
      return path ? "page.html?page=" + path : "";
    }

    /* @research.soil_microbiome → #research when that section exists. */
    var ids = (site && site.sections || []).map(function (entry) {
      return typeof entry === "string" ? entry : (entry && entry.id);
    });
    var head = key.split(".")[0];
    if (key.indexOf(".") > -1 && ids.indexOf(head) > -1) return "#" + PF.slug(head);

    return "#" + PF.slug(key);
  };

  PF.isExternal = function (link) {
    return /^(https?:)?\/\//.test(String(link || ""));
  };

  PF.linkAttrs = function (link) {
    return PF.isExternal(link) ? ' target="_blank" rel="noopener"' : "";
  };

  /* --- images -----------------------------------------------------------

     a bare filename reads from assets/images/; a path is used as written.
  ------------------------------------------------------------------------ */

  PF.imageSrc = function (value) {
    var src = String(value == null ? "" : value).trim();
    if (!src) return "";
    if (/^(https?:)?\/\//.test(src) || src.indexOf("data:") === 0 || src.indexOf("//") === 0) return src;
    if (src.charAt(0) === "/" || src.indexOf("/") > -1) return src;
    return "assets/images/" + src;
  };

  /* --- inline markup ----------------------------------------------------

     **bold**  *italic*  ***both***  ++underline++  ~~strike~~
     ^super^  ~sub~  ==highlight==  `code`  [label](link)  {text|url}
     A backslash escapes the next character: \* \~ \` \{ \n
     A newline becomes a line break.
  ------------------------------------------------------------------------ */

  PF.formatText = function (value) {
    var text = String(value == null ? "" : value);
    if (!text) return "";

    /* Escaped characters are lifted out first, so they can never be read as
       markup, and put back as literal text at the end. */
    var escapes = [];
    text = text.replace(/\\(.)/g, function (m, ch) {
      escapes.push(ch);
      return "\u0000E" + (escapes.length - 1) + "\u0000";
    });

    var codes = [];
    var out = PF.esc(text);

    out = out.replace(/`([^`]+)`/g, function (m, code) {
      codes.push(code);
      return "\u0000C" + (codes.length - 1) + "\u0000";
    });

    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
      var raw = href.replace(/&amp;/g, "&");
      var link = PF.resolveLink(raw);
      if (!link) return label;
      return '<a href="' + PF.esc(link) + '"' + PF.linkAttrs(link) + ">" + label + "</a>";
    });

    out = out.replace(/\{([^}|]+)\|([^}]+)\}/g, function (m, label, href) {
      var raw = href.replace(/&amp;/g, "&").trim();
      var link = PF.resolveLink(raw);
      if (!link) return label;
      return '<a href="' + PF.esc(link) + '"' + PF.linkAttrs(link) + "><strong>" + label + "</strong></a>";
    });

    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    out = out.replace(/\+\+([^+\n]+)\+\+/g, "<u>$1</u>");
    out = out.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
    out = out.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    out = out.replace(/\^([^^\n]+)\^/g, "<sup>$1</sup>");
    out = out.replace(/(^|[^~])~([^~\n]+)~/g, "$1<sub>$2</sub>");
    out = out.replace(/\n/g, "<br>");

    out = out.replace(/\u0000C(\d+)\u0000/g, function (m, index) {
      return "<code>" + codes[Number(index)] + "</code>";
    });

    out = out.replace(/\u0000E(\d+)\u0000/g, function (m, index) {
      return PF.esc(escapes[Number(index)]);
    });

    return out;
  };

  /* --- icons ------------------------------------------------------------ */

  PF.icon = function (name) {
    var paths = {
      outward: '<path d="M4.5 11.5 11.5 4.5M5.6 4.5h5.9v5.9"/>',
      right: '<path d="M2.5 8h11M9.5 4l4 4-4 4"/>',
      down: '<path d="M8 2.5v11M4 9.5l4 4 4-4"/>'
    };
    return '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" ' +
      'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (paths[name] || paths.right) + "</svg>";
  };

  PF.socialIcon = function (name) {
    if (!name) return "";
    return '<img src="assets/icons/social/' + PF.esc(name) + '.svg" alt="" width="15" height="15" loading="lazy">';
  };

  /* --- theme ------------------------------------------------------------ */

  var THEME_KEY = "portfolio-theme";

  PF.theme = function () {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  };

  PF.applyTheme = function (value) {
    var next = value === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    var meta = document.getElementById("themeColor");
    if (meta) meta.setAttribute("content", next === "dark" ? "#121210" : "#f4f1e9");
    document.dispatchEvent(new CustomEvent("pf:theme", { detail: next }));
  };

  PF.toggleTheme = function () {
    PF.applyTheme(PF.theme() === "dark" ? "light" : "dark");
  };

  /* --- document metadata ------------------------------------------------ */

  PF.applyMeta = function (data) {
    var title = data.title || "Portfolio";
    document.title = title;

    function set(selector, attribute, value) {
      var node = document.querySelector(selector);
      if (node && value != null) node.setAttribute(attribute, value);
    }

    set('meta[name="description"]', "content", data.description || "");
    set('meta[name="author"]', "content", data.author || (data.header && data.header.name) || "");
    set("#ogTitle", "content", title);
    set("#ogDescription", "content", data.description || "");
    set("#ogUrl", "content", location.origin + location.pathname);
    set("#canonical", "href", location.origin + location.pathname);

    if (data.header && data.header.image_path) {
      var image = /^https?:/.test(data.header.image_path)
        ? data.header.image_path
        : location.origin + location.pathname.replace(/[^/]*$/, "") + PF.imageSrc(data.header.image_path);
      var ogImage = document.getElementById("ogImage");
      if (ogImage) ogImage.setAttribute("content", image);
    }

    if (data.favicon) {
      var icon = document.getElementById("favicon");
      if (icon) icon.setAttribute("href", data.favicon);
    }

    if (data.theme && data.theme.accent) {
      document.documentElement.style.setProperty("--accent-base", data.theme.accent);
    }
  };

  /* --- reveal ----------------------------------------------------------- */

  PF.reveal = function (nodes) {
    var list = Array.prototype.slice.call(nodes || []);
    if (!list.length) return;

    var reduced = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in global)) {
      list.forEach(function (node) { node.classList.add("is-in"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });

    list.forEach(function (node) { io.observe(node); });
  };

  /* --- lightbox --------------------------------------------------------- */

  var lastFocus = null;

  function closeLightbox() {
    var box = document.getElementById("lightbox");
    if (!box || box.hidden) return;
    box.hidden = true;
    document.body.classList.remove("is-locked");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function openLightbox(trigger) {
    var box = document.getElementById("lightbox");
    var image = document.getElementById("lightboxImage");
    var caption = document.getElementById("lightboxCaption");
    if (!box || !image) return;

    var src = trigger.getAttribute("data-lightbox");
    if (!src) return;

    lastFocus = document.activeElement;
    image.setAttribute("src", src);
    image.setAttribute("alt", trigger.getAttribute("data-lightbox-alt") || "");
    if (caption) caption.textContent = trigger.getAttribute("data-lightbox-caption") || "";
    box.hidden = false;
    document.body.classList.add("is-locked");
    var close = box.querySelector("[data-lightbox-close]");
    if (close) close.focus();
  }

  PF.initLightbox = function () {
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-lightbox]");
      if (trigger) {
        event.preventDefault();
        openLightbox(trigger);
        return;
      }
      if (event.target.closest("[data-lightbox-close]")) {
        event.preventDefault();
        closeLightbox();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLightbox();
    });
  };

  /* --- slideshows -------------------------------------------------------
     Auto-advance every data-interval ms, dots jump to a slide, and the
     caption/credit/count travel with the picture. Motion stops on hover,
     keyboard focus, a hidden tab, or when reduced motion is requested.
  ------------------------------------------------------------------------ */

  PF.initSlideshows = function (root) {
    var scope = root || document;
    var shows = scope.querySelectorAll("[data-slideshow]");
    if (!shows.length) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Array.prototype.forEach.call(shows, function (show) {
      if (show.getAttribute("data-slideshow-ready")) return;
      show.setAttribute("data-slideshow-ready", "1");

      var images = Array.prototype.slice.call(show.querySelectorAll("[data-slide]"));
      var dots = Array.prototype.slice.call(show.querySelectorAll("[data-slide-to]"));
      if (!images.length) return;

      var captionEl = show.querySelector("[data-slide-caption]");
      var countEl = show.querySelector("[data-slide-count]");
      var interval = Math.max(Number(show.getAttribute("data-interval")) || 5000, 1500);
      var index = 0;
      var timer = null;

      function pad(n) { return String(n).padStart(2, "0"); }

      function paint(next) {
        index = (next + images.length) % images.length;
        images.forEach(function (img, i) {
          img.classList.toggle("is-active", i === index);
        });
        dots.forEach(function (dot, i) {
          dot.classList.toggle("is-active", i === index);
          if (i === index) dot.setAttribute("aria-current", "true");
          else dot.removeAttribute("aria-current");
        });
        if (captionEl) {
          var caption = images[index].getAttribute("data-caption") || "";
          var credit = images[index].getAttribute("data-credit") || "";
          captionEl.textContent = credit ? (caption ? caption + " — " + credit : credit) : caption;
          captionEl.setAttribute("title", captionEl.textContent);
        }
        if (countEl) countEl.textContent = pad(index + 1) + " / " + pad(images.length);
      }

      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
      }

      function start() {
        stop();
        if (reduce || document.hidden || !visible) return;
        timer = setInterval(function () { paint(index + 1); }, interval);
      }

      dots.forEach(function (dot) {
        dot.addEventListener("click", function () {
          paint(Number(dot.getAttribute("data-slide-to")) || 0);
          start();
        });
      });

      show.addEventListener("mouseenter", stop);
      show.addEventListener("mouseleave", start);
      show.addEventListener("focusin", stop);
      show.addEventListener("focusout", function (event) {
        if (!show.contains(event.relatedTarget)) start();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
      });

      var visible = !("IntersectionObserver" in window);
      if ("IntersectionObserver" in window) {
        var observer = new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start(); else stop();
        }, { threshold: 0.15 });
        observer.observe(show);
      }

      paint(0);
      start();
    });
  };

  /* --- card masonry -------------------------------------------------------
     Card groups with pictures are balanced into columns by height. Cards keep
     their own height; the shorter column takes the next card. On phones the
     cards return to a single column in their original order.
  ------------------------------------------------------------------------ */

  PF.initCardMasonry = function (root) {
    var scope = root || document;
    var lists = scope.querySelectorAll(".el-cards--masonry");
    if (!lists.length) return;

    function columnCount(list) {
      if (window.matchMedia && window.matchMedia("(max-width: 760px)").matches) return 1;
      var n = parseInt(getComputedStyle(list).getPropertyValue("--cols"), 10) || 2;
      if (window.matchMedia && window.matchMedia("(max-width: 1100px)").matches) n = Math.min(n, 2);
      return Math.max(1, Math.min(n, 4));
    }

    Array.prototype.forEach.call(lists, function (list) {
      if (list.getAttribute("data-card-masonry-ready")) {
        if (list._masonryLayout) list._masonryLayout(true);
        return;
      }
      list.setAttribute("data-card-masonry-ready", "1");

      var cards = Array.prototype.slice.call(list.querySelectorAll(".el-card"));
      if (!cards.length) return;

      function reset() {
        cards.forEach(function (card) { list.appendChild(card); });
        Array.prototype.forEach.call(list.querySelectorAll(".el-cards__col"), function (col) {
          col.parentNode.removeChild(col);
        });
      }

      function layout(force) {
        var count = columnCount(list);
        if (!force && list._masonryCount === count) return;
        list._masonryCount = count;
        reset();
        list.classList.remove("el-cards--solo");

        var visible = cards.filter(function (card) {
          return !card.classList.contains("is-filtered");
        });
        if (!visible.length) return;
        if (count < 2 || visible.length === 1) {
          if (count > 1 && visible.length === 1) list.classList.add("el-cards--solo");
          return;
        }

        var cols = [];
        var sums = [];
        for (var i = 0; i < count; i += 1) {
          var col = document.createElement("div");
          col.className = "el-cards__col";
          list.appendChild(col);
          cols.push(col);
          sums.push(0);
        }
        /* Even counts split in order, so the last two cards sit below their
           partners (1,3 left and 2,4 right). Odd counts use the shorter
           column so the last card does not leave a hole. */
        if (visible.length % 2 === 0) {
          visible.forEach(function (card, index) {
            cols[index % count].appendChild(card);
          });
          return;
        }
        visible.forEach(function (card) {
          var target = 0;
          for (var i = 1; i < sums.length; i += 1) {
            if (sums[i] < sums[target]) target = i;
          }
          cols[target].appendChild(card);
          sums[target] += card.getBoundingClientRect().height + 14;
        });
      }

      list._masonryLayout = layout;
      layout(true);

      if (!PF._cardMasonryWired) {
        PF._cardMasonryWired = true;
        var scheduled = false;
        function relayout(force) {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(function () {
            scheduled = false;
            Array.prototype.forEach.call(document.querySelectorAll(".el-cards--masonry"), function (el) {
              if (el._masonryLayout) el._masonryLayout(force);
            });
          });
        }
        window.addEventListener("resize", function () { relayout(true); });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(function () { relayout(true); });
        }
      }
    });
  };

  PF.refreshCardMasonry = function (root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll(".el-cards--masonry"), function (list) {
      if (list._masonryLayout) list._masonryLayout(true);
    });
  };

  /* --- category filters --------------------------------------------------
     Tags are filter metadata. A bar carries data-filter-for="<group>" and
     hides items whose data-tags do not include the chosen slug. Bars work
     independently; clicking the active category again clears it.
  ------------------------------------------------------------------------ */

  PF.initFilters = function (root) {
    var scope = root || document;
    var bars = scope.querySelectorAll("[data-filter-for]");
    if (!bars.length) return;

    Array.prototype.forEach.call(bars, function (bar) {
      if (bar.getAttribute("data-filter-ready")) return;
      bar.setAttribute("data-filter-ready", "1");

      var group = bar.getAttribute("data-filter-for");
      if (!group) return;
      var items = Array.prototype.slice.call(scope.querySelectorAll(
        '[data-filter-group="' + group.replace(/"/g, '\\"') + '"][data-tags]'
      ));
      var buttons = Array.prototype.slice.call(bar.querySelectorAll("[data-filter-tag]"));
      if (!buttons.length || !items.length) return;

      /* A featured paper rendered after the list can add categories the bar
         did not know about. Add any missing tag as a new button. */
      var present = {};
      buttons.forEach(function (button) {
        present[button.getAttribute("data-filter-tag")] = true;
      });
      items.forEach(function (item) {
        var labels = (item.getAttribute("data-tag-labels") || "").split("|");
        labels.forEach(function (label) {
          label = label.trim();
          var slug = PF.slug(label);
          if (!label || !slug || present[slug]) return;
          var button = document.createElement("button");
          button.type = "button";
          button.className = "el-filter__btn";
          button.setAttribute("data-filter-tag", slug);
          button.setAttribute("aria-pressed", "false");
          button.textContent = label;
          bar.appendChild(button);
          buttons.push(button);
          present[slug] = true;
        });
      });

      function apply(slug) {
        buttons.forEach(function (button) {
          var active = button.getAttribute("data-filter-tag") === slug;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        items.forEach(function (item) {
          var tags = (item.getAttribute("data-tags") || "").split(/\s+/);
          item.classList.toggle("is-filtered", !!slug && tags.indexOf(slug) < 0);
        });
        if (PF.refreshCardMasonry) PF.refreshCardMasonry(scope);
      }

      buttons.forEach(function (button) {
        button.addEventListener("click", function () {
          var slug = button.getAttribute("data-filter-tag") || "";
          var active = button.classList.contains("is-active");
          apply(active && slug ? "" : slug);
        });
      });
    });
  };

  /* Bars marked data-filter-position="top" move to the start of their
     section's flow, so a publication filter can sit above a featured paper. */
  PF.placeFilters = function (root) {
    var scope = root || document;
    var bars = scope.querySelectorAll('[data-filter-position="top"]');
    Array.prototype.forEach.call(bars, function (bar) {
      var section = bar.closest ? bar.closest(".section") : null;
      if (!section) return;
      var flow = section.querySelector(".flow");
      if (!flow || flow.firstElementChild === bar) return;
      flow.insertBefore(bar, flow.firstElementChild);
    });
  };

  /* --- credit line ------------------------------------------------------
     The credit line is part of the licence, not content. If something
     strips it from the page, it is put back.
  ------------------------------------------------------------------------ */

  PF.guardCredits = function () {
    var footer = document.getElementById("footer");
    if (!footer) return;
    var credits = footer.querySelector("[data-credits]");
    if (!credits) return;

    var markup = credits.outerHTML;

    var observer = new MutationObserver(function () {
      if (!footer.querySelector("[data-credits]")) {
        footer.insertAdjacentHTML("beforeend", markup);
      }
      if (!document.querySelector("[data-credits]")) {
        footer.insertAdjacentHTML("beforeend", markup);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  global.PF = PF;
})(window);


/* js/schema.js */
/* ==========================================================================
   schema.js — the canonical content keys, in one place.

   Loaded after core.js and before elements.js. Every element resolves a
   shared concept through PF.schema.pick(), so a key is renamed in one file
   rather than in every renderer. The first name in each list is canonical;
   the rest are kept so older JSON keeps working.
   ========================================================================== */
(function (global) {
  "use strict";

  var PF = global.PF || (global.PF = {});

  var fields = {
    heading: ["heading", "title", "label"],
    subheading: ["subheading", "eyebrow"],
    intro: ["intro", "introduction"],
    text: ["text", "body", "content", "description"],
    additionalInfo: ["additional_info", "meta"],
    link: ["link", "url", "href", "doi"],
    image: ["image_path", "image", "src", "photo"],
    imageAlt: ["image_alt", "alt", "alt_text"],
    caption: ["image_caption", "caption"],
    credit: ["image_credit", "credit"],
    tags: ["tags", "categories", "category", "keywords"],
    column: ["column", "column_position"],
    align: ["align", "alignment"]
  };

  var canonical = {};
  Object.keys(fields).forEach(function (field) {
    canonical[field] = fields[field][0];
  });

  /* alias → canonical, for the migration checker */
  var aliases = {};
  Object.keys(fields).forEach(function (field) {
    fields[field].slice(1).forEach(function (alias) {
      aliases[alias] = canonical[field];
    });
  });

  PF.schema = {
    version: 1,
    fields: fields,
    canonical: canonical,
    aliases: aliases,

    /* The first present key, canonical first. */
    pick: function (obj, field) {
      if (!obj || typeof obj !== "object") return undefined;
      var keys = fields[field];
      if (!keys) return obj[field];
      for (var i = 0; i < keys.length; i += 1) {
        if (obj[keys[i]] != null) return obj[keys[i]];
      }
      return undefined;
    },

    /* True when a key is a known alias (not the canonical spelling). */
    isAlias: function (key) {
      return Object.prototype.hasOwnProperty.call(aliases, key);
    },

    canonicalFor: function (key) {
      return aliases[key] || key;
    }
  };
})(window);


/* js/elements.js */
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
  var S = PF.schema;
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

  /* Tags: an array, a comma-separated string, or { tag, text, label, name }
     objects. Plain text, used as filter metadata rather than printed. */
  function tagValues(value) {
    var raw = Array.isArray(value)
      ? value
      : (typeof value === "string" ? value.split(",") : toArray(value));
    return raw.map(function (tag) {
      if (isPlainObject(tag)) tag = firstValue(tag, ["tag", "text", "label", "name"]);
      return String(tag == null ? "" : tag).trim();
    }).filter(Boolean);
  }

  PF.render = {
    registry: RENDERERS,
    aliases: ALIASES,
    esc: esc,
    format: format,
    src: src,
    isPlainObject: isPlainObject,
    firstValue: firstValue,
    toArray: toArray,
    headingLabel: headingLabel,
    paragraphs: paragraphs,
    tagValues: tagValues
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
  ALIASES.add_teaching = "add_teaching_items";
  ALIASES.add_courses = "add_teaching_items";
  ALIASES.add_course = "add_teaching_items";
  ALIASES.add_expandables = "add_expandable_information";
  ALIASES.add_expandable_items = "add_expandable_information";

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
    typeset: function (root) {
      return PF.render.typeset ? PF.render.typeset(root) : undefined;
    },
    has: function (key) { return !!rendererFor(key); },
    registry: RENDERERS
  };
})(window);



/* js/render/text.js */
/* ==========================================================================
   render/<family>.js — renderers registered into PF.render.registry.
   Loaded after elements.js and before app.js.
   ========================================================================== */
(function (PF) {
  "use strict";
  var R = PF.render;
  var esc = R.esc, format = R.format, src = R.src;
  var isPlainObject = R.isPlainObject, firstValue = R.firstValue;
  var toArray = R.toArray, headingLabel = R.headingLabel, paragraphs = R.paragraphs;
  var tagValues = R.tagValues;
  var S = PF.schema;
  var RENDERERS = R.registry;
  /* --- add_heading ------------------------------------------------------ */
  RENDERERS.add_heading = function (value) {
    var obj = isPlainObject(value) ? value : { heading_text: value };
    var level = Math.min(Math.max(Number(obj.level) || 3, 1), 4);
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
    var heading = firstValue(obj, S.fields.heading);
    var lead = obj.is_lead === true || obj.lead === true;
    var layout = String(firstValue(obj, [
      "layout_of_the_paragraph", "layout", "paragraph_layout"
    ]) || "").trim().toLowerCase();
    var twoCol = /^(two|2)[-_ ]?col/.test(layout) || layout === "columns" || layout === "two";
    var body = paragraphs(text);
    if (!body) return "";
    if (twoCol) body = '<div class="el-prose__cols">' + body + "</div>";
    return '<div class="el-prose' + (lead ? " el-prose--lead" : "") +
      (twoCol ? " el-prose--two-col" : "") + '">' +
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
    if (isPlainObject(item)) {
      return firstValue(item, ["list_item", "text", "item", "label", "value", "list_item_text"]);
    }
    return item;
  }

  /* --- list styles -------------------------------------------------------
     One name per marker. Ordered styles use a CSS counter, the rest a glyph. */
  var LIST_STYLES = {
    number: "number", decimal: "number", "decimal-leading-zero": "number",
    roman: "roman", "lower-roman": "roman",
    "roman-upper": "roman-upper", "upper-roman": "roman-upper",
    alpha: "alpha", "lower-alpha": "alpha",
    "alpha-upper": "alpha-upper", "upper-alpha": "alpha-upper",
    bullet: "bullet", disc: "bullet", default: "bullet",
    dash: "dash", en: "dash",
    square: "square", circle: "circle",
    check: "check", tick: "check",
    arrow: "arrow",
    inline: "inline", chips: "inline",
    none: "none"
  };

  function listStyle(value, fallback) {
    var key = String(value == null ? "" : value).trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
    return LIST_STYLES[key] || fallback || "bullet";
  }

  /* Items may carry a level; they are drawn as nested lists so numbering and
     indentation follow the structure. */
  function listTree(items) {
    var roots = [];
    var stack = [];
    items.forEach(function (item) {
      var text = itemText(item);
      if (text == null || String(text).trim() === "") return;
      var level = isPlainObject(item) ? Number(item.level || item.list_level || 1) : 1;
      level = Math.min(Math.max(level || 1, 1), 4);

      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();

      var node = { text: String(text), level: level, children: [] };
      if (!stack.length) roots.push(node);
      else stack[stack.length - 1].node.children.push(node);
      stack.push({ level: level, node: node });
    });
    return roots;
  }

  function renderListNodes(nodes, level, styles) {
    var style = styles[level - 1] || "bullet";
    var ordered = style === "number" || style === "roman" ||
      style === "roman-upper" || style === "alpha" || style === "alpha-upper";
    var tag = ordered ? "ol" : "ul";
    var html = nodes.map(function (node) {
      var inner = format(node.text);
      if (node.children && node.children.length) {
        inner += renderListNodes(node.children, Math.min(level + 1, 4), styles);
      }
      return "<li>" + inner + "</li>";
    }).join("");
    return "<" + tag + ' class="el-list el-list--' + style + ' el-list--level-' + level + '">' +
      html + "</" + tag + ">";
  }

  RENDERERS.add_list = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var items = listItems(value, ["add_items_to_list", "items", "list"]);
    if (!items.length) return "";

    var heading = firstValue(obj, S.fields.heading);
    var base = listStyle(firstValue(obj, ["style", "list_style", "list_type"]), "bullet");
    var styles = [1, 2, 3, 4].map(function (level) {
      return listStyle(obj["list_level_" + level + "_style"], base);
    });

    var tree = listTree(items);
    if (!tree.length) return "";

    return headingLabel(heading) + renderListNodes(tree, 1, styles);
  };


  /* --- add_focus_list --------------------------------------------------- */
  RENDERERS.add_focus_list = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var items = listItems(value, ["items_of_the_focus_list", "items", "focus"]);
    if (!items.length) return "";
    var heading = firstValue(obj, S.fields.heading);
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
      var heading = firstValue(obj, S.fields.heading);
      var author = firstValue(obj, ["author_of_the_quote", "author", "name"]);
      var role = firstValue(obj, ["position_of_the_author", "position", "role"]);
      var who = [author, role].filter(Boolean).map(function (part) {
        return esc(String(part));
      }).join(", ");
      return (heading ? headingLabel(heading) : "") +
        '<figure class="el-quote">' +
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
    red: "red", danger: "red", error: "red",
    dark: "dark", neutral: "dark",
    accent: "accent", primary: "accent"
  };

  /* A custom icon may be a bare name (assets/icons/custom_icons/name.svg),
     a path, or a full URL. "icon": false turns the icon off. */
  function noteIcon(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    if (/^(https?:)?\/\//.test(raw) || raw.charAt(0) === "/" || raw.indexOf("assets/") === 0 || raw.indexOf("/") > -1) {
      return raw;
    }
    return "assets/icons/custom_icons/" + (/\.(svg|png|jpe?g|webp)$/i.test(raw) ? raw : raw + ".svg");
  }

  /* Light text on a custom background needs a light icon. */
  function isLightColour(value) {
    var hex = String(value || "").trim().replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
    var r = parseInt(hex.slice(0, 2), 16) / 255;
    var g = parseInt(hex.slice(2, 4), 16) / 255;
    var b = parseInt(hex.slice(4, 6), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.6;
  }

  RENDERERS.add_special_note = function (value) {
    return toArray(value).map(function (item) {
      var obj = isPlainObject(item) ? item : { text: item };
      var text = firstValue(obj, ["text", "special_note", "note", "content"]);
      if (!text) return "";
      var heading = firstValue(obj, S.fields.heading);
      var tone = NOTE_TONES[String(obj.colour || obj.color || "accent").toLowerCase()] || "accent";
      var icon = firstValue(obj, ["special_note_icon", "note_icon", "icon"]);
      var bg = firstValue(obj, ["background_colour", "background_color"]);
      var fg = firstValue(obj, ["text_colour", "text_color"]);
      var custom = !!(bg || fg);

      var classes = "el-note el-note--" + tone +
        (custom ? " el-note--custom" : "") +
        (custom && isLightColour(fg) ? " el-note--on-dark" : "");
      var style = custom
        ? ' style="' + (bg ? "background-color:" + esc(String(bg)) + ";" : "") +
          (fg ? "color:" + esc(String(fg)) + ";" : "") + '"'
        : "";

      var iconHtml = icon && typeof icon === "string"
        ? '<img class="el-note__icon" src="' + esc(noteIcon(icon)) + '" alt="" width="18" height="18" loading="lazy">'
        : "";

      return '<aside class="' + classes + '"' + style + ">" +
        iconHtml +
        '<div class="el-note__body">' +
        (heading ? '<p class="el-note__label">' + format(heading) + "</p>" : "") +
        '<div class="el-note__text">' + paragraphs(text) + "</div>" +
        "</div></aside>";
    }).filter(Boolean).join("");
  };


  /* --- add_tags --------------------------------------------------------- */
  RENDERERS.add_tags = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var tags = tagValues(Array.isArray(value) ? value : (isPlainObject(value) ? firstValue(value, S.fields.tags) : value));
    if (!tags.length) return "";
    var heading = firstValue(obj, S.fields.heading);
    return (heading ? headingLabel(heading) : "") +
      '<ul class="el-tags">' + tags.map(function (tag) {
        return '<li class="el-tag">' + esc(tag) + "</li>";
      }).join("") + "</ul>";
  };

})(window.PF);


/* js/render/data.js */
/* ==========================================================================
   render/<family>.js — renderers registered into PF.render.registry.
   Loaded after elements.js and before app.js.
   ========================================================================== */
(function (PF) {
  "use strict";
  var R = PF.render;
  var esc = R.esc, format = R.format, src = R.src;
  var isPlainObject = R.isPlainObject, firstValue = R.firstValue;
  var toArray = R.toArray, headingLabel = R.headingLabel, paragraphs = R.paragraphs;
  var tagValues = R.tagValues;
  var S = PF.schema;
  var RENDERERS = R.registry;
  /* --- add_table -------------------------------------------------------- */
  function splitCells(value) {
    if (Array.isArray(value)) {
      return value.map(function (cell) { return String(cell == null ? "" : cell).trim(); });
    }
    var text = String(value == null ? "" : value);
    var cells = [];
    var cell = "";
    var quoted = false;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (quoted) {
        if (ch === '"' && text.charAt(i + 1) === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"' && cell.trim() === "") {
        quoted = true;
        cell = "";
      } else if (ch === ",") {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  /* A filter bar is added when a group has two or more distinct tags. The
     tag text is shown once above the items; items keep slugs in data-tags. */
  var filterSeq = 0;

  /* A publication group ties a featured paper and a list together: one tag
     set and one filter bar. */
  var publicationGroups = {};
  /* A featured paper automatically joins the next publication list. */
  var pendingPublication = null;
  function publicationGroup(raw) {
    var key = PF.slug(String(raw == null ? "" : raw).trim());
    if (!key) return null;
    if (!publicationGroups[key]) publicationGroups[key] = { tags: [] };
    return publicationGroups[key];
  }

  function filterBar(tags, label, group, position) {
    var unique = [];
    tags.forEach(function (tag) {
      if (unique.indexOf(tag) < 0) unique.push(tag);
    });
    if (unique.length < 2) return "";
    return '<div class="el-filter" role="group" aria-label="' + esc(label) + '"' +
      ' data-filter-for="' + esc(group) + '"' +
      (position === "top" ? ' data-filter-position="top"' : "") + ">" +
      '<button type="button" class="el-filter__btn is-active" data-filter-tag="" aria-pressed="true">All</button>' +
      unique.map(function (tag) {
        return '<button type="button" class="el-filter__btn" data-filter-tag="' +
          esc(PF.slug(tag)) + '" aria-pressed="false">' + esc(tag) + "</button>";
      }).join("") +
      "</div>";
  }

  function tagSlugs(tags) {
    return tags.map(function (tag) { return PF.slug(tag); }).join(" ");
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

    var heading = firstValue(obj, S.fields.heading);
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
    var single = false;
    if (!cards.length && (obj.heading || obj.individual_card_keyword)) {
      cards = [obj];
      single = true;
    }
    if (!cards.length) return "";

    var columns = single ? 1 : Math.min(Math.max(Number(obj.columns) || 3, 1), 4);
    /* A lone card uses its own heading/text; it is not a group with an
       intro, so those keys belong to the card only. */
    var heading = single ? "" : firstValue(obj, S.fields.heading);
    var intro = single ? "" : firstValue(obj, S.fields.intro);
    var showCategories = obj.show_categories !== false && obj.filter !== false;
    var position = String(obj.filter_position || "").toLowerCase();
    var group = "cards-" + (filterSeq += 1);
    var hasMedia = cards.some(function (card) {
      return isPlainObject(card) && firstValue(card, S.fields.image);
    });

    var groupTags = [];
    var html = cards.map(function (card) {
      if (!isPlainObject(card)) return "";
      var keyword = firstValue(card, ["individual_card_keyword", "keyword", "label", "subheading", "eyebrow"]);
      var title = firstValue(card, ["heading", "title", "card_title"]);
      var text = firstValue(card, ["text", "body", "introduction", "description"]);
      var meta = firstValue(card, ["additional_info", "meta", "note", "date", "details"]);
      var tags = tagValues(firstValue(card, S.fields.tags));
      tags.forEach(function (name) {
        if (groupTags.indexOf(name) < 0) groupTags.push(name);
      });
      var image = firstValue(card, S.fields.image);
      var alt = firstValue(card, S.fields.imageAlt) || "";
      var fit = String(firstValue(card, ["image_fit", "fit", "object_fit"]) || "cover").toLowerCase();
      var link = firstValue(card, S.fields.link);
      var resolved = link ? PF.resolveLink(link) : "";
      var tag = resolved ? "a" : "div";
      var attrs = resolved
        ? ' href="' + esc(resolved) + '"' + PF.linkAttrs(resolved)
        : "";
      var tagAttr = tags.length
        ? ' data-filter-group="' + esc(group) + '" data-tags="' + esc(tagSlugs(tags)) + '"'
        : "";
      return "<" + tag + ' class="el-card' + (image ? " el-card--media" : "") + '"' + attrs + tagAttr + ">" +
        (image
          ? '<span class="el-card__media"><img src="' + esc(src(image)) + '" alt="' + esc(alt) +
            '" loading="lazy" style="object-fit:' + (fit === "contain" ? "contain" : "cover") + '"></span>'
          : "") +
        (keyword ? '<span class="el-card__keyword">' + format(keyword) + "</span>" : "") +
        (title ? '<span class="el-card__title">' + format(title) + "</span>" : "") +
        (text ? '<span class="el-card__text">' + format(text) + "</span>" : "") +
        (meta ? '<span class="el-card__meta">' + format(meta) + "</span>" : "") +
        (resolved ? '<span class="el-card__go">Read ' + PF.icon("outward") + "</span>" : "") +
        "</" + tag + ">";
    }).filter(Boolean).join("");

    if (!html) return "";
    var bar = showCategories && cards.length > 1
      ? filterBar(groupTags, "Filter projects by category", group, position)
      : "";
    var masonry = !single && cards.length > 1 && hasMedia;
    var list = '<div class="el-cards' + (single ? " el-cards--single" : "") +
      (masonry ? " el-cards--masonry" : "") +
      '" style="--cols:' + columns + '">' + html + "</div>";
    return (heading ? headingLabel(heading) : "") +
      (intro ? '<p class="el-cards__intro">' + format(intro) + "</p>" : "") +
      bar + list;
  };


  /* --- add_people ------------------------------------------------------- */
  RENDERERS.add_people = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var people = toArray(firstValue(obj, ["people", "items", "add_people"]));
    if (!people.length) return "";

    var heading = firstValue(obj, S.fields.heading);
    var intro = firstValue(obj, S.fields.intro);
    var html = people.map(function (person) {
      if (!isPlainObject(person)) person = { name: person };
      var name = firstValue(person, ["name", "text"]);
      if (!name) return "";
      var role = firstValue(person, ["position", "role", "subtitle"]);
      var photo = firstValue(person, S.fields.image);
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
    return (heading ? headingLabel(heading) : "") +
      (intro ? '<p class="el-cards__intro">' + format(intro) + "</p>" : "") +
      '<div class="el-people">' + html + "</div>";
  };


  /* --- add_a_timeline --------------------------------------------------- */
  RENDERERS.add_a_timeline = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var items = toArray(firstValue(obj, ["items_of_the_timeline", "items", "steps"]));
    if (!items.length) return "";

    var heading = firstValue(obj, S.fields.heading);
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


  /* --- add_publication_or_more ------------------------------------------ */
  RENDERERS.add_publication_or_more = function (value) {
    var obj = isPlainObject(value) ? value : { items: value };
    var items = toArray(firstValue(obj, ["items", "publication_titles", "papers", "list", "publications"]));
    if (!items.length) return "";

    var heading = firstValue(obj, ["publication_section_title", "heading", "title"]);
    var showNumbers = obj.show_numbering !== false;
    var showCategories = obj.show_categories !== false && obj.filter !== false;
    var position = String(obj.filter_position || "").toLowerCase();
    var groupName = firstValue(obj, ["publication_group", "filter_group", "group"]);
    var groupState = groupName ? publicationGroup(groupName) : null;
    var pending = groupState ? null : pendingPublication;
    pendingPublication = null;
    var group = groupState ? PF.slug(String(groupName))
      : (pending ? pending.group : "pubs-" + (++filterSeq));

    var groupTags = pending ? pending.tags.slice() : [];
    var rows = items.map(function (item, index) {
      if (!isPlainObject(item)) item = { title: item };
      var title = firstValue(item, ["title", "publication_title", "publication_title_to_include", "name"]);
      if (!title) return "";
      var authors = firstValue(item, ["authors", "author", "by"]);
      var venue = firstValue(item, ["venue", "journal", "where", "meta", "publisher"]);
      var year = firstValue(item, ["year", "date"]);
      var tags = tagValues(firstValue(item, S.fields.tags));
      tags.forEach(function (name) {
        if (groupTags.indexOf(name) < 0) groupTags.push(name);
        if (groupState && groupState.tags.indexOf(name) < 0) groupState.tags.push(name);
      });
      var link = PF.resolveLink(firstValue(item, S.fields.link) || "");
      var titleHtml = link
        ? '<a href="' + esc(link) + '"' + PF.linkAttrs(link) + ">" + format(title) + "</a>"
        : format(title);
      var meta = [authors, venue].filter(Boolean).map(function (part) { return esc(String(part)); }).join(" &middot; ");
      var side = (year ? '<span class="el-pub__year">' + esc(year) + "</span>" : "") +
        (link
          ? '<a class="el-pub__view" href="' + esc(link) + '" aria-label="View: ' + esc(String(title)) + '"' +
            PF.linkAttrs(link) + ">View</a>"
          : "");
      var number = showNumbers ? index + 1 : 0;
      var tagAttr = tags.length
        ? ' data-filter-group="' + esc(group) + '" data-tags="' + esc(tagSlugs(tags)) +
          '" data-tag-labels="' + esc(tags.join("|")) + '"'
        : "";
      return '<div class="el-pub' + (showNumbers ? "" : " el-pub--plain") + '"' + tagAttr + ">" +
        (showNumbers ? '<span class="el-pub__no">' + String(number).padStart(2, "0") + "</span>" : "") +
        "<div>" +
        '<div class="el-pub__title">' + titleHtml + "</div>" +
        (meta ? '<div class="el-pub__meta">' + meta + "</div>" : "") +
        "</div>" +
        (side ? '<div class="el-pub__side">' + side + "</div>" : (showNumbers ? "<span></span>" : "")) +
        "</div>";
    }).filter(Boolean).join("");

    if (!rows) return "";
    var barTags = groupState ? groupState.tags : groupTags;
    var bar = showCategories && items.length > 1
      ? filterBar(barTags, "Filter publications by category", group, position)
      : "";
    var list = '<div class="el-pubs">' + rows + "</div>";
    return (heading ? headingLabel(heading) : "") + bar + list;
  };


  /* --- add_contact_information ----------------------------------------- */
  RENDERERS.add_contact_information = function (value) {
    var obj = isPlainObject(value) ? value : { email: value };
    var heading = firstValue(obj, S.fields.heading);
    var people = toArray(firstValue(obj, ["people", "contacts", "items"]) || []);
    if (!people.length) {
      people = (obj.email || obj.mobile || obj.phone || obj.telephone) ? [obj] : [];
    }
    if (!people.length) return "";

    var blocks = people.map(function (person) {
      if (!isPlainObject(person)) person = { email: person };
      var name = firstValue(person, ["name", "full_name"]);
      var role = firstValue(person, ["role", "position", "title"]);
      var email = firstValue(person, ["email", "mail", "address"]);
      var phone = firstValue(person, ["mobile", "mobile_number", "phone", "phone_number", "telephone", "tel"]);
      var note = firstValue(person, ["note", "caption"]);
      if (!name && !email && !phone) return "";

      var tel = phone ? String(phone).replace(/[^\d+]/g, "") : "";
      return '<div class="el-contact__person">' +
        (name ? '<p class="el-contact__name">' + format(name) + "</p>" : "") +
        (role ? '<p class="el-contact__role">' + format(role) + "</p>" : "") +
        (email ? '<a class="el-contact__email" href="mailto:' + esc(email) + '">' + esc(email) + "</a>" : "") +
        (phone ? '<a class="el-contact__phone" href="tel:' + esc(tel) + '">' + format(phone) + "</a>" : "") +
        (note ? '<span class="el-contact__note">' + format(note) + "</span>" : "") +
        "</div>";
    }).filter(Boolean).join("");

    if (!blocks) return "";
    return (heading ? headingLabel(heading) : "") +
      '<div class="el-contact' + (people.length > 1 ? " el-contact--group" : "") + '">' +
      blocks + "</div>";
  };


  /* --- add_teaching_items -------------------------------------------------
     Courses with the facts a student actually wants: name, code, level,
     when it ran, and one line on what it is. Accepts one course or a list,
     optionally under a heading. */
  RENDERERS.add_teaching_items = function (value) {
    var obj = isPlainObject(value) && !Array.isArray(value) ? value : {};
    var isCourse = function (item) {
      return isPlainObject(item) &&
        (item.name || item.title || item.course_name || item.code || item.course_code);
    };

    var heading = firstValue(obj, S.fields.heading);
    var courses = toArray(firstValue(obj, ["items", "courses", "add_items_to_list", "teaching"]));

    if (!courses.length) {
      if (Array.isArray(value)) courses = value;
      else if (isCourse(value)) courses = [value];
    }

    var html = courses.map(function (course) {
      if (typeof course === "string") course = { name: course };
      if (!isCourse(course)) return "";

      var name = firstValue(course, ["name", "title", "course_name", "heading"]);
      var code = firstValue(course, ["code", "course_code", "catalog", "module_code"]);
      var level = firstValue(course, ["level", "study_level", "stage", "audience"]);
      var term = firstValue(course, ["term", "last_taught", "teaching_time", "taught", "semester", "when"]);
      var intro = firstValue(course, ["intro", "description", "summary", "text", "blurb"]);
      var link = PF.resolveLink(firstValue(course, ["link", "url"]) || "");

      var meta = [];
      if (code) meta.push('<span class="el-course__code">' + esc(code) + "</span>");
      if (level) meta.push("<span>" + esc(level) + "</span>");
      if (term) meta.push("<span>" + esc(term) + "</span>");

      var titleHtml = link
        ? '<a href="' + esc(link) + '"' + PF.linkAttrs(link) + ">" + format(name) + "</a>"
        : format(name);

      return '<article class="el-course">' +
        (meta.length ? '<p class="el-course__meta">' + meta.join("") + "</p>" : "") +
        '<h3 class="el-course__name">' + titleHtml + "</h3>" +
        (intro ? '<p class="el-course__intro">' + format(intro) + "</p>" : "") +
        "</article>";
    }).filter(Boolean).join("");

    if (!html) return "";
    return (heading ? headingLabel(heading) : "") + '<div class="el-courses">' + html + "</div>";
  };


  /* --- add_featured_publication -----------------------------------------
     One paper, given room: an image beside the citation, a short summary
     and one link. A string is treated as the title. */
  RENDERERS.add_featured_publication = function (value) {
    var obj = isPlainObject(value) ? value : { title: value };
    var title = firstValue(obj, ["title", "heading", "publication_title"]);
    if (!title) return "";

    var keyword = firstValue(obj, ["keyword", "label", "subheading", "eyebrow"]) || "Featured publication";
    var authors = firstValue(obj, ["authors", "author", "by"]);
    var venue = firstValue(obj, ["venue", "journal", "publisher"]);
    var year = firstValue(obj, ["year", "date"]);
    var summary = firstValue(obj, ["summary", "text", "abstract"]);
    var link = PF.resolveLink(firstValue(obj, S.fields.link) || "");
    var linkLabel = firstValue(obj, ["link_label", "link_text", "button_label"]) || "Read the paper";

    var tags = tagValues(firstValue(obj, S.fields.tags));
    var groupName = firstValue(obj, ["publication_group", "filter_group", "group"]);
    var groupState = groupName ? publicationGroup(groupName) : null;
    var autoGroup = "";
    pendingPublication = null;
    if (groupState) {
      tags.forEach(function (tag) {
        if (groupState.tags.indexOf(tag) < 0) groupState.tags.push(tag);
      });
    } else if (tags.length) {
      autoGroup = "pubs-" + (++filterSeq);
      pendingPublication = { group: autoGroup, tags: tags.slice() };
    }
    var filterGroup = groupState ? PF.slug(String(groupName)) : autoGroup;
    var image = firstValue(obj, S.fields.image);
    var alt = firstValue(obj, S.fields.imageAlt) || "";
    var caption = firstValue(obj, S.fields.caption);
    var credit = firstValue(obj, S.fields.credit);
    var zoom = obj.zoom_on !== false;
    var imageSrc = image ? src(image) : "";

    /* Keyword, venue and year share the top line; authors keep the meta
       line underneath. */
    var keywordLine = format(keyword);
    if (venue) keywordLine += " &middot; " + esc(String(venue));
    if (year) keywordLine += " &middot; " + esc(String(year));
    var meta = authors ? esc(String(authors)) : "";

    var filterAttrs = "";
    if (filterGroup) {
      filterAttrs = ' data-filter-group="' + esc(filterGroup) + '"';
      if (tags.length) {
        filterAttrs += ' data-tags="' + esc(tagSlugs(tags)) + '" data-tag-labels="' + esc(tags.join("|")) + '"';
      }
    }

    var media = image
      ? '<figure class="el-featured__media">' +
        '<img src="' + esc(imageSrc) + '" alt="' + esc(alt) + '" loading="lazy"' +
        (zoom
          ? ' class="zoomable" data-lightbox="' + esc(imageSrc) + '" data-lightbox-alt="' + esc(alt) +
            '" data-lightbox-caption="' + esc([caption, credit].filter(Boolean).join(" — ")) + '"'
          : "") + ">" +
        ((caption || credit)
          ? "<figcaption><span>" + format(caption || "") + "</span><span>" + format(credit || "") + "</span></figcaption>"
          : "") +
        "</figure>"
      : "";

    var titleHtml = link
      ? '<a href="' + esc(link) + '"' + PF.linkAttrs(link) + ">" + format(title) + "</a>"
      : format(title);

    return '<article class="el-featured' + (image ? "" : " el-featured--text") + '"' + filterAttrs + ">" +
      media +
      '<div class="el-featured__body">' +
      '<p class="el-featured__keyword">' + keywordLine + "</p>" +
      '<h3 class="el-featured__title">' + titleHtml + "</h3>" +
      (meta ? '<p class="el-featured__meta">' + meta + "</p>" : "") +
      (summary ? '<p class="el-featured__summary">' + format(summary) + "</p>" : "") +
      (link
        ? '<a class="el-featured__link" href="' + esc(link) + '"' + PF.linkAttrs(link) + ">" +
          esc(linkLabel) + PF.icon("outward") + "</a>"
        : "") +
      "</div></article>";
  };


  /* --- add_expandable_information ----------------------------------------
     Folded groups — Education, honours, previous posts. Each group is a
     native <details>, so it opens by click or keyboard with no script.

     A group:
       { "expandable_information_row_label": "Education",
         "add_information_to_expandable_item": [ …rows… ] }
     A row:
       { "expandable_item_left_column_info": "PhD, 2009",
         "expandable_item_right_column_primary_information": ["Title", "Place"],
         "expandable_item_right_column_secondary_information": [
           { "label": "Thesis", "value": "…" } ] }
     "open": true starts a group unfolded. Shorter names — label, items,
     left, right, secondary — read the same. */
  RENDERERS.add_expandable_information = function (value) {
    var groups = [];

    function firstOf(obj, keys) {
      var found = firstValue(obj, keys);
      return found == null ? "" : found;
    }

    function rowsOf(group) {
      var rows = firstOf(group, [
        "add_information_to_expandable_item", "items", "rows", "details", "fields"
      ]);
      return rows;
    }

    function addGroup(label, rows, open, expanded) {
      label = String(label == null ? "" : label).trim();
      /* An expanded group is its own heading-free block; a label is optional.
         A collapsible group still needs a label to open. */
      if (!rows || (!label && !expanded)) return;
      groups.push({ label: label, rows: rows, open: !!open, expanded: !!expanded });
    }

    /* "open": true starts a group unfolded but still closable.
       "expanded": true keeps it unfolded — no arrow, nothing to click. */
    function startsOpen(group) {
      return group.open === true;
    }

    function staysExpanded(group) {
      return group.expanded === true || group.expanded_by_default === true;
    }

    if (Array.isArray(value)) {
      value.forEach(function (group) {
        if (!isPlainObject(group)) return;
        addGroup(
          firstOf(group, ["expandable_information_row_label", "label", "heading", "title", "name"]),
          rowsOf(group),
          startsOpen(group),
          staysExpanded(group)
        );
      });
    } else if (isPlainObject(value)) {
      var label = firstOf(value, ["expandable_information_row_label", "label", "heading", "title", "name"]);
      if ((label || staysExpanded(value)) && rowsOf(value)) {
        addGroup(label, rowsOf(value), startsOpen(value), staysExpanded(value));
      } else {
        Object.keys(value).forEach(function (key) {
          if (/^(open|expanded|expanded_by_default|column|column_position|label|heading|title|expandable_information_row_label|add_information_to_expandable_item|items|rows|details|fields)$/.test(key)) return;
          addGroup(key, value[key], false, false);
        });
      }
    }

    if (!groups.length) return "";

    var html = groups.map(function (group) {
      var rows = group.rows;
      var list = [];

      function addRow(row) {
        if (!isPlainObject(row)) return;

        var left = firstOf(row, [
          "expandable_item_left_column_info", "left", "label", "period", "date", "year"
        ]);
        var primary = firstOf(row, [
          "expandable_item_right_column_primary_information", "right", "value", "text", "description"
        ]);
        var secondary = firstOf(row, [
          "expandable_item_right_column_secondary_information", "secondary", "under", "details", "meta"
        ]);

        var lines = toArray(primary).map(function (line) {
          return line == null ? "" : String(line).trim();
        }).filter(Boolean);

        var meta = [];
        if (Array.isArray(secondary)) {
          secondary.forEach(function (entry) {
            if (!isPlainObject(entry)) return;
            var metaLabel = firstOf(entry, ["label", "key", "name", "term"]);
            var metaValue = firstOf(entry, ["value", "text", "detail", "description"]);
            if (metaLabel && metaValue) meta.push({ label: metaLabel, value: metaValue });
          });
        } else if (isPlainObject(secondary)) {
          Object.keys(secondary).forEach(function (key) {
            if (secondary[key] != null && String(secondary[key]).trim() !== "") {
              meta.push({ label: key, value: secondary[key] });
            }
          });
        }

        if (!lines.length && !left && !meta.length) return;

        list.push('<div class="el-xp__row">' +
          '<p class="el-xp__left">' + format(left) + "</p>" +
          '<div class="el-xp__right">' +
          lines.map(function (line) {
            return '<p class="el-xp__line">' + format(line) + "</p>";
          }).join("") +
          (meta.length
            ? '<dl class="el-xp__meta">' + meta.map(function (entry) {
              return "<div>" +
                "<dt>" + esc(entry.label) + "</dt>" +
                "<dd>" + format(entry.value) + "</dd>" +
                "</div>";
            }).join("") + "</dl>"
            : "") +
          "</div></div>");
      }

      if (Array.isArray(rows)) rows.forEach(addRow);
      else if (isPlainObject(rows)) {
        Object.keys(rows).forEach(function (key) {
          var row = rows[key];
          if (isPlainObject(row)) {
            row = Object.assign({}, row);
            if (row.expandable_item_left_column_info == null) row.expandable_item_left_column_info = key;
            addRow(row);
          } else {
            addRow({ expandable_item_left_column_info: key, expandable_item_right_column_primary_information: row });
          }
        });
      }

      if (!list.length) return "";

      var rowsHtml = '<div class="el-xp__rows">' + list.join("") + "</div>";

      /* Kept expanded: a static group — no arrow, no way to fold it. The
         summary is drawn only when the group has a label. */
      if (group.expanded) {
        return '<section class="el-xp__group el-xp__group--static">' +
          (group.label
            ? '<div class="el-xp__summary">' +
              '<span class="el-xp__label">' + esc(group.label) + "</span>" +
              "</div>"
            : "") +
          rowsHtml + "</section>";
      }

      return '<details class="el-xp__group"' + (group.open ? " open" : "") + ">" +
        '<summary class="el-xp__summary">' +
        '<span class="el-xp__label">' + esc(group.label) + "</span>" +
        '<span class="el-xp__icon" aria-hidden="true"></span>' +
        "</summary>" + rowsHtml +
        "</details>";
    }).filter(Boolean).join("");

    return html ? '<div class="el-xp">' + html + "</div>" : "";
  };

  PF.resetPublicationGroup = function () {
    pendingPublication = null;
  };

})(window.PF);


/* js/render/media.js */
/* ==========================================================================
   render/<family>.js — renderers registered into PF.render.registry.
   Loaded after elements.js and before app.js.
   ========================================================================== */
(function (PF) {
  "use strict";
  var R = PF.render;
  var esc = R.esc, format = R.format, src = R.src;
  var isPlainObject = R.isPlainObject, firstValue = R.firstValue;
  var toArray = R.toArray, headingLabel = R.headingLabel, paragraphs = R.paragraphs;
  var S = PF.schema;
  var RENDERERS = R.registry;
  /* --- add_equation -------------------------------------------------------
     A LaTeX formula, drawn with KaTeX (loaded only when a page has maths).
     A string is a displayed equation; the object form adds a heading, a
     caption or inline mode. JSON needs doubled backslashes: "\\frac{a}{b}".
     If KaTeX cannot load, the raw TeX stays on the page. */
  var KATEX_BASE = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
  var katexLoading = null;

  function loadKatex() {
    if (window.katex) return Promise.resolve(true);
    if (katexLoading) return katexLoading;
    katexLoading = new Promise(function (resolve) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = KATEX_BASE + "katex.min.css";
      document.head.appendChild(link);
      var script = document.createElement("script");
      script.src = KATEX_BASE + "katex.min.js";
      script.onload = function () { resolve(!!window.katex); };
      script.onerror = function () { resolve(false); };
      document.head.appendChild(script);
    });
    return katexLoading;
  }

  function typesetEquations(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll(".el-equation[data-tex]");
    if (!nodes.length) return;
    loadKatex().then(function (ok) {
      if (!ok || !window.katex) return;
      Array.prototype.forEach.call(nodes, function (el) {
        try {
          window.katex.render(el.getAttribute("data-tex"), el, {
            displayMode: el.getAttribute("data-display") === "1",
            throwOnError: false
          });
        } catch (e) { /* leave the raw TeX in place */ }
      });
    });
  }

  RENDERERS.add_equation = function (value) {
    return toArray(value).map(function (item) {
      var obj = isPlainObject(item) ? item : { formatted_equation: item };
      var tex = firstValue(obj, ["formatted_equation", "tex", "text", "equation"]);
      if (tex == null || String(tex).trim() === "") return "";
      tex = String(tex).trim();
      var heading = firstValue(obj, ["heading", "label", "title"]);
      var caption = firstValue(obj, ["equation_caption", "caption"]);
      var inline = obj.add_as_inline_equation === true || obj.inline === true ||
        obj.display === false || obj.block === false;

      return (heading ? headingLabel(heading) : "") +
        (inline
          ? '<span class="el-equation el-equation--inline" data-tex="' + esc(tex) +
            '" data-display="0">' + esc(tex) + "</span>"
          : '<div class="el-equation" data-tex="' + esc(tex) +
            '" data-display="1">' + esc(tex) + "</div>") +
        (caption ? '<p class="el-equation__caption">' + format(caption) + "</p>" : "");
    }).filter(Boolean).join("");
  };


  /* --- add_image -------------------------------------------------------- */
  function figureHtml(item) {
    if (!isPlainObject(item)) item = { image_path: item };
    var path = firstValue(item, S.fields.image);
    if (!path) return "";
    var alt = firstValue(item, S.fields.imageAlt) || "";
    var caption = firstValue(item, S.fields.caption);
    var credit = firstValue(item, S.fields.credit);
    var align = String(firstValue(item, S.fields.align) || "").toLowerCase();
    var zoom = item.zoom_on !== false && item.zoom !== false;
    var image = src(path);

    /* Text written to sit beside the plate: align left/right makes a band. */
    var side = firstValue(item, [
      "content_to_show_on_side_of_the_image_when_aligned",
      "side_content", "content_beside_image", "text_beside_image", "alongside"
    ]);
    var sideText = side == null ? "" : String(side).trim();
    var band = !!sideText && (align === "left" || align === "right");
    if (band && !align) align = "left";

    var cls = "el-figure" + (!band && align === "right" ? " el-figure--right" : (!band && align === "left" ? " el-figure--left" : ""));
    var zoomAttrs = zoom
      ? ' class="zoomable" data-lightbox="' + esc(image) + '" data-lightbox-alt="' + esc(alt) +
        '" data-lightbox-caption="' + esc(caption || "") + '"'
      : "";

    var figure = '<figure class="' + cls + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(alt) + '" loading="lazy"' + zoomAttrs + ">" +
      ((caption || credit)
        ? "<figcaption>" +
          "<span>" + format(caption || "") + "</span>" +
          "<span>" + format(credit || "") + "</span>" +
          "</figcaption>"
        : "") +
      "</figure>";

    if (!band) return figure;

    return '<div class="el-figure-band el-figure-band--' + (align === "right" ? "right" : "left") + '">' +
      figure +
      '<div class="el-figure-band__text el-prose">' + paragraphs(sideText) + "</div>" +
      "</div>";
  }

  RENDERERS.add_image = function (value) {
    return toArray(value).map(figureHtml).filter(Boolean).join("");
  };


  /* --- add_gallery ------------------------------------------------------ */
  var RATIOS = {
    "16:9": "16 / 9", "9:16": "9 / 16",
    "4:3": "4 / 3", "3:4": "3 / 4",
    "3:2": "3 / 2", "2:3": "2 / 3",
    "5:4": "5 / 4", "4:5": "4 / 5",
    "1:1": "1 / 1", "21:9": "21 / 9"
  };

  RENDERERS.add_gallery = function (value) {
    var obj = isPlainObject(value) ? value : { images: value };
    var images = toArray(firstValue(obj, ["images", "photos", "gallery"]));
    if (!images.length) return "";

    var heading = firstValue(obj, S.fields.heading);
    var columns = Math.min(Math.max(Number(obj.columns) || 2, 1), 4);
    /* One image is a full-width plate, cropped by its size. */
    if (images.length === 1) columns = 1;
    var size = String(obj.size || obj.ratio || "").toLowerCase().replace("x", ":");
    var ratio = RATIOS[size] || "";
    var natural = size === "natural";
    var layout = String(obj.layout || "").toLowerCase();
    var masonry = layout === "masonry";
    if (masonry && !size) natural = true;
    var layoutClass = masonry ? " el-gallery--masonry"
      : (layout === "grid" ? " el-gallery--grid" : "");

    var html = images.map(function (item) {
      if (!isPlainObject(item)) item = { image_path: item };
      var path = firstValue(item, S.fields.image);
      if (!path) return "";
      var alt = firstValue(item, S.fields.imageAlt) || "";
      var caption = firstValue(item, S.fields.caption);
      var credit = firstValue(item, S.fields.credit);
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
      '<div class="el-gallery' + layoutClass + (natural ? " el-gallery--natural" : "") +
      '" style="--cols:' + columns +
      (ratio ? ";--ratio:" + ratio : "") + '">' + html + "</div>";
  };


  /* --- add_slideshow ---------------------------------------------------- */
  RENDERERS.add_slideshow = function (value) {
    var obj = isPlainObject(value) ? value : { images: value };
    var images = toArray(firstValue(obj, ["images", "photos", "slides"]));
    if (!images.length) return "";

    var heading = firstValue(obj, S.fields.heading);
    var interval = Math.max(Number(firstValue(obj, ["rotation_time_milliseconds", "interval", "speed"])) || 5000, 1500);

    var zoom = obj.zoom_on !== false && obj.zoom !== false;
    var slides = images.map(function (item, index) {
      if (!isPlainObject(item)) item = { image_path: item };
      var path = firstValue(item, S.fields.image);
      if (!path) return "";
      var caption = String(firstValue(item, S.fields.caption) || "");
      var credit = String(firstValue(item, S.fields.credit) || "");
      var image = src(path);
      var classes = (zoom ? "zoomable" : "") + (index === 0 ? " is-active" : "");
      var lightbox = zoom
        ? ' data-lightbox="' + esc(image) + '" data-lightbox-alt="' +
          esc(firstValue(item, S.fields.imageAlt) || "") + '" data-lightbox-caption="' +
          esc(credit ? (caption ? caption + " — " + credit : credit) : caption) + '"'
        : "";
      return '<img src="' + esc(image) + '" alt="' + esc(firstValue(item, S.fields.imageAlt) || "") +
        '" data-slide="' + index + '" data-caption="' + esc(caption) + '" data-credit="' + esc(credit) + '"' +
        (classes ? ' class="' + classes + '"' : "") + lightbox + ">";
    }).filter(Boolean).join("");

    var captions = images.map(function (item) {
      return isPlainObject(item) ? String(firstValue(item, S.fields.caption) || "") : "";
    });

    var dots = images.map(function (item, index) {
      return '<button type="button" class="el-slideshow__dot' + (index === 0 ? " is-active" : "") +
        '" data-slide-to="' + index + '" aria-label="Show image ' + (index + 1) + '"></button>';
    }).join("");

    var align = String(firstValue(obj, S.fields.align) || "").toLowerCase();
    var side = firstValue(obj, [
      "content_to_show_on_side_of_the_slideshow_when_aligned",
      "side_content", "content_beside_slideshow", "text_beside_slideshow", "alongside"
    ]);
    var sideText = side == null ? "" : String(side).trim();
    var band = !!sideText && (align === "left" || align === "right");

    var show = '<div class="el-slideshow' +
      (!band && align === "left" ? " el-slideshow--left" : "") +
      (!band && align === "right" ? " el-slideshow--right" : "") +
      '" data-slideshow data-interval="' + interval + '">' +
      '<div class="el-slideshow__stage">' + slides + "</div>" +
      '<div class="el-slideshow__bar">' +
      '<span data-slide-caption>' + esc(captions[0] || "") + "</span>" +
      '<span class="el-slideshow__dots">' + dots + "</span>" +
      '<span data-slide-count>01 / ' + String(images.length).padStart(2, "0") + "</span>" +
      "</div></div>";

    if (!band) return (heading ? headingLabel(heading) : "") + show;

    return (heading ? headingLabel(heading) : "") +
      '<div class="el-slideshow-band el-slideshow-band--' + (align === "right" ? "right" : "left") + '">' +
      show +
      '<div class="el-slideshow-band__text el-prose">' + paragraphs(sideText) + "</div>" +
      "</div>";
  };


  /* --- add_3d_model ------------------------------------------------------
     Google's <model-viewer>, fetched once from unpkg. A bare filename is
     read from assets/3d/; a path or URL is used as written. */
  var MODEL_VIEWER_SRC = "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
  var modelViewerAsked = false;

  function needModelViewer() {
    if (modelViewerAsked) return;
    if (window.customElements && customElements.get && customElements.get("model-viewer")) return;
    modelViewerAsked = true;
    var script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER_SRC;
    document.head.appendChild(script);
  }

  function modelSrc(file) {
    var s = String(file == null ? "" : file).trim();
    if (!s) return "";
    if (/^(https?:)?\/\//.test(s) || s.charAt(0) === "/" || s.indexOf("assets/") === 0 || s.indexOf("/") > -1) {
      return s;
    }
    return "assets/3d/" + s;
  }

  function modelHeight(value) {
    if (value == null || value === "") return "420px";
    var text = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(text)) return text + "px";
    if (/^\d+(\.\d+)?(px|vh|vw|rem|em|%)$/i.test(text)) return text;
    return "420px";
  }

  RENDERERS.add_3d_model = function (value) {
    return toArray(value).map(function (item) {
      var obj = isPlainObject(item) ? item : { model_path: item };
      var file = firstValue(obj, ["model_path", "model", "src", "file"]);
      if (!file) return "";
      needModelViewer();

      var url = modelSrc(file);
      var heading = firstValue(obj, S.fields.heading);
      var caption = firstValue(obj, ["model_caption", "caption"]);
      var credit = firstValue(obj, ["model_credit", "credit"]);
      var height = modelHeight(obj.height);
      var autoRotate = obj.show_autorotate === true || obj.autoRotate === true;
      var showDownload = obj.show_download !== false && obj.download !== false;
      var align = String(obj.align || "").toLowerCase();
      var side = firstValue(obj, [
        "content_to_show_on_side_of_the_3d_model_when_aligned",
        "content_to_show_on_side_of_the_model_when_aligned",
        "side_content", "text"
      ]);
      var sideText = side == null ? "" : String(side).trim();
      var band = !!sideText && (align === "left" || align === "right");

      var viewer = '<model-viewer class="el-model__viewer" src="' + esc(url) + '"' +
        ' camera-controls touch-action="pan-y" shadow-intensity="0.8"' +
        ' tone-mapping="neutral" loading="lazy" reveal="auto"' +
        ' style="height:' + height + '"' + (autoRotate ? " auto-rotate" : "") +
        "></model-viewer>";

      var figure = '<figure class="el-model">' + viewer +
        ((caption || credit)
          ? "<figcaption><span>" + format(caption || "") + "</span><span>" + format(credit || "") + "</span></figcaption>"
          : "") +
        (showDownload
          ? '<a class="el-model__download" href="' + esc(url) + '" download>Download the model</a>'
          : "") +
        "</figure>";

      var label = heading ? headingLabel(heading) : "";
      if (!band) return label + figure;

      return label +
        '<div class="el-model-band el-model-band--' + (align === "right" ? "right" : "left") + '">' +
        figure +
        '<div class="el-model-band__text el-prose">' + paragraphs(sideText) + "</div>" +
        "</div>";
    }).filter(Boolean).join("");
  };


  /* --- add_embed_media -------------------------------------------------- */
  function embedUrl(url) {
    var value = String(url || "").trim();
    var youtube = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([\w-]{6,})/);
    if (youtube) return "https://www.youtube-nocookie.com/embed/" + youtube[1];
    var vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return "https://player.vimeo.com/video/" + vimeo[1];

    var m = /docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)/.exec(value);
    if (m) return "https://docs.google.com/presentation/d/" + m[1] + "/embed";
    m = /docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/.exec(value);
    if (m) return "https://docs.google.com/document/d/" + m[1] + "/preview";
    m = /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(value);
    if (m) return "https://docs.google.com/spreadsheets/d/" + m[1] + "/preview";
    m = /docs\.google\.com\/forms\/d\/e\/([A-Za-z0-9_-]+)/.exec(value);
    if (m) return "https://docs.google.com/forms/d/e/" + m[1] + "/viewform?embedded=true";
    m = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/.exec(value);
    if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
    if (/calendar\.google\.com\/calendar\/embed/.test(value)) return value;

    return value;
  }

  function embedPlate(item, height) {
    var link = firstValue(item, S.fields.link);
    if (!link) return "";
    var heading = firstValue(item, S.fields.heading);
    var caption = firstValue(item, ["caption", "image_caption"]);
    var credit = firstValue(item, ["credit", "image_credit"]);
    var h = height || firstValue(item, ["height", "single_embed_media_item_height"]);
    var px = parseInt(h, 10);
    var style = px > 0 ? ' style="height:' + px + 'px;aspect-ratio:auto"' : "";
    return '<figure class="el-embed">' +
      '<div class="el-embed__media">' +
      '<iframe src="' + esc(embedUrl(link)) + '" title="' + esc(heading || caption || "Embedded content") + '" ' +
      'loading="lazy" referrerpolicy="strict-origin-when-cross-origin" ' + style +
      ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      "allowfullscreen></iframe></div>" +
      ((caption || credit)
        ? "<figcaption><span>" + format(caption || "") + "</span><span>" + format(credit || "") + "</span></figcaption>"
        : "") +
      "</figure>";
  }

  RENDERERS.add_embed_media = function (value) {
    var obj = isPlainObject(value) ? value : { link: value };
    var link = firstValue(obj, S.fields.link);
    if (!link) return "";

    var heading = firstValue(obj, S.fields.heading);
    var align = String(obj.align || "").toLowerCase();
    var side = firstValue(obj, [
      "content_to_show_on_side_of_the_embed_when_aligned",
      "content_to_show_on_the_side_of_the_embed_when_aligned",
      "side_content", "text"
    ]);
    var sideText = side == null ? "" : String(side).trim();
    var plate = embedPlate(obj);
    if (!plate) return "";

    var label = heading ? headingLabel(heading) : "";
    if ((align === "left" || align === "right") && sideText) {
      return label +
        '<div class="el-embed-band el-embed-band--' + (align === "right" ? "right" : "left") + '">' +
        plate +
        '<div class="el-embed-band__text el-prose">' + paragraphs(sideText) + "</div>" +
        "</div>";
    }
    return label + plate;
  };

  RENDERERS.add_embed_media_row = function (value) {
    var obj = isPlainObject(value) ? value : { add_embedded_media_to_row: value };
    var items = toArray(firstValue(obj, ["add_embedded_media_to_row", "items", "embeds"]));
    if (!items.length) return "";
    var heading = firstValue(obj, S.fields.heading);
    var columns = Math.min(Math.max(Number(obj.columns) || items.length || 2, 1), 4);
    var rowHeight = firstValue(obj, ["height"]);
    var html = items.map(function (item) {
      return isPlainObject(item) ? embedPlate(item, rowHeight) : "";
    }).filter(Boolean).join("");
    if (!html) return "";
    return (heading ? headingLabel(heading) : "") +
      '<div class="el-embed-row" style="--cols:' + columns + '">' + html + "</div>";
  };

  R.typeset = typesetEquations;
})(window.PF);


/* js/render/structure.js */
/* ==========================================================================
   render/<family>.js — renderers registered into PF.render.registry.
   Loaded after elements.js and before app.js.
   ========================================================================== */
(function (PF) {
  "use strict";
  var R = PF.render;
  var esc = R.esc, format = R.format, src = R.src;
  var isPlainObject = R.isPlainObject, firstValue = R.firstValue;
  var toArray = R.toArray, headingLabel = R.headingLabel, paragraphs = R.paragraphs;
  var S = PF.schema;
  var RENDERERS = R.registry;
  /* --- add_full_width_links --------------------------------------------- */
  RENDERERS.add_full_width_links = function (value) {
    var obj = isPlainObject(value) ? value : { links: value };
    var links = toArray(firstValue(obj, ["links", "items"]));
    if (!links.length) return "";
    var heading = firstValue(obj, S.fields.heading);

    var rows = links.map(function (link, index) {
      if (!isPlainObject(link)) return "";
      var label = firstValue(link, ["label", "text", "title"]);
      if (!label) return "";
      var href = PF.resolveLink(firstValue(link, S.fields.link) || "");
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


  /* --- add_button ------------------------------------------------------- */
  RENDERERS.add_button = function (value) {
    var obj = isPlainObject(value) ? value : {};
    var list = Array.isArray(value)
      ? value
      : toArray(firstValue(obj, ["items", "buttons", "links"]) ||
          (obj.label || obj.text ? [obj] : []));

    var align = String(obj.align || "").trim().toLowerCase();
    var alignClass = align === "center" ? " el-buttons--center"
      : (align === "right" || align === "end" ? " el-buttons--right" : "");

    var html = list.map(function (button) {
      if (!isPlainObject(button)) button = { label: button };
      var label = firstValue(button, ["label", "text", "title"]);
      if (!label) return "";
      var link = PF.resolveLink(firstValue(button, S.fields.link) || "");
      var style = String(button.style || button.type || "fill").toLowerCase();
      var outline = style === "outline" || style === "ghost" || style === "secondary";
      var tag = link ? "a" : "span";

      /* The arrow is opt-in: icon: "arrow_outward" | "arrow_forward". */
      var icon = button.icon;
      var iconHtml = "";
      if (icon && icon !== false) {
        var iconName = String(icon).toLowerCase();
        iconHtml = PF.icon(/right|forward|next/.test(iconName) ? "right" : "outward");
      }

      return "<" + tag + ' class="el-btn' + (outline ? " el-btn--outline" : "") + '"' +
        (link ? ' href="' + esc(link) + '"' + PF.linkAttrs(link) : "") + ">" +
        format(label) + iconHtml + "</" + tag + ">";
    }).filter(Boolean).join("");

    return html ? '<div class="el-buttons' + alignClass + '">' + html + "</div>" : "";
  };


  /* --- add_divider ------------------------------------------------------ */
  var DIVIDERS = {
    solid: "solid", line: "solid", thin: "thin", hairline: "thin",
    dashed: "dashed", dash: "dashed",
    dotted: "dotted", dot: "dotted",
    bold: "bold", thick: "bold", heavy: "bold",
    double: "double"
  };

  RENDERERS.add_divider = function (value) {
    var raw = typeof value === "string"
      ? value
      : (isPlainObject(value) ? firstValue(value, ["style", "type", "divider_style", "weight"]) : "");
    var key = String(raw == null ? "" : raw).trim().toLowerCase();
    var style = DIVIDERS[key] || "solid";
    return '<hr class="el-divider el-divider--' + style + '">';
  };

})(window.PF);


/* js/app.js */
/* ==========================================================================
   app.js — draws the header, the sections and the footer from JSON.
   ========================================================================== */
(function () {
  "use strict";

  var PF = window.PF;
  var E = PF.elements;

  var SITE_URL = "data/site.json";
  var SECTION_DIR = "data/sections/";

  var ICON_LABELS = {
    mail: "Email",
    email: "Email",
    "googlescholar-old": "Google Scholar",
    "googlescholar-new": "Google Scholar",
    orcid: "ORCID",
    github: "GitHub",
    linkedin: "LinkedIn",
    bluesky: "Bluesky",
    x: "X",
    mastodon: "Mastodon",
    instagram: "Instagram",
    youtube: "YouTube",
    researchgate: "ResearchGate"
  };

  function byId(id) { return document.getElementById(id); }
  function pad(value) { return String(value).padStart(2, "0"); }

  function labelFromIcon(icon) {
    var key = String(icon || "").toLowerCase();
    if (ICON_LABELS[key]) return ICON_LABELS[key];
    return key
      ? key.replace(/[-_]+/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); })
      : "Link";
  }

  function cvLink(cv) {
    if (!cv || !cv.file) return "";
    var href = PF.resolveLink("@cv");
    var attrs = " href=\"" + PF.esc(href) + "\"";
    if (/\.pdf(\?|$)/i.test(href)) attrs += ' target="_blank" rel="noopener"';
    else attrs += PF.linkAttrs(href);
    return "<a class=\"cv-button\"" + attrs + ">" +
      "<span>" + PF.esc(cv.label || "Download CV") + "</span>" +
      PF.icon("outward") +
      "</a>";
  }

  function headerMarkup(site) {
    var header = site.header || {};
    var hasImage = String(header.image_path || "").trim() !== "";
    var subheading = header.subheading || header.eyebrow || "";
    var facts = PF.toArray(header.additional_info || header.meta || []).filter(Boolean).map(function (item) {
      return "<li>" + PF.esc(item) + "</li>";
    }).join("");
    var button = cvLink(header.cv);

    var aside = hasImage
      ? '<div class="masthead__aside">' +
        '<img class="masthead__image" src="' + PF.esc(PF.imageSrc(header.image_path)) + '" alt="' +
        PF.esc(header.image_alt || header.name || "") + '" fetchpriority="high">' +
        button +
        "</div>"
      : "";
    var inlineCv = !hasImage && button
      ? '<div class="masthead__cv-inline">' + button + "</div>"
      : "";

    return '<header class="masthead' + (hasImage ? "" : " masthead--plain") + '">' +
      '<div class="masthead__info">' +
      (subheading ? '<p class="eyebrow">' + PF.esc(subheading) + "</p>" : "") +
      '<h1 class="masthead__name">' + PF.esc(header.name || "") + "</h1>" +
      (header.title ? '<p class="masthead__title">' + PF.formatText(header.title) + "</p>" : "") +
      (header.role ? '<p class="masthead__role">' + PF.formatText(header.role) + "</p>" : "") +
      (header.affiliation ? '<p class="masthead__affiliation">' + PF.formatText(header.affiliation) + "</p>" : "") +
      (header.intro ? '<p class="masthead__intro">' + PF.formatText(header.intro) + "</p>" : "") +
      (facts ? '<ul class="masthead__meta">' + facts + "</ul>" : "") +
      inlineCv +
      "</div>" +
      aside +
      "</header>";
  }

  /* Which side of a two-column section an element sits on:
     { "add_teaching_items": { "column": "left", … } } */
  function columnClass(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    var column = (PF.schema && PF.schema.pick(value, "column")) || "";
    var side = String(column).trim().toLowerCase();
    return side === "left" || side === "right" ? " flow__item--" + side : "";
  }

  function flowItem(html, extraClass) {
    if (!html) return "";
    return '<div class="flow__item' + (extraClass || "") + '">' + html + "</div>";
  }

  function entryTypes(entry) {
    return Object.keys(entry).filter(function (key) {
      return key.indexOf("add_") === 0;
    });
  }

  function isHeadingEntry(entry) {
    return !!entry && typeof entry === "object" &&
      entryTypes(entry).length === 1 && !!entry.add_heading;
  }

  /* A paragraph with no title of its own: a string, or an object with no
     heading/title/label. */
  function isUntitledParagraphEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    var types = entryTypes(entry);
    if (types.length !== 1 || !entry.add_paragraph) return false;
    var value = entry.add_paragraph;
    if (!value || typeof value !== "object" || Array.isArray(value)) return true;
    return !(value.heading || value.title || value.label ||
      value.heading_text || value.paragraph_heading);
  }

  /* A section may set defaults that apply to its elements. `show_numbering`
     sits at section level to switch every publication list in that section;
     a value on the element itself still wins. */
  function withSectionDefaults(type, value, data) {
    var canonical = (PF.render.aliases && PF.render.aliases[type]) || type;
    if (canonical !== "add_publication_or_more") return value;
    if (!data || data.show_numbering == null) return value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    if (value.show_numbering != null) return value;
    var copy = {};
    Object.keys(value).forEach(function (key) { copy[key] = value[key]; });
    copy.show_numbering = data.show_numbering !== false;
    return copy;
  }

  function renderEntry(entry, data) {
    var inner = "";
    var side = "";
    Object.keys(entry).forEach(function (type) {
      /* "column" may sit beside an element written as an array —
         { "add_expandable_information": [ … ], "column": "left" }. */
      if (type === "column" || type === "column_position") {
        if (!side) side = columnClass({ column: entry[type] });
        return;
      }
      inner += E.render(type, withSectionDefaults(type, entry[type], data));
      if (!side) side = columnClass(entry[type]);
    });
    return { html: inner, side: side };
  }

  function flowMarkup(data) {
    return Object.keys(data).map(function (key) {
      if (key === "add_content_to_page") {
        var entries = PF.toArray(data[key]);
        var out = [];
        for (var i = 0; i < entries.length; i += 1) {
          var entry = entries[i];
          if (!entry || typeof entry !== "object") continue;

          /* A heading directly above an untitled paragraph is that
             paragraph's title, so the two are drawn as one block. */
          var next = entries[i + 1];
          if (isHeadingEntry(entry) && isUntitledParagraphEntry(next)) {
            var headingSide = columnClass(entry.add_heading) ||
              columnClass({ column: entry.column });
            var nextSide = columnClass(next.add_paragraph) ||
              columnClass({ column: next.column });
            if (!nextSide || nextSide === headingSide) {
              var group = E.render("add_heading", entry.add_heading) +
                E.render("add_paragraph", next.add_paragraph);
              out.push(flowItem(group, headingSide + " flow__item--titled"));
              i += 1;
              continue;
            }
          }

          var rendered = renderEntry(entry, data);
          out.push(flowItem(rendered.html, rendered.side));
        }
        return out.join("");
      }
      if (key.indexOf("add_") !== 0) return "";
      var html = E.render(key, withSectionDefaults(key, data[key], data));
      return flowItem(html, columnClass(data[key]));
    }).join("");
  }

  function sectionMarkup(section, index, showHead) {
    var data = section.data || {};
    var number = data.number || pad(index + 1);
    var label = data.label || data.nav || section.id;
    if (PF.resetPublicationGroup) PF.resetPublicationGroup();
    var flow = flowMarkup(data);

    var lead = (data.heading || data.intro)
      ? '<div class="section-lead' + (data.heading && data.intro ? "" : " section-lead--single") + '">' +
        (data.heading ? '<h2 class="section-title">' + PF.formatText(data.heading) + "</h2>" : "") +
        (data.intro ? '<p class="section-intro">' + PF.formatText(data.intro) + "</p>" : "") +
        "</div>"
      : "";

    var body = lead
      ? '<div class="section-body">' + lead +
        (flow ? '<div class="flow">' + flow + "</div>" : "") + "</div>"
      : (flow ? '<div class="flow">' + flow + "</div>" : "");

    var layout = String(data.layout || "").toLowerCase();
    /* Text is the only special layout. Everything else is the one flow:
       items stack unless they name a left/right column. */
    var sectionClass = "section" + (layout === "text" ? " section--text" : " section--flow");

    /* The numbered head belongs to the home sections. A standalone page
       keeps its title and intro, but drops the number/label/rule row. */
    var head = showHead === false ? "" :
      '<div class="section-head">' +
      '<span class="section-no">' + PF.esc(number) + "</span>" +
      '<span class="section-label">' + PF.esc(label) + "</span>" +
      '<span class="section-rule" aria-hidden="true"></span>' +
      "</div>";

    return '<section class="' + sectionClass + '" id="' + PF.esc(section.id) + '">' +
      head +
      body +
      "</section>";
  }

  function socialMarkup(site) {
    var links = (site.footer && site.footer.links) || [];
    return links.filter(function (link) { return link && link.link; }).map(function (link) {
      var href = PF.resolveLink(link.link);
      var label = link.label || labelFromIcon(link.icon);
      return '<a href="' + PF.esc(href) + '"' + PF.linkAttrs(href) +
        ' aria-label="' + PF.esc(label) + '" title="' + PF.esc(label) + '">' +
        PF.socialIcon(link.icon) + "</a>";
    }).join("");
  }

  function fitHeader() {
    var info = document.querySelector(".masthead__info");
    var aside = document.querySelector(".masthead__aside");
    if (!info || !aside) return;

    if (window.matchMedia("(max-width: 900px)").matches) {
      aside.style.width = "";
      return;
    }

    var cv = aside.querySelector(".cv-button");
    var cvHeight = cv ? cv.getBoundingClientRect().height : 0;
    var gap = cv ? (parseFloat(getComputedStyle(cv).marginTop) || 0) : 0;
    var size = Math.max(120, Math.round(info.getBoundingClientRect().height - cvHeight - gap));
    aside.style.width = size + "px";
  }

  function fail(message) {
    var content = byId("content");
    if (content) {
      content.innerHTML = '<section class="section"><div class="section-head">' +
        '<span class="section-no">!</span><span class="section-label">Could not load</span>' +
        '<span class="section-rule"></span></div><p class="section-intro">' + PF.esc(message) + "</p></section>";
    }
  }

  /* Free-standing pages keep the footer but drop the masthead: a slim bar
     with a back link and the page title instead. */
  function pageBarMarkup(title) {
    return '<div class="page-bar">' +
      '<a class="page-bar__back" id="pageBack" href="index.html">' +
      '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" ' +
      'stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M13 8H3M7 4 3 8l4 4"/></svg>' +
      "<span>Back</span></a>" +
      (title ? '<span class="page-bar__title">' + PF.esc(title) + "</span>" : "") +
      "</div>";
  }

  function wirePageBar() {
    var back = byId("pageBack");
    if (!back) return;
    back.addEventListener("click", function (event) {
      var ref = document.referrer || "";
      if (ref.indexOf(location.origin) === 0 && history.length > 1) {
        event.preventDefault();
        history.back();
      }
    });
  }

  function boot() {
    var pageRef = new URLSearchParams(location.search).get("page");
    PF.loadJson(SITE_URL).then(function (site) {
      PF.setSite(site);
      PF.applyMeta(site);

      var sectionsPromise;
      var pageTitle = "";

      if (pageRef) {
        /* A free-standing page: page.html?page=folder/name
           reads data/pages/folder/name.json. */
        var safe = String(pageRef).replace(/\.json$/i, "").replace(/^\/+|\/+$/g, "");
        if (!safe || safe.indexOf("..") > -1 || safe.indexOf("\\") > -1) {
          fail("That page address is not valid.");
          return;
        }
        var pageUrl = "data/pages/" + safe.split("/").map(encodeURIComponent).join("/") + ".json";
        sectionsPromise = PF.loadJson(pageUrl).then(function (page) {
          pageTitle = page.title || page.heading || "";
          if (page.title) {
            document.title = page.title + (site.title ? " — " + site.title : "");
            var ogTitle = byId("ogTitle");
            if (ogTitle) ogTitle.setAttribute("content", page.title);
          }
          if (page.description) {
            var meta = document.querySelector('meta[name="description"]');
            if (meta) meta.setAttribute("content", page.description);
            var ogDescription = byId("ogDescription");
            if (ogDescription) ogDescription.setAttribute("content", page.description);
          }
          var entries = page.sections || [];
          if (!entries.length) {
            /* A page may also be written as a plain content flow:
               { "title": "Methods", "add_content_to_page": [ … ] } */
            var hasFlow = !!page.add_content_to_page ||
              Object.keys(page).some(function (k) { return k.indexOf("add_") === 0; });
            if (hasFlow) {
              entries = [Object.assign({}, page, {
                id: page.id || "page",
                label: page.label || page.title || "Page",
                heading: page.heading != null ? page.heading : (page.title || ""),
                layout: page.layout || ""
              })];
            }
          }
          return Promise.all(entries.map(function (entry) {
            if (typeof entry === "string") {
              return PF.loadJson(SECTION_DIR + encodeURIComponent(entry) + ".json")
                .then(function (data) { return { id: entry, data: data }; })
                .catch(function (error) {
                  console.error("[content] " + entry + " could not be loaded", error);
                  return null;
                });
            }
            if (entry && typeof entry === "object" && entry.id) {
              return { id: entry.id, data: entry };
            }
            return null;
          })).then(function (loaded) { return loaded.filter(Boolean); });
        });
      } else {
        var ids = (site.sections || []).map(function (entry) {
          return typeof entry === "string" ? entry : (entry && entry.id);
        }).filter(Boolean);

        sectionsPromise = Promise.all(ids.map(function (id) {
          return PF.loadJson(SECTION_DIR + encodeURIComponent(id) + ".json")
            .then(function (data) { return { id: id, data: data }; })
            .catch(function (error) {
              console.error("[content] " + id + " could not be loaded", error);
              return null;
            });
        })).then(function (loaded) { return loaded.filter(Boolean); });
      }

      return sectionsPromise.then(function (sections) {
        var headerEl = byId("header");
        headerEl.className = pageRef ? "page-header" : "";
        headerEl.innerHTML = pageRef ? pageBarMarkup(pageTitle) : headerMarkup(site);
        byId("content").innerHTML = sections.map(function (section, index) {
          return sectionMarkup(section, index, !pageRef);
        }).join("");
        if (E.typeset) E.typeset(byId("content"));
        if (PF.initSlideshows) PF.initSlideshows(byId("content"));
        if (PF.initCardMasonry) PF.initCardMasonry(byId("content"));
        if (PF.placeFilters) PF.placeFilters(byId("content"));
        if (PF.initFilters) PF.initFilters(byId("content"));
        byId("social").innerHTML = socialMarkup(site);

        if (pageRef) {
          wirePageBar();
        } else {
          fitHeader();
          requestAnimationFrame(fitHeader);
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeader);
          window.addEventListener("resize", fitHeader);
        }

        PF.initLightbox();
        PF.guardCredits();
      });
    }).catch(function (error) {
      console.error("[content] " + (pageRef ? "page" : "site") + " could not be loaded", error);
      if (pageRef) {
        fail("The page \u201c" + pageRef + "\u201d could not be loaded. Check that data/pages/" +
          String(pageRef).replace(/\.json$/i, "") + ".json exists.");
      } else {
        fail("The site file (data/site.json) could not be loaded. Run the folder from a local server.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
