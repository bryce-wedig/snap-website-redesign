/* ------------------------------------------------------------------ *
 * Stance on Science — state page explorer (redesigned two-pane view).
 *
 * Progressive enhancement: the candidate cards are rendered server-side
 * by Jekyll (one .cand-card per candidate, each with .qa blocks). This
 * script reads those cards from the DOM, then:
 *   • builds the left "candidate directory" rail (grouped by race),
 *   • wires the filter & sort bar (tag / race / district / party /
 *     county_race + Sort By + Reset) with smart option-narrowing,
 *   • collapses each card to the matching answers when a tag is chosen,
 *   • supports race-grouped (ballot order) + flat sort modes,
 *   • adds directory search, jump-to-card, and scroll-spy.
 *
 * Scroll model: the explorer is a height-bounded box whose feed scrolls
 * internally; if it isn't bounded (mobile / single column) it falls back
 * to window scrolling with a sticky-nav offset. A timer-driven tween is
 * used so smooth-scroll still runs in throttled/hidden preview frames.
 * ------------------------------------------------------------------ */

(function () {
  "use strict";

  var RACE_ORDER = [
    "US Senate", "US House of Representatives", "Governor", "Secretary of State",
    "Attorney General", "State Board of Education", "University Board of Regents",
    "State Senate", "State House of Representatives", "Local County Races [All]", "Mayor"
  ];

  var SORT_LABEL = {
    random: "Random", newest: "Newest", oldest: "Oldest",
    alpha: "Last name A–Z", "alpha-rev": "Last name Z–A"
  };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function raceLabel(r) { return (r || "").replace(" [All]", ""); }

  // Read one candidate record from its server-rendered card.
  function recordFromCard(card) {
    var qaEls = [].slice.call(card.querySelectorAll(".qa"));
    var answers = qaEls.map(function (qa) {
      var tagAttr = qa.getAttribute("data-tags") || "";
      return { el: qa, tags: tagAttr ? tagAttr.split("|") : [] };
    });
    return {
      el: card,
      id: card.id,
      name: card.getAttribute("data-name") || "",
      last: card.getAttribute("data-last") || "",
      race: card.getAttribute("data-race") || "",
      district: card.getAttribute("data-district") || "",
      party: card.getAttribute("data-party") || "",
      county_race: card.getAttribute("data-county-race") || "",
      date: card.getAttribute("data-date") || "",
      dateDisplay: card.getAttribute("data-date-display") || "",
      answered: parseInt(card.getAttribute("data-answered"), 10) || answers.length,
      qtotal: parseInt(card.getAttribute("data-qtotal"), 10) || answers.length,
      location: card.getAttribute("data-location") || "Statewide",
      sub: card.querySelector(".cand-card__sub"),
      answers: answers
    };
  }

  function init() {
    var bar = document.getElementById("state-filters");
    var feed = document.getElementById("feed-scroll");
    var feedList = document.getElementById("feed-list");
    var navList = document.getElementById("rail-list");
    var countLine = document.getElementById("results-count");
    var search = document.getElementById("rail-search");
    var stickyTopEl = document.querySelector(".nav") || document.querySelector(".navbar") || document.querySelector("header");
    if (!bar || !feedList || !navList) return;

    var selects = {};
    bar.querySelectorAll("select[data-filter]").forEach(function (s) { selects[s.dataset.filter] = s; });
    var sortSel = bar.querySelector("[data-sort]");
    var resetBtn = bar.querySelector("[data-filter-reset]");

    var query = "";
    var currentId = null;
    var navMap = {};
    var cardEls = [];

    var records = [].slice.call(feedList.querySelectorAll(".cand-card")).map(recordFromCard);
    var totalCandidates = records.length;
    records.forEach(function (r) { r._rand = Math.random(); });

    /* ---- matching ---- */
    function readFilters() {
      var f = {};
      for (var k in selects) if (selects[k].value) f[k] = selects[k].value;
      return f;
    }
    function candMatch(c, f, except) {
      if (except !== "tag" && f.tag && !c.answers.some(function (a) { return a.tags.indexOf(f.tag) !== -1; })) return false;
      if (except !== "race" && f.race && c.race !== f.race) return false;
      if (except !== "district" && f.district && String(c.district) !== String(f.district)) return false;
      if (except !== "party" && f.party && c.party !== f.party) return false;
      if (except !== "county_race" && f.county_race && c.county_race !== f.county_race) return false;
      return true;
    }
    function matchCand(c, f) {
      if (query && c.name.indexOf(query) === -1) return false;
      return candMatch(c, f, null);
    }
    function sortCands(arr, sv) {
      var a = arr.slice();
      if (sv === "alpha") a.sort(function (x, y) { return x.last.localeCompare(y.last); });
      else if (sv === "alpha-rev") a.sort(function (x, y) { return y.last.localeCompare(x.last); });
      else if (sv === "newest") a.sort(function (x, y) { return (y.date || "").localeCompare(x.date || "") || x.last.localeCompare(y.last); });
      else if (sv === "oldest") a.sort(function (x, y) { return (x.date || "").localeCompare(y.date || "") || x.last.localeCompare(y.last); });
      else if (sv === "random") a.sort(function (x, y) { return x._rand - y._rand; });
      return a;
    }
    function racesPresent() {
      var set = {};
      records.forEach(function (c) { set[c.race] = true; });
      var ordered = RACE_ORDER.filter(function (r) { return set[r]; });
      // append any race not in the canonical order, alphabetically
      Object.keys(set).sort().forEach(function (r) { if (ordered.indexOf(r) === -1) ordered.push(r); });
      return ordered;
    }

    /* ---- per-card display (tag collapse + sub line) ---- */
    function applyCardDisplay(c, f) {
      var shown = 0;
      c.answers.forEach(function (a) {
        var on = !f.tag || a.tags.indexOf(f.tag) !== -1;
        a.el.hidden = !on;
        if (on) shown += 1;
        a.el.querySelectorAll(".badge--tag").forEach(function (b) {
          b.classList.toggle("badge--tag-on", !!f.tag && b.getAttribute("data-tag") === f.tag);
        });
      });
      if (c.sub) {
        if (f.tag) {
          c.sub.textContent = shown + (shown === 1 ? " response" : " responses") + " tagged " + f.tag;
        } else {
          c.sub.textContent = c.sub.getAttribute("data-sub-default") || c.sub.textContent;
        }
      }
      return shown;
    }

    function navItem(c, f) {
      var item = el("button", { class: "rail-item", type: "button", "data-id": c.id }, [
        el("span", { class: "rail-item__body" }, [
          el("span", { class: "rail-item__name", text: c.name.replace(/\b\w/g, function (m) { return m.toUpperCase(); }) })
        ])
      ]);
      // Use the human card name instead of the downcased data-name.
      var nameEl = item.querySelector(".rail-item__name");
      var cardName = c.el.querySelector(".cand-card__name");
      if (cardName) nameEl.textContent = cardName.textContent;
      item.addEventListener("click", function () { jumpTo(c.id); });
      return item;
    }

    /* ---- rebuild ---- */
    function rebuild(focusId) {
      var f = readFilters();
      var sv = sortSel ? sortSel.value : "random";
      navList.innerHTML = "";
      cardEls = [];
      navMap = {};
      currentId = null;

      var matched = records.filter(function (c) { return matchCand(c, f); });
      var totalR = 0;
      matched.forEach(function (c) {
        totalR += f.tag ? c.answers.filter(function (a) { return a.tags.indexOf(f.tag) !== -1; }).length : c.answers.length;
      });

      // hide everything first, then re-append matched in order
      records.forEach(function (c) { c.el.hidden = true; });
      // remove any existing race headers / empty state we injected
      [].slice.call(feedList.querySelectorAll(".feed-race, .feed-empty")).forEach(function (n) { n.remove(); });

      function emit(c) {
        applyCardDisplay(c, f);
        c.el.hidden = false;
        feedList.appendChild(c.el);
        navList.appendChild(navMap[c.id] = navItem(c, f));
        cardEls.push({ id: c.id, el: c.el });
      }

      if (sv === "race") {
        racesPresent().forEach(function (race) {
          var cands = sortCands(matched.filter(function (c) { return c.race === race; }), "alpha");
          if (!cands.length) return;
          navList.appendChild(el("div", { class: "rail-group", text: raceLabel(race) }));
          feedList.appendChild(el("h3", { class: "feed-race", text: raceLabel(race) }));
          cands.forEach(emit);
        });
      } else {
        navList.appendChild(el("div", { class: "rail-group", text: "Sorted · " + (SORT_LABEL[sv] || sv) }));
        sortCands(matched, sv).forEach(emit);
      }

      var anyFilter = f.tag || f.race || f.district || f.party || f.county_race || query;
      var label = "Showing " + matched.length + " of " + totalCandidates + (matched.length === 1 ? " candidate" : " candidates");
      if (f.tag) label += " · " + totalR + (totalR === 1 ? " response" : " responses") + " on " + f.tag;
      if (countLine) {
        countLine.textContent = label;
        countLine.classList.toggle("is-filtered", !!anyFilter);
      }

      if (!matched.length) {
        feedList.appendChild(el("p", { class: "feed-empty", text: "No candidates match these filters — try clearing one." }));
      }

      narrow(f);
      // After Reset we keep the previously selected candidate in view and
      // highlighted instead of yanking both panes to the top.
      if (focusId && navMap[focusId]) {
        scrollFeedToCard(focusId);
        setActive(focusId, false);
      } else {
        if (feed) feed.scrollTop = 0;
        updateActive();
      }
    }

    /* ---- option narrowing ---- */
    function validValues(key, f) {
      var set = Object.create(null);
      records.forEach(function (c) {
        if (!candMatch(c, f, key)) return;
        if (key === "tag") c.answers.forEach(function (a) { a.tags.forEach(function (t) { set[t] = true; }); });
        else { var v = c[key]; if (v != null && v !== "") set[String(v)] = true; }
      });
      return set;
    }
    function narrow(f) {
      for (var key in selects) {
        var sel = selects[key], valid = validValues(key, f), cur = sel.value;
        for (var i = 0; i < sel.options.length; i++) {
          var o = sel.options[i];
          o.hidden = !(o.value === "" || o.value === cur || valid[o.value]);
        }
      }
    }

    /* ---- scroll + jump ---- */
    function feedScrolls() { return feed && feed.scrollHeight - feed.clientHeight > 40; }
    function topInset() { return (stickyTopEl ? stickyTopEl.offsetHeight : 0) + 14; }
    function relTop(elm) { return elm.getBoundingClientRect().top - feed.getBoundingClientRect().top + feed.scrollTop; }
    function prefersReduced() {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    function animate(getCur, setCur, target, dur) {
      var start = getCur(), delta = target - start, t0 = Date.now();
      if (Math.abs(delta) < 2 || prefersReduced()) { setCur(target); return; }
      var timer = window.setInterval(function () {
        var p = Math.min(1, (Date.now() - t0) / dur);
        var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        setCur(start + delta * e);
        if (p >= 1) { setCur(target); window.clearInterval(timer); }
      }, 16);
    }
    // Instantly position the feed so the given card sits at the top of view.
    function scrollFeedToCard(id) {
      var entry = cardEls.filter(function (x) { return x.id === id; })[0];
      if (!entry) return;
      if (feedScrolls()) {
        feed.scrollTop = Math.max(0, relTop(entry.el) - 8);
      } else {
        var y = entry.el.getBoundingClientRect().top + window.pageYOffset - topInset() - 6;
        window.scrollTo(0, Math.max(0, y));
      }
    }
    var navScrollLock = null;
    function jumpTo(id) {
      var found = cardEls.filter(function (x) { return x.id === id; })[0];
      if (!found) return;
      // Suppress directory auto-scroll while the click-initiated feed
      // animation runs, otherwise the scroll-spy would scroll the rail too.
      if (navScrollLock) window.clearTimeout(navScrollLock);
      navScrollLock = window.setTimeout(function () { navScrollLock = null; }, 520);
      if (feedScrolls()) {
        animate(function () { return feed.scrollTop; }, function (v) { feed.scrollTop = v; }, Math.max(0, relTop(found.el) - 8), 460);
      } else {
        var y = found.el.getBoundingClientRect().top + window.pageYOffset - topInset() - 6;
        animate(function () { return window.pageYOffset; }, function (v) { window.scrollTo(0, v); }, Math.max(0, y), 460);
      }
      setActive(id, true);
    }
    function setActive(id, fromClick) {
      if (id === currentId) return;
      currentId = id;
      for (var k in navMap) navMap[k].classList.toggle("is-active", k === id);
      var item = navMap[id];
      if (item && !fromClick && !navScrollLock) {
        // offsetTop is relative to the nearest positioned ancestor (not the
        // rail), so measure against navList directly to stay correct.
        var top = item.getBoundingClientRect().top - navList.getBoundingClientRect().top + navList.scrollTop;
        var bot = top + item.offsetHeight;
        if (top < navList.scrollTop) navList.scrollTop = top - 12;
        else if (bot > navList.scrollTop + navList.clientHeight) navList.scrollTop = bot - navList.clientHeight + 12;
      }
    }
    function updateActive() {
      // While a click-initiated jump animation runs, the feed is scrolling
      // programmatically toward the target; skip the scroll-spy so it doesn't
      // sweep the highlight across every candidate it passes.
      if (navScrollLock) return;
      if (!cardEls.length) { currentId = null; return; }
      var active = cardEls[0].id, i;
      if (feedScrolls()) {
        var fline = feed.scrollTop + 16;
        for (i = 0; i < cardEls.length; i++) { if (relTop(cardEls[i].el) <= fline) active = cardEls[i].id; else break; }
      } else {
        var wline = topInset() + 20;
        for (i = 0; i < cardEls.length; i++) { if (cardEls[i].el.getBoundingClientRect().top <= wline) active = cardEls[i].id; else break; }
      }
      setActive(active);
    }
    var spyPending = null;
    function onScroll() {
      updateActive();
      if (spyPending) window.clearTimeout(spyPending);
      spyPending = window.setTimeout(updateActive, 60);
    }
    if (feed) feed.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ---- wire ---- */
    for (var k in selects) selects[k].addEventListener("change", rebuild);
    if (sortSel) sortSel.addEventListener("change", rebuild);
    if (search) search.addEventListener("input", function () { query = search.value.toLowerCase().trim(); rebuild(); });
    if (resetBtn) resetBtn.addEventListener("click", function () {
      // Reset filters, search, and sort (back to the default) while
      // re-focusing the selected candidate.
      var focusId = currentId;
      for (var key in selects) selects[key].value = "";
      if (sortSel) sortSel.value = "random";
      if (search) search.value = "";
      query = "";
      rebuild(focusId);
    });

    rebuild();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
