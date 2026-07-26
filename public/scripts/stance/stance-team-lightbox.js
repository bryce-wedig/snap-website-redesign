// Lightbox for the "Meet the Team" strip on Stance on Science state pages.
//
// Clicking an image card (the finished graphic cards, not the Instagram embeds)
// opens a full-screen overlay showing that image. Prev/next buttons and the
// left/right arrow keys move through the image cards; Escape or a backdrop click
// closes it. Each .stance-team section is wired up independently and reuses the
// .stance-team__lightbox markup already present inside it.

(function () {
  "use strict";

  function setupSection(section) {
    var imgs = Array.prototype.slice.call(
      section.querySelectorAll(".stance-team__img")
    );
    var box = section.querySelector(".stance-team__lightbox");
    if (!imgs.length || !box) return;

    var lbImg = box.querySelector(".stance-team__lb-img");
    var closeBtn = box.querySelector(".stance-team__lb-close");
    var prevBtn = box.querySelector(".stance-team__lb-prev");
    var nextBtn = box.querySelector(".stance-team__lb-next");
    var single = imgs.length < 2;

    var current = 0;
    var lastFocused = null;

    // Prev/next are pointless with a single image.
    if (single) {
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    }

    function render() {
      var img = imgs[current];
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || "";
    }

    function open(index) {
      current = index;
      render();
      lastFocused = document.activeElement;
      box.hidden = false;
      document.body.style.overflow = "hidden"; // stop background scroll
      // Defer focus until after the element is shown.
      window.requestAnimationFrame(function () {
        closeBtn.focus();
      });
    }

    function close() {
      box.hidden = true;
      document.body.style.overflow = "";
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    function go(delta) {
      if (single) return;
      current = (current + delta + imgs.length) % imgs.length;
      render();
    }

    // Make each image card behave like a button.
    imgs.forEach(function (img, index) {
      img.classList.add("stance-team__img--zoomable");
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
      img.setAttribute("aria-label", "Enlarge image" + (img.alt ? ": " + img.alt : ""));

      img.addEventListener("click", function () {
        open(index);
      });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          open(index);
        }
      });
    });

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () { go(-1); });
    nextBtn.addEventListener("click", function () { go(1); });

    // Click on the backdrop (but not on the image or a button) closes.
    box.addEventListener("click", function (e) {
      if (e.target === box) close();
    });

    // Keyboard handling while the lightbox is open.
    document.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    });
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
