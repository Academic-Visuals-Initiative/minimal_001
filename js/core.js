/* ==========================================================================
   core.js — the small shared layer.

   Loads JSON, escapes text, resolves links and images, formats inline
   markup, owns the theme, the reveal animation, the lightbox and the
   credit line. No dependencies.
   ========================================================================== */
(function (global) {
  "use strict";

  var PF = {};

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

  PF.resolveLink = function (value) {
    var link = String(value == null ? "" : value).trim();
    if (!link) return "";
    if (link.charAt(0) !== "@") return link;

    var key = link.slice(1);
    if (key === "top") return "#top";
    if (key === "email") return "mailto:" + (site && site.header && site.header.email ? site.header.email : "");
    if (key === "cv") {
      var cv = site && site.header && site.header.cv;
      return cv ? (cv.viewer || cv.file || "") : "";
    }
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

     **bold**  *italic*  `code`  ==highlight==  ~~strike~~
     [label](link)   and a newline becomes a line break.
  ------------------------------------------------------------------------ */

  PF.formatText = function (value) {
    var text = String(value == null ? "" : value);
    if (!text) return "";

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

    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    out = out.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    out = out.replace(/\n/g, "<br>");

    out = out.replace(/\u0000C(\d+)\u0000/g, function (m, index) {
      return "<code>" + codes[Number(index)] + "</code>";
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
