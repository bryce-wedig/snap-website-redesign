// "Compare" view for Stance on Science state pages.
//
// The page is rendered (server-side) as one block per race, each grouping the
// candidate answers under their question. This script swaps which race's block
// is visible based on the race selector.

(function () {
  "use strict";

  function init() {
    var root = document.querySelector("[data-compare]");
    if (!root) return;

    var raceSel = root.querySelector("[data-compare-race]");
    var blocks = root.querySelectorAll("[data-compare-table]");
    var primaryChk = root.querySelector("[data-compare-primary]");

    function showRace(race) {
      blocks.forEach(function (block) {
        block.hidden = block.getAttribute("data-compare-table") !== race;
      });
    }

    // Primary candidates (who didn't advance past the primary) are hidden by
    // default; the checkbox reveals their columns across every question row.
    function applyPrimary() {
      var show = primaryChk && primaryChk.checked;
      root.querySelectorAll('.stance-compare-card[data-primary-candidate="true"]').forEach(function (card) {
        card.hidden = !show;
      });
    }

    if (raceSel) {
      raceSel.addEventListener("change", function () { showRace(raceSel.value); });
      showRace(raceSel.value);
    }
    if (primaryChk) primaryChk.addEventListener("change", applyPrimary);
    applyPrimary();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
