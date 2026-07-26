// Topic Hub view for Stance on Science state pages.
//
// The page is rendered (server-side) as a grid of topic tiles plus one hidden
// panel of response cards per topic. This script wires up tile selection and
// the per-panel race-filter chips. No response data lives here — it only shows
// and hides what Liquid already emitted.

(function () {
  "use strict";

  function init() {
    var root = document.querySelector("[data-topic-hub]");
    if (!root) return;

    var tiles = root.querySelectorAll(".stance-topic-tile[data-topic]");
    var panels = root.querySelectorAll(".stance-topic-panel[data-topic-panel]");
    var placeholder = root.querySelector("[data-topic-placeholder]");

    function showPanel(topic) {
      var found = false;
      panels.forEach(function (panel) {
        var match = panel.getAttribute("data-topic-panel") === topic;
        panel.hidden = !match;
        if (match) found = true;
      });
      if (placeholder) placeholder.hidden = found;

      tiles.forEach(function (tile) {
        tile.classList.toggle("is-active", tile.getAttribute("data-topic") === topic);
      });
    }

    tiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        var topic = tile.getAttribute("data-topic");
        if (tile.classList.contains("is-active")) {
          showPanel(null);
        } else {
          showPanel(topic);
        }
      });
    });

    // Wire up the race-filter chips and the "show primary candidates" toggle
    // inside each panel. Primary candidates (who didn't advance past the
    // primary) are hidden by default; the checkbox reveals them.
    panels.forEach(function (panel) {
      var chips = panel.querySelectorAll(".stance-chip[data-race-filter]");
      var cards = panel.querySelectorAll(".stance-response-card");
      var countEl = panel.querySelector("[data-panel-count]");
      var primaryChk = panel.querySelector("[data-topic-primary]");
      var race = "";

      function apply() {
        var visible = 0;
        cards.forEach(function (card) {
          var raceMatch = !race || card.getAttribute("data-race") === race;
          var primaryHidden = !(primaryChk && primaryChk.checked) &&
            card.getAttribute("data-primary-candidate") === "true";
          var match = raceMatch && !primaryHidden;
          card.hidden = !match;
          if (match) visible += 1;
        });
        if (countEl) countEl.textContent = String(visible);
        chips.forEach(function (chip) {
          chip.classList.toggle("is-active", chip.getAttribute("data-race-filter") === race);
        });
      }

      chips.forEach(function (chip) {
        chip.addEventListener("click", function () {
          race = chip.getAttribute("data-race-filter");
          apply();
        });
      });
      if (primaryChk) primaryChk.addEventListener("change", apply);

      apply();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
