/* ==========================================================================
   data.js – Loads the GeoJSON files used by the map.
   Responsibility: ONLY data loading (no map code, no DOM code).

   Usage (from map.js):
       const data = await loadAllData();
       data.wifi      -> GeoJSON FeatureCollection
       data.bike      -> GeoJSON FeatureCollection
       ...

   NOTE: fetch() does not work when index.html is opened by double-click
   (file://). Use a local server, e.g. the VS Code extension "Live Server"
   or `python -m http.server` in the project folder.
   ========================================================================== */

/**
 * Maps a layer key (used everywhere in the project, e.g. in the legend's
 * data-layer attribute) to the path of its GeoJSON file.
 * To add a new layer: add a line here, a checkbox in index.html and a
 * style in map.js.
 */
const DATA_FILES = {
  wifi:      "data/wlan.geojson",
  bike:      "data/bike.geojson",
  charging:  "data/charging.geojson",
  districts: "data/districts.geojson"
};

/** An empty FeatureCollection, used as fallback if a file cannot be loaded. */
const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

/**
 * Loads one GeoJSON file.
 * @param {string} url - path to the .geojson file
 * @returns {Promise<Object>} parsed GeoJSON
 * @throws if the request fails or the file is not valid JSON
 */
async function loadGeoJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Loads all files listed in DATA_FILES in parallel.
 * If one file fails, we log the error and use an empty layer instead,
 * so the rest of the map still works.
 * @returns {Promise<Object>} object with one GeoJSON per layer key
 */
async function loadAllData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => {
      try {
        return [key, await loadGeoJSON(url)];
      } catch (error) {
        console.error(`[data.js] Layer "${key}" failed:`, error);
        return [key, EMPTY_COLLECTION];
      }
    })
  );
  return Object.fromEntries(entries);
}
