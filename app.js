// ========== CONFIG ==========
const API_URL = "https://workers-playground-proud-bush-1848.terrytaiwo96.workers.dev/";

const POLL_INTERVAL_MS = 15000; // 15 seconds
const STALE_THRESHOLD_S = 60;   // consider data stale after 60s

// Nigeria map bounds (for map view only)
const BBOX = {
  lamin: 4.0,
  lomin: 2.5,
  lamax: 14.0,
  lomax: 15.0
};

// ========== STATE ==========
let map;
let markersLayer;
let aircraftMap = new Map(); // hex → marker
let lastSuccessfulFetch = 0;
let pollTimer = null;

// ========== INIT ==========
function init() {
  map = L.map("map", {
    minZoom: 5,
    maxZoom: 12
  }).setView([9.0, 8.5], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const bounds = L.latLngBounds(
    [BBOX.lamin, BBOX.lomin],
    [BBOX.lamax, BBOX.lomax]
  );
  map.setMaxBounds(bounds.pad(0.15));
  map.fitBounds(bounds);

  markersLayer = L.layerGroup().addTo(map);

  fetchFlights();
  pollTimer = setInterval(fetchFlights, POLL_INTERVAL_MS);
  setInterval(checkStaleness, 5000);
}

// ========== API ==========
async function fetchFlights() {
  setStatus("Fetching…", "warn");

  try {
    const res = await fetch(API_URL);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    lastSuccessfulFetch = Date.now();
    processAircraft(data);
    setStatus("Live", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Error – retrying", "error");
  }
}

function processAircraft(data) {
  // ADSB.fi / ADS-B Exchange style response
  const aircraftList = data.ac || data.aircraft || [];
  const seen = new Set();

  aircraftList.forEach(ac => {
    // Skip if no position
    if (ac.lat == null || ac.lon == null) return;

    // Skip grounded aircraft (optional)
    if (ac.alt_baro === "ground" || ac.alt_baro === 0) return;

    const hex = (ac.hex || "").toLowerCase();
    if (!hex) return;

    seen.add(hex);

    const flight = {
      icao24: hex,
      callsign: (ac.flight || ac.r || "N/A").trim(),
      registration: ac.r || null,
      originCountry: "—",               // ADSB.fi doesn't always give country
      altitude: typeof ac.alt_baro === "number" ? ac.alt_baro : null, // usually feet
      velocity: typeof ac.gs === "number" ? ac.gs : null,             // knots
      trueTrack: typeof ac.track === "number" ? ac.track : null,
      lat: ac.lat,
      lon: ac.lon
    };

    updateMarker(flight);
  });

  // Remove aircraft that disappeared
  for (const [hex, marker] of aircraftMap) {
    if (!seen.has(hex)) {
      markersLayer.removeLayer(marker);
      aircraftMap.delete(hex);
    }
  }

  document.getElementById("count").textContent = aircraftMap.size;
  document.getElementById("last-update").textContent =
    new Date().toLocaleTimeString();
}

// ========== MARKERS ==========
function createPlaneIcon(heading) {
  const rotation = heading != null ? heading : 0;
  return L.divIcon({
    className: "plane-icon",
    html: `
      <div style="transform: rotate(${rotation}deg); width:24px; height:24px;">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="#38bdf8">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function updateMarker(flight) {
  const { icao24, lat, lon, trueTrack } = flight;

  if (aircraftMap.has(icao24)) {
    const marker = aircraftMap.get(icao24);
    marker.setLatLng([lat, lon]);
    marker.setIcon(createPlaneIcon(trueTrack));
    marker.flightData = flight;
  } else {
    const marker = L.marker([lat, lon], {
      icon: createPlaneIcon(trueTrack)
    });
    marker.flightData = flight;
    marker.on("click", () => showDetails(flight));
    marker.addTo(markersLayer);
    aircraftMap.set(icao24, marker);
  }
}

// ========== SIDEBAR ==========
function showDetails(flight) {
  // ADSB.fi usually returns altitude in feet and speed in knots
  const altFt = flight.altitude != null ? Math.round(flight.altitude) : "—";
  const altM  = flight.altitude != null ? Math.round(flight.altitude / 3.28084) : "—";

  const speedKt  = flight.velocity != null ? Math.round(flight.velocity) : "—";
  const speedKmh = flight.velocity != null ? Math.round(flight.velocity * 1.852) : "—";

  document.getElementById("details").innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Flight</span>
      <span class="detail-value">${flight.callsign}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">ICAO24</span>
      <span class="detail-value">${flight.icao24.toUpperCase()}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Registration</span>
      <span class="detail-value">${flight.registration || "—"}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Altitude</span>
      <span class="detail-value">${altFt} ft / ${altM} m</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Speed</span>
      <span class="detail-value">${speedKmh} km/h (${speedKt} kt)</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Heading</span>
      <span class="detail-value">${flight.trueTrack != null ? Math.round(flight.trueTrack) + "°" : "—"}</span>
    </div>
  `;
}

// ========== STATUS / STALENESS ==========
function setStatus(text, type) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.className = type || "";
}

function checkStaleness() {
  if (!lastSuccessfulFetch) return;
  const age = (Date.now() - lastSuccessfulFetch) / 1000;
  if (age > STALE_THRESHOLD_S) {
    setStatus(`Stale (${Math.round(age)}s)`, "warn");
  }
}

// ========== START ==========
document.addEventListener("DOMContentLoaded", init);
