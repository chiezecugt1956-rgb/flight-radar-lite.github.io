// ========== CONFIG ==========
const VERCEL_BACKEND_URL = "https://openskyeee.vercel.app";

const lamin = 4.0;
const lomin = 2.0;
const lamax = 14.0;
const lomax = 15.0;

const POLL_INTERVAL_MS = 30000; // 30 seconds
const STALE_THRESHOLD_S = 90;

// ========== STATE ==========
let map;
let markersLayer;
let aircraftMap = new Map(); // icao24 → marker
let lastSuccessfulFetch = 0;

// ========== INIT ==========
function init() {
  map = L.map("map", {
    minZoom: 5,
    maxZoom: 12
  }).setView([9.0, 8.5], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const bounds = L.latLngBounds([lamin, lomin], [lamax, lomax]);
  map.setMaxBounds(bounds.pad(0.15));
  map.fitBounds(bounds);

  markersLayer = L.layerGroup().addTo(map);

  fetchFlights();
  setInterval(fetchFlights, POLL_INTERVAL_MS);
  setInterval(checkStaleness, 5000);
}

// ========== API ==========
async function fetchFlights() {
  setStatus("Fetching…", "warn");

  const url = `${VERCEL_BACKEND_URL}/api/flights?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const flights = data.states || [];

    lastSuccessfulFetch = Date.now();
    processStates(flights);

    if (flights.length === 0) {
      setStatus("No aircraft in area", "warn");
      showEmptyStateNotice();
    } else {
      setStatus("Live", "ok");
      clearEmptyStateNotice();
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    setStatus("Error – retrying", "error");
    showErrorNotice("Unable to load flight data. Check backend status.");
  }
}

function processStates(flights) {
  const seen = new Set();

  flights.forEach(flight => {
    const icao24 = flight[0];
    const callsign = flight[1] ? flight[1].trim() : "Unknown";
    const country = flight[2] || "Unknown";
    const lon = flight[5];
    const lat = flight[6];
    const altitudeMeters = flight[7]; // meters
    const onGround = flight[8];
    const velocityMps = flight[9];    // m/s
    const heading = flight[10];

    if (lat == null || lon == null) return;
    if (onGround) return; // only airborne

    seen.add(icao24);

    const flightData = {
      icao24,
      callsign,
      originCountry: country,
      altitude: altitudeMeters,
      velocity: velocityMps,
      trueTrack: heading,
      lat,
      lon
    };

    updateMarker(flightData);
  });

  // Remove aircraft that left the area
  for (const [icao, marker] of aircraftMap) {
    if (!seen.has(icao)) {
      markersLayer.removeLayer(marker);
      aircraftMap.delete(icao);
    }
  }

  const countEl = document.getElementById("count");
  if (countEl) countEl.textContent = aircraftMap.size;

  const updateEl = document.getElementById("last-update");
  if (updateEl) updateEl.textContent = new Date().toLocaleTimeString();
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
  const altM = flight.altitude != null ? Math.round(flight.altitude) : "—";
  const altFt = flight.altitude != null ? Math.round(flight.altitude * 3.28084) : "—";
  const speedKmh = flight.velocity != null ? Math.round(flight.velocity * 3.6) : "—";
  const speedKt = flight.velocity != null ? Math.round(flight.velocity * 1.94384) : "—";

  const details = document.getElementById("details");
  if (!details) return;

  details.innerHTML = `
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

// ========== STATUS HELPERS ==========
function setStatus(text, type) {
  const el = document.getElementById("status");
  if (!el) return;
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

function showEmptyStateNotice() {
  const statusDiv = document.getElementById("status-message");
  if (statusDiv) {
    statusDiv.innerText = "No active aircraft broadcasting ADS-B data over Nigerian airspace right now.";
    statusDiv.style.display = "block";
  }
}

function clearEmptyStateNotice() {
  const statusDiv = document.getElementById("status-message");
  if (statusDiv) statusDiv.style.display = "none";
}

function showErrorNotice(msg) {
  const statusDiv = document.getElementById("status-message");
  if (statusDiv) {
    statusDiv.innerText = msg;
    statusDiv.style.display = "block";
  }
}

// ========== START ==========
document.addEventListener("DOMContentLoaded", init);
