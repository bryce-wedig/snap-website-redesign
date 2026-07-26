// Search page for /initiatives/stance-on-science/search.
//
// Fetches the pre-rendered responses JSON, populates a list of cards, and
// reactively re-renders when the user types in the search box or changes any
// of the filter dropdowns. Filter state is mirrored to the URL hash so links
// are shareable.

(function () {
  "use strict";

  var FILTER_KEYS = ["tag", "race", "district", "party", "state", "county_race"];

  function sortResponses(arr, sortVal) {
    if (sortVal === "newest") return arr.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    if (sortVal === "oldest") return arr.slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    if (sortVal === "alpha") return arr.slice().sort(function (a, b) { return a.candidate_last_name.localeCompare(b.candidate_last_name); });
    if (sortVal === "alpha-rev") return arr.slice().sort(function (a, b) { return b.candidate_last_name.localeCompare(a.candidate_last_name); });
    return arr;
  }

  function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  }

  // Tests whether a response matches the current filter state. `except` (a
  // filter key) lets the caller omit one filter so we can ask "which values
  // would still be valid for THIS dropdown given everything else?"
  function matches(r, state, statesMeta, except) {
    // Primary candidates (who didn't advance past the primary) are hidden unless
    // the "Show primary candidates" box is checked. Unkeyed, so option-narrowing
    // (validValuesFor) respects it too.
    if (!state.show_primary && r.primary_candidate) return false;
    if (except !== "tag" && state.tag && toArray(r.tag).indexOf(state.tag) === -1) return false;
    if (except !== "race" && state.race && r.race !== state.race) return false;
    if (except !== "district" && state.district && String(r.district) !== String(state.district)) return false;
    if (except !== "party" && state.party && r.party !== state.party) return false;
    if (except !== "state" && state.state && r.state !== state.state) return false;
    if (except !== "county_race" && state.county_race && r.county_race !== state.county_race) return false;
    if (state.q) {
      var ql = state.q.toLowerCase();
      var stateName = (statesMeta[r.state] && statesMeta[r.state].name) || r.state;
      var hay = (r.candidate + " " + stateName +
                 " " + r.race + " " + (r.district != null ? "district " + r.district : "") +
                 " " + (r.county_race || "") +
                 " " + toArray(r.tag).join(" ") + " " + (r.response_md || "")).toLowerCase();
      if (hay.indexOf(ql) === -1) return false;
    }
    return true;
  }

  // Cards are pre-rendered server-side by the shared Liquid include
  // (_includes/stance/response_card.html) and shipped as `card_html` in the
  // JSON feed, so this is the single source of truth for card markup.
  function renderCard(r) {
    return r.card_html;
  }

  // Returns the set (as an object map) of values that key `K` takes across all
  // responses that pass every filter EXCEPT the one for K.
  function validValuesFor(key, responses, state, statesMeta) {
    var set = Object.create(null);
    for (var i = 0; i < responses.length; i++) {
      var r = responses[i];
      if (!matches(r, state, statesMeta, key)) continue;
      if (key === "tag") {
        var tags = toArray(r.tag);
        for (var j = 0; j < tags.length; j++) set[tags[j]] = true;
      } else if (key === "district") {
        if (r.district != null) set[String(r.district)] = true;
      } else {
        var v = r[key];
        if (v != null && v !== "") set[v] = true;
      }
    }
    return set;
  }

  function updateOptionVisibility(selects, responses, state, statesMeta) {
    selects.forEach(function (sel) {
      var key = sel.dataset.filter;
      var valid = validValuesFor(key, responses, state, statesMeta);
      var current = sel.value;
      var opts = sel.options;
      for (var i = 0; i < opts.length; i++) {
        var opt = opts[i];
        if (opt.value === "") { opt.hidden = false; continue; }
        if (opt.value === current) { opt.hidden = false; continue; }
        opt.hidden = !valid[opt.value];
      }
    });
  }

  // For dropdowns that the server didn't pre-populate (e.g. County Race on
  // global search), build the option list once from the data.
  function populateOptionsFromData(sel, responses) {
    if (sel.options.length > 1) return; // already populated
    var key = sel.dataset.filter;
    var values = Object.create(null);
    for (var i = 0; i < responses.length; i++) {
      var r = responses[i];
      var v = key === "district" ? (r.district != null ? String(r.district) : null) : r[key];
      if (v != null && v !== "") values[v] = true;
    }
    var sorted = Object.keys(values).sort(function (a, b) {
      // Natural order for districts ("2" before "10", "14" before "14A");
      // plain lexical order for every other filter key.
      if (key === "district") {
        var ai = parseInt(a, 10), bi = parseInt(b, 10);
        if (!isNaN(ai) && !isNaN(bi) && ai !== bi) return ai - bi;
      }
      return a.localeCompare(b);
    });
    for (var k = 0; k < sorted.length; k++) {
      var opt = document.createElement("option");
      opt.value = sorted[k];
      opt.textContent = sorted[k];
      sel.appendChild(opt);
    }
  }

  function parseHashFilters() {
    var hash = window.location.hash || "";
    if (hash.charAt(0) === "#") hash = hash.slice(1);
    if (hash.charAt(0) === "?") hash = hash.slice(1);
    var out = { q: "" };
    if (!hash) return out;
    hash.split("&").forEach(function (pair) {
      if (!pair) return;
      var idx = pair.indexOf("=");
      var k = idx === -1 ? pair : pair.slice(0, idx);
      var v = idx === -1 ? "" : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, " "));
      out[decodeURIComponent(k)] = v;
    });
    return out;
  }

  function writeHashFilters(state) {
    var parts = [];
    if (state.q) parts.push("q=" + encodeURIComponent(state.q));
    FILTER_KEYS.forEach(function (k) {
      if (state[k]) parts.push(k + "=" + encodeURIComponent(state[k]));
    });
    var newHash = parts.length ? "#?" + parts.join("&") : "";
    if (newHash !== window.location.hash) {
      // Replace state so the back button doesn't fill with filter changes.
      history.replaceState(null, "", window.location.pathname + window.location.search + newHash);
    }
  }

  function init() {
    var root = document.getElementById("stance-search");
    if (!root) return;
    var listEl = root.querySelector("[data-results-list]");
    var countEl = root.querySelector("[data-results-count]");
    var totalEl = root.querySelector("[data-results-total]");
    var emptyEl = root.querySelector("[data-empty-state]");
    var input = root.querySelector("[data-search-input]");
    var selects = root.querySelectorAll("select[data-filter]");
    var sortSel = root.querySelector("[data-sort]");
    var reset = root.querySelector("[data-filter-reset]");
    var primaryChk = root.querySelector("[data-filter-primary]");

    var url = window.STANCE_RESPONSES_URL || "/initiatives/stance-on-science/responses.json";

    fetch(url, { credentials: "same-origin" })
      .then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(function (data) {
        var responses = data.responses || [];
        for (var _i = responses.length - 1; _i > 0; _i--) {
          var _j = Math.floor(Math.random() * (_i + 1));
          var _t = responses[_i]; responses[_i] = responses[_j]; responses[_j] = _t;
        }
        var states = data.states || {};
        if (totalEl) totalEl.textContent = String(responses.length);

        selects.forEach(function (sel) { populateOptionsFromData(sel, responses); });

        var initial = parseHashFilters();
        if (input && initial.q) input.value = initial.q;
        selects.forEach(function (sel) {
          var key = sel.dataset.filter;
          if (initial[key]) sel.value = initial[key];
        });

        function currentState() {
          var s = { q: input ? input.value.trim() : "" };
          selects.forEach(function (sel) { s[sel.dataset.filter] = sel.value; });
          s.sort = sortSel ? sortSel.value : "random";
          s.show_primary = primaryChk ? primaryChk.checked : false;
          return s;
        }

        function apply() {
          var state = currentState();
          var matched = responses.filter(function (r) {
            return matches(r, state, states, null);
          });
          var visible = sortResponses(matched, state.sort);

          if (listEl) {
            if (visible.length === 0) {
              listEl.innerHTML = "";
            } else {
              listEl.innerHTML = visible.map(renderCard).join("");
            }
          }
          if (countEl) countEl.textContent = String(visible.length);
          if (emptyEl) emptyEl.hidden = visible.length !== 0;
          updateOptionVisibility(selects, responses, state, states);
          writeHashFilters(state);
        }

        if (input) input.addEventListener("input", apply);
        selects.forEach(function (sel) { sel.addEventListener("change", apply); });
        if (sortSel) sortSel.addEventListener("change", apply);
        if (primaryChk) primaryChk.addEventListener("change", apply);
        if (reset) {
          reset.addEventListener("click", function () {
            if (input) input.value = "";
            selects.forEach(function (sel) { sel.value = ""; });
            if (sortSel) sortSel.value = "random";
            if (primaryChk) primaryChk.checked = false;
            apply();
          });
        }

        // Clicking a badge that carries data-filter (question tag or state)
        // applies it to the matching dropdown; clicking the already-active value
        // clears it. Delegated on listEl since cards are re-rendered on every
        // apply(). Dispatching `change` reuses the existing listener, which
        // re-renders and mirrors the filter into the URL hash.
        function filterFromEvent(e) {
          if (!listEl) return;
          var badge = e.target.closest && e.target.closest(".stance-badge[data-filter]");
          if (!badge || !listEl.contains(badge)) return;
          var key = badge.getAttribute("data-filter");
          var value = badge.getAttribute("data-" + key);
          if (!key || !value) return;
          var sel = root.querySelector('select[data-filter="' + key + '"]');
          if (!sel) return;
          e.preventDefault();
          sel.value = sel.value === value ? "" : value;
          sel.dispatchEvent(new Event("change"));
        }
        if (listEl) {
          listEl.addEventListener("click", filterFromEvent);
          listEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") filterFromEvent(e);
          });
        }

        apply();
      })
      .catch(function (err) {
        if (listEl) {
          listEl.innerHTML = '<p><em>Could not load responses. Please try again later.</em></p>';
        }
        // eslint-disable-next-line no-console
        console.error("stance-search: failed to load", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
