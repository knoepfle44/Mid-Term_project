/* ==========================================================================
   story.js – Scrollytelling logic.
   Responsibility: detect which chapter is in view and tell the map what to do
   (fly to a position, show/hide layers). It does NOT draw anything itself;
   all map work is done through the API exposed by map.js (window.StoryMap).

   Requires (loaded before this file): map.js
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. CHAPTER CONFIGURATION
   One entry per <section class="chapter" data-chapter="..."> in index.html.
   The `id` MUST match the data-chapter attribute.

   center : [lat, lng] the map flies to
   zoom   : zoom level (see MIN_ZOOM / MAX_ZOOM in map.js)
   layers : layer keys that are visible in this chapter
            ("wifi", "bike", "charging", "districts")

   To change the story, you only edit this list (and the texts in index.html).
   -------------------------------------------------------------------------- */
const CHAPTERS = [
  {
    id: "intro",
    center: [48.2082, 16.3738],
    zoom: 11,
    layers: ["districts"]
  },
  {
    id: "wifi",
    center: [48.2086, 16.3725],   // inner city
    zoom: 13,
    layers: ["districts", "wifi"]
  },
  {
    id: "bike",
    center: [48.2000, 16.3700],
    zoom: 12,
    layers: ["districts", "wifi", "bike"]
  },
  {
    id: "charging",
    center: [48.2100, 16.4100],
    zoom: 12,
    layers: ["districts", "bike", "charging"]
  },
  {
    id: "conclusion",
    center: [48.2082, 16.3738],
    zoom: 11,
    layers: ["districts", "wifi", "bike", "charging"]   // everything together
  }
];

// Name of the CSS class that highlights the current chapter (see style.css)
const ACTIVE_CLASS = "is-active";


/* --------------------------------------------------------------------------
   2. ACTIVATING A CHAPTER
   -------------------------------------------------------------------------- */

// Remember which chapter is active so we don't repeat work on every scroll tick
let activeChapterId = null;

/**
 * Makes one chapter the active one:
 *  - highlights its text,
 *  - moves the map,
 *  - switches the layers.
 * @param {string} chapterId - the chapter's id from CHAPTERS
 */
function activateChapter(chapterId) {
  if (chapterId === activeChapterId) return;   // nothing changed
  activeChapterId = chapterId;

  const chapter = CHAPTERS.find((c) => c.id === chapterId);
  if (!chapter) {
    console.warn(`[story.js] No configuration found for chapter "${chapterId}"`);
    return;
  }

  // 1. Text: only the active chapter is fully visible
  document.querySelectorAll(".chapter").forEach((section) => {
    section.classList.toggle(ACTIVE_CLASS, section.dataset.chapter === chapterId);
  });

  // 2. Map: switch layers first, then fly to the new view
  window.StoryMap.setVisibleLayers(chapter.layers);
  window.StoryMap.flyToView(chapter.center, chapter.zoom);
}


/* --------------------------------------------------------------------------
   3. SCROLL DETECTION with IntersectionObserver
   The observer fires when a chapter crosses the middle band of the screen.
   rootMargin "-45% 0px -45% 0px" shrinks the detection area to a thin
   horizontal strip in the middle of the viewport, so exactly one chapter
   is "intersecting" at a time.
   -------------------------------------------------------------------------- */
function initScrollObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activateChapter(entry.target.dataset.chapter);
        }
      });
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
  );

  document.querySelectorAll(".chapter").forEach((section) => observer.observe(section));
}


/* --------------------------------------------------------------------------
   4. START
   Wait until map.js has loaded the data and created the layers,
   otherwise setVisibleLayers() would run on layers that don't exist yet.
   -------------------------------------------------------------------------- */
window.StoryMap.ready.then(() => {
  activateChapter(CHAPTERS[0].id);   // start with the introduction
  initScrollObserver();
});