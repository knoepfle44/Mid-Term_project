/* ==========================================================================
   map.js – Creates the Leaflet map, the data layers, popups and the legend.
   Responsibility: everything that is drawn ON the map.
   Scroll/chapter logic lives in story.js, which talks to this file only
   through the public API at the bottom (window.StoryMap).

   Requires (loaded before this file): Leaflet, data.js
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. CONFIGURATION
   -------------------------------------------------------------------------- */

// Initial view: centre of Vienna (lat, lng) and zoom level
const START_CENTER = [48.2082, 16.3738];
const START_ZOOM = 12;

// Pan limit: the user cannot drag the map outside this box
// (south-west corner, north-east corner) – slightly larger than Vienna.
const MAX_BOUNDS = [[48.05, 16.05], [48.38, 16.70]];

// Zoom limits: not further out than the whole city, not further in than street level
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;

// Style per layer. `shape` is used for the marker icon (not only colour
// distinguishes layers, which helps colour-blind users).
// Colours are read from the CSS variables in style.css, so they match the legend.
const LAYER_STYLES = {
  wifi:     { cssVar: "--color-wifi",     shape: "circle" },
  bike:     { cssVar: "--color-bike",     shape: "circle" },
  charging: { cssVar: "--color-charging", shape: "square" }
};

// Human-readable names for the popup headers
const LAYER_LABELS = {
  wifi: "Free Wi-Fi",
  bike: "Bike-sharing station",
  charging: "EV charging station"
};


/* --------------------------------------------------------------------------
   2. MAP SETUP (basemap, constraints, scale)
   -------------------------------------------------------------------------- */

const map = L.map("map", {
  center: START_CENTER,
  zoom: START_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  maxBounds: MAX_BOUNDS,
  maxBoundsViscosity: 1.0,   // 1.0 = hard wall, the map "sticks" at the border
  zoomControl: true
});


// Basemap: standard OpenStreetMap tiles 
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | ' +
    'Data: <a href="https://www.data.gv.at">City of Vienna OGD</a>',
  minZoom: MIN_ZOOM,
  maxZoom: 19    // OSM tiles are available up to zoom level 19
}).addTo(map);

// Scale hint (metric only), bottom left
L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);


/* --------------------------------------------------------------------------
   3. HELPERS
   -------------------------------------------------------------------------- */

/** Reads a CSS variable (e.g. "--color-wifi") from :root. */
function cssColor(variable) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

/** Escapes text so data from the GeoJSON can never inject HTML into popups. */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

/**
 * Builds a small round or square marker icon.
 * @param {string} color - CSS colour
 * @param {"circle"|"square"} shape
 */
function createMarkerIcon(color, shape) {
  const SIZE = 10;                       // <- hier die Größe ändern
  const radius = shape === "circle" ? "50%" : "2px";
  return L.divIcon({
    className: "",
    html:
      `<span style="display:block;width:${SIZE}px;height:${SIZE}px;background:${color};` +
      `border:1.5px solid #fff;border-radius:${radius};box-shadow:0 0 3px rgba(0,0,0,.5);"></span>`,
    iconSize: [SIZE, SIZE],
    iconAnchor: [SIZE / 2, SIZE / 2],
    popupAnchor: [0, -SIZE / 2 - 2]
  });
}

/**
 * Builds the popup HTML for one point.
 * Expected GeoJSON properties: name, address, district, note (all optional).
 */
function buildPopup(layerKey, properties) {
  const { name, address, district, note } = properties;
  let html = `<h3>${escapeHtml(name || LAYER_LABELS[layerKey])}</h3>`;
  html += `<p><strong>${escapeHtml(LAYER_LABELS[layerKey])}</strong></p>`;
  if (address)  html += `<p>${escapeHtml(address)}</p>`;
  if (district) html += `<p>District: ${escapeHtml(String(district))}</p>`;
  if (note)     html += `<p><em>${escapeHtml(note)}</em></p>`;
  return html;
}


/* --------------------------------------------------------------------------
   4. LAYERS
   `layers` holds one Leaflet layer per key ("wifi", "bike", ...).
   They are created after the data has been loaded.
   -------------------------------------------------------------------------- */

const layers = {};

/** Creates a point layer (markers + popups) from a GeoJSON FeatureCollection. */
function createPointLayer(layerKey, geojson) {
  const { cssVar, shape } = LAYER_STYLES[layerKey];
  const icon = createMarkerIcon(cssColor(cssVar), shape);

  return L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => L.marker(latlng, { icon }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buildPopup(layerKey, feature.properties || {}));
    }
  });
}

/** Creates the district boundary layer (dashed outline, no fill). */
function createDistrictLayer(geojson) {
  return L.geoJSON(geojson, {
    style: {
      color: cssColor("--color-districts"),
      weight: 1.5,
      dashArray: "5 5",
      fillOpacity: 0
    },
    onEachFeature: (feature, layer) => {
      const label = feature.properties && feature.properties.NAMEK_NUM;
      if (label) layer.bindTooltip(String(label), { sticky: true });
    }
  });
}
/** Builds all layers from the loaded data. */
function buildLayers(data) {
  layers.districts = createDistrictLayer(data.districts);
  layers.wifi      = createPointLayer("wifi", data.wifi);
  layers.bike      = createPointLayer("bike", data.bike);
  layers.charging  = createPointLayer("charging", data.charging);
}


/* --------------------------------------------------------------------------
   5. LEGEND (checkboxes in index.html: <input data-layer="wifi"> ...)
   -------------------------------------------------------------------------- */

/** Shows or hides one layer on the map. */
function setLayerVisible(layerKey, visible) {
  const layer = layers[layerKey];
  if (!layer) return;
  if (visible && !map.hasLayer(layer)) map.addLayer(layer);
  if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
}

/** Connects every legend checkbox to its layer. */
function initLegend() {
  const checkboxes = document.querySelectorAll("#legend input[data-layer]");

  checkboxes.forEach((checkbox) => {
    // Apply the initial checked/unchecked state
    setLayerVisible(checkbox.dataset.layer, checkbox.checked);

    // React to clicks
    checkbox.addEventListener("change", () => {
      setLayerVisible(checkbox.dataset.layer, checkbox.checked);
    });
  });
}


/* --------------------------------------------------------------------------
   6. PUBLIC API (used by story.js)
   -------------------------------------------------------------------------- */

/**
 * Shows exactly the given layers and hides all others.
 * Also updates the legend checkboxes so legend and map never disagree.
 * @param {string[]} visibleKeys - e.g. ["wifi", "districts"]
 */
function setVisibleLayers(visibleKeys) {
  document.querySelectorAll("#legend input[data-layer]").forEach((checkbox) => {
    const shouldShow = visibleKeys.includes(checkbox.dataset.layer);
    checkbox.checked = shouldShow;
    setLayerVisible(checkbox.dataset.layer, shouldShow);
  });
}

/**
 * Smoothly moves the map to a new position.
 * @param {[number, number]} center - [lat, lng]
 * @param {number} zoom
 */
function flyToView(center, zoom) {
  map.flyTo(center, zoom, { duration: 1.5 });
}

// `ready` resolves when the data is loaded and the layers exist.
// story.js should wait for it: StoryMap.ready.then(() => { ... })
const ready = loadAllData().then((data) => {
  buildLayers(data);
  initLegend();
});

window.StoryMap = { map, layers, ready, setVisibleLayers, flyToView };
