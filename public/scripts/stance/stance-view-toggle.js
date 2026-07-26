// View switch for Stance on Science state pages.
//
// The same candidate responses are rendered server-side three ways inside the
// #responses section — one [data-view-panel] each for "candidate", "topic", and
// "compare". This script shows one panel at a time when a toggle button is
// clicked. Each view's own behaviour (filtering, sorting, etc.) is handled by
// its dedicated script; this only flips which panel is visible.

(function () {
  "use strict";

  function init() {
    var root = document.getElementById("responses");
    if (!root) return;

    var buttons = root.querySelectorAll("[data-view-btn]");
    var panels = root.querySelectorAll("[data-view-panel]");
    if (!buttons.length || !panels.length) return;

    function show(view) {
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-view-panel") !== view;
      });
      buttons.forEach(function (btn) {
        var active = btn.getAttribute("data-view-btn") === view;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var savedY = window.scrollY;
        show(btn.getAttribute("data-view-btn"));
        window.scrollTo(0, savedY);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
