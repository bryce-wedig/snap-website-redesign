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

    function showRace(race) {
      blocks.forEach(function (block) {
        block.hidden = block.getAttribute("data-compare-table") !== race;
      });
    }

    if (raceSel) {
      raceSel.addEventListener("change", function () { showRace(raceSel.value); });
      showRace(raceSel.value);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
