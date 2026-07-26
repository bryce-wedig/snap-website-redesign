// Height-matching for the "Meet the Team" strip on Stance on Science state pages.
//
// Instagram embeds set their own height asynchronously (embed.js swaps the
// blockquote for an iframe and sizes it after the post loads). To keep every
// card the same height, we measure the tallest Instagram card and apply that
// height to the image cards; their CSS width is auto, so each image widens to
// keep its aspect ratio at the shared height. Re-runs whenever an embed resizes.

(function () {
  "use strict";

  function setupSection(section) {
    var igCards = Array.prototype.slice.call(
      section.querySelectorAll(".stance-team__card--ig")
    );
    var imgCards = Array.prototype.slice.call(
      section.querySelectorAll(".stance-team__card:not(.stance-team__card--ig)")
    );
    // Nothing to match against (or nothing to resize) — leave the CSS default.
    if (!igCards.length || !imgCards.length) return;

    function apply() {
      var h = 0;
      igCards.forEach(function (card) {
        h = Math.max(h, card.offsetHeight);
      });
      if (h <= 0) return;
      imgCards.forEach(function (card) {
        card.style.height = h + "px";
      });
    }

    // Instagram sizes its iframe after load, so react to size changes.
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(apply);
      igCards.forEach(function (card) { ro.observe(card); });
    }
    window.addEventListener("load", apply);
    window.addEventListener("resize", apply);
    apply();
  }

  function init() {
    var sections = document.querySelectorAll(".stance-team");
    Array.prototype.forEach.call(sections, setupSection);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
