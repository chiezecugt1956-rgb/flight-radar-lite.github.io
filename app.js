// ========== CONFIG ==========
const API_URL = "https://workers-playground-proud-bush-1848.terrytaiwo96.workers.dev/";

// Approximate bounding box for Nigeria (WGS84)
const BBOX = {
  lamin: 4.0,   // south
  lomin: 2.5,   // west
  lamax: 14.0,  // north
  lomax: 15.0   // east
};

const POLL_INTERVAL_MS = 15000; // 15 seconds (respect rate limits)
const STALE_THRESHOLD_S = 60;   // consider data stale after 60s

// ========== STATE ==========
let map;
let markersLayer;
let aircraftMap = new Map(); // icao24 → marker
let lastSuccessfulFetch = 0;
let pollTimer = null;

// ========== INIT ==========
function init() {
  // Center roughly on Nigeria
  map = L.map("map", {
    minZoom: 5,
    maxZoom: 12
  }).setView([9.0, 8.5], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Keep the view roughly over Nigeria
  const bounds = L.latLngBounds(
    [BBOX.lamin, BBOX.lomin],
    [BBOX.lamax, BBOX.lomax]
  );
  map.setMaxBounds(bounds.pad(0.15));
  map.fitBounds(bounds);

  markersLayer = L.layerGroup().addTo(map);

  // Start polling
  fetchFlights();
  pollTimer = setInterval(fetchFlights, POLL_INTERVAL_MS);

  // Staleness check every 5 s
  setInterval(checkStaleness, 5000);
}

// ========== API ==========
async function fetchFlights() {
  setStatus("Fetching…", "warn");

  const params = new URLSearchParams({
    lamin: BBOX.lamin,
    lomin: BBOX.lomin,
    lamax: BBOX.lamax,
    lomax: BBOX.lomax
  });

  try {
    const res = await fetch(`${OPENSKY_URL}?${params}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    lastSuccessfulFetch = Date.now();
    processStates(data);
    setStatus("Live", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Error – retrying", "error");
    // Keep old markers so the map doesn’t go empty
  }
}

function processStates(data) {
  const states = data.states || [];
  const now = Math.floor(Date.now() / 1000);
  const seen = new Set();

  states.forEach(state => {
    // state vector indices (see OpenSky docs)
    const [
      icao24,
      callsign,
      originCountry,
      timePosition,
      lastContact,
      longitude,
      latitude,
      baroAltitude,
      onGround,
      velocity,
      trueTrack,
      verticalRate
    ] = state;

    if (latitude == null || longitude == null) return;
    if (onGround) return; // only show airborne aircraft

    seen.add(icao24);

    const flight = {
      icao24,
      callsign: (callsign || "N/A").trim(),
      originCountry: originCountry || "Unknown",
      altitude: baroAltitude,          // meters
      velocity: velocity,              // m/s
      trueTrack: trueTrack,            // degrees
      lastContact,
      lat: latitude,
      lon: longitude
    };

    updateMarker(flight);
  });

  // Remove markers that are no longer in the response
  for (const [icao, marker] of aircraftMap) {
    if (!seen.has(icao)) {
      markersLayer.removeLayer(marker);
      aircraftMap.delete(icao);
    }
  }

  document.getElementById("count").textContent = aircraftMap.size;
  document.getElementById("last-update").textContent =
    new Date().toLocaleTimeString();
}

// ========== MARKERS ==========
function createPlaneIcon(heading) {
  // Simple rotated plane SVG
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
  const altM = flight.altitude != null ? Math.round(flight.altitude) : "—";
  const altFt = flight.altitude != null ? Math.round(flight.altitude * 3.28084) : "—";
  const speedMs = flight.velocity != null ? flight.velocity.toFixed(1) : "—";
  const speedKmh = flight.velocity != null ? Math.round(flight.velocity * 3.6) : "—";
  const speedKt = flight.velocity != null ? Math.round(flight.velocity * 1.94384) : "—";

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
      <span class="detail-label">Country</span>
      <span class="detail-value">${flight.originCountry}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Altitude</span>
      <span class="detail-value">${altM} m / ${altFt} ft</span>
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
