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
    var href = cv.viewer || cv.file;
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
    var meta = (header.meta || []).filter(Boolean).map(function (item) {
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
      (header.eyebrow ? '<p class="eyebrow">' + PF.esc(header.eyebrow) + "</p>" : "") +
      '<h1 class="masthead__name">' + PF.esc(header.name || "") + "</h1>" +
      (header.title ? '<p class="masthead__title">' + PF.formatText(header.title) + "</p>" : "") +
      (header.role ? '<p class="masthead__role">' + PF.formatText(header.role) + "</p>" : "") +
      (header.affiliation ? '<p class="masthead__affiliation">' + PF.formatText(header.affiliation) + "</p>" : "") +
      (header.intro ? '<p class="masthead__intro">' + PF.formatText(header.intro) + "</p>" : "") +
      (meta ? '<ul class="masthead__meta">' + meta + "</ul>" : "") +
      inlineCv +
      "</div>" +
      aside +
      "</header>";
  }

  function sectionMarkup(section, index) {
    var data = section.data || {};
    var number = data.number || pad(index + 1);
    var label = data.label || data.nav || section.id;
    var flow = E.renderFlow(data);

    var lead = (data.heading || data.intro)
      ? '<div class="section-lead">' +
        (data.heading ? '<h2 class="section-title">' + PF.formatText(data.heading) + "</h2>" : "") +
        (data.intro ? '<p class="section-intro">' + PF.formatText(data.intro) + "</p>" : "") +
        "</div>"
      : "";

    var body = lead
      ? '<div class="section-body">' + lead +
        (flow ? '<div class="flow">' + flow + "</div>" : "") + "</div>"
      : (flow ? '<div class="flow">' + flow + "</div>" : "");

    return '<section class="section" id="' + PF.esc(section.id) + '">' +
      '<div class="section-head">' +
      '<span class="section-no">' + PF.esc(number) + "</span>" +
      '<span class="section-label">' + PF.esc(label) + "</span>" +
      '<span class="section-rule" aria-hidden="true"></span>' +
      "</div>" +
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

  function boot() {
    PF.loadJson(SITE_URL).then(function (site) {
      PF.setSite(site);
      PF.applyMeta(site);

      var ids = (site.sections || []).map(function (entry) {
        return typeof entry === "string" ? entry : (entry && entry.id);
      }).filter(Boolean);

      return Promise.all(ids.map(function (id) {
        return PF.loadJson(SECTION_DIR + encodeURIComponent(id) + ".json")
          .then(function (data) { return { id: id, data: data }; })
          .catch(function (error) {
            console.error("[content] " + id + " could not be loaded", error);
            return null;
          });
      })).then(function (loaded) {
        var sections = loaded.filter(Boolean);

        byId("header").innerHTML = headerMarkup(site);
        byId("content").innerHTML = sections.map(sectionMarkup).join("");
        byId("social").innerHTML = socialMarkup(site);

        fitHeader();
        requestAnimationFrame(fitHeader);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHeader);
        window.addEventListener("resize", fitHeader);

        PF.initLightbox();
        PF.guardCredits();
      });
    }).catch(function (error) {
      console.error("[content] site.json could not be loaded", error);
      fail("The site file (data/site.json) could not be loaded. Run the folder from a local server.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
