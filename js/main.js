// js/main.js

let map;
let stopsLayer;
let allStops = []; // will hold all features (GeoJSON features)

// Entry point
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadStopsData();
  setupFilters();
});

function initMap() {
  // Center roughly on Old City
  map = L.map("map").setView([39.949, -75.148], 14);

  // Add basemap
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Empty GeoJSON layer for stops (we’ll add data later)
  stopsLayer = L.geoJSON(null, {
    pointToLayer: (feature, latlng) => {
      const theme = feature.properties.theme;
      const marker = L.circleMarker(latlng, {
        radius: 6,
        weight: 1,
        color: themeColor(theme),
        fillColor: themeColor(theme),
        fillOpacity: 0.8
      });
      return marker;
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <strong>${p.name}</strong><br>
        Theme: ${p.theme}<br>
        Est. duration: ${p.est_duration_min} min<br>
        Est. cost: $${p.est_cost}<br>
        ${p.description}
      `);
    }
  }).addTo(map);
}

function themeColor(theme) {
  switch (theme) {
    case "history": return "#1f77b4";
    case "food": return "#ff7f0e";
    case "recreation": return "#2ca02c";
    case "evening": return "#9467bd";
    default: return "#555";
  }
}

function loadStopsData() {
  fetch("data/itinerary_stops.geojson")
    .then(response => response.json())
    .then(geojson => {
      allStops = geojson.features;

      // Add all to map initially
      stopsLayer.addData(geojson);

      // Populate the HTML list
      renderStopList(allStops);

      // Fit map to points
      const bounds = stopsLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    })
    .catch(err => {
      console.error("Error loading GeoJSON", err);
    });
}
function setupFilters() {
  const themeCheckboxes = document.querySelectorAll('input[name="theme"]');
  const maxPriceInput = document.querySelector('input[name="max-price"]');
  const maxPriceLabel = document.getElementById("max-price-label");
  const timeSelect = document.querySelector('select[name="time-available"]');

  // Update label on range drag
  maxPriceInput.addEventListener("input", () => {
    maxPriceLabel.textContent = maxPriceInput.value;
    applyFilters();
  });

  // Re-filter on theme/time change
  themeCheckboxes.forEach(cb => {
    cb.addEventListener("change", applyFilters);
  });

  timeSelect.addEventListener("change", applyFilters);
}

function applyFilters() {
  // Get selected themes
  const selectedThemes = Array.from(
    document.querySelectorAll('input[name="theme"]:checked')
  ).map(cb => cb.value);

  // Get budget + time
  const maxPrice = Number(document.querySelector('input[name="max-price"]').value);
  const timeAvailable = document.querySelector('select[name="time-available"]').value;

  // Rough total time constraint (in minutes)
  const timeLimit = timeAvailable === "half" ? 240 : 480;

  // Filter stops
  const filtered = [];
  let totalDuration = 0;
  let totalCost = 0;

  for (const feature of allStops) {
    const p = feature.properties;

    const matchesTheme = selectedThemes.includes(p.theme);
    const withinBudget = (totalCost + p.est_cost) <= maxPrice;
    const withinTime = (totalDuration + p.est_duration_min) <= timeLimit;

    if (matchesTheme && withinBudget && withinTime) {
      filtered.push(feature);
      totalDuration += p.est_duration_min;
      totalCost += p.est_cost;
    }
  }

  // Update map
  stopsLayer.clearLayers();
  stopsLayer.addData({
    type: "FeatureCollection",
    features: filtered
  });

  // Update list + summary
  renderStopList(filtered);
  updateSummary(filtered, totalDuration, totalCost);
}

function renderStopList(features) {
  const listEl = document.querySelector(".stop-list");
  listEl.innerHTML = "";

  features.forEach(f => {
    const p = f.properties;
    const li = document.createElement("li");
    li.className = "stop";

    li.innerHTML = `
      <header class="name">${p.name}</header>
      <span class="cost">$${p.est_cost}</span>
      <span class="theme">${p.theme}</span>
      <span class="duration">${p.est_duration_min} min</span>
      <p class="description">${p.description}</p>
    `;

    // Optional: clicking in list pans map to that stop
    li.addEventListener("click", () => {
      const [lng, lat] = f.geometry.coordinates;
      map.setView([lat, lng], 16);
    });

    listEl.appendChild(li);
  });

  if (features.length === 0) {
    listEl.innerHTML = `<li class="stop">No stops match your filters yet.</li>`;
  }
}

function updateSummary(features, totalDuration, totalCost) {
  const summaryEl = document.getElementById("summary-text");

  if (!features.length) {
    summaryEl.textContent = "No stops selected yet. Try relaxing your filters.";
    return;
  }

  const hours = (totalDuration / 60).toFixed(1);

  summaryEl.textContent =
    `You have ${features.length} stops selected, ` +
    `for about ${hours} hours of activities ` +
    `and an estimated total cost of $${totalCost}.`;
}
