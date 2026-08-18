const API_BASE = "https://your-railway-url.up.railway.app";

// Center on Japan
const map = L.map('map').setView([36.5, 138.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = {};
let planeCount = 0;

async function fetchFlights() {
  try {
    document.getElementById('status').innerText = 'Updating...';

    const res = await fetch(`${API_BASE}/api/flights`);
    if (!res.ok) throw new Error('API Error');

    const data = await res.json();
    const planes = data.states || [];

    planeCount = 0;
    const currentIds = new Set();

    planes.forEach(p => {
      const [icao, callsign, country, , , lon, lat, alt, , velocity, track] = p;

      if (lat == null || lon == null) return;

      const id = String(icao);
      currentIds.add(id);
      planeCount++;

      const name = callsign ? callsign.trim() : 'Unknown';
      const altitude = alt != null ? Math.round(alt) : null;
      const speed = velocity != null ? Math.round(velocity * 3.6) : null;
      const countryName = country || 'N/A';
      const heading = track != null ? track : 0;

      if (markers[id]) {
        markers[id].setLatLng([lat, lon]);
        // Update rotation
        const icon = markers[id].getElement();
        if (icon) {
          icon.style.transform = `rotate(${heading}deg)`;
        }
      } else {
        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            className: 'plane-icon',
            html: '✈️',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map);

        // Set initial rotation
        setTimeout(() => {
          const el = marker.getElement();
          if (el) el.style.transform = `rotate(${heading}deg)`;
        }, 50);

        marker.on('click', () => showDetails(name, altitude, speed, countryName));
        markers[id] = marker;
      }
    });

    // Remove planes that disappeared
    Object.keys(markers).forEach(id => {
      if (!currentIds.has(id)) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });

    const cacheStatus = res.headers.get('X-Cache') || '';
    document.getElementById('status').innerText =
      `Last updated: ${new Date().toLocaleTimeString()} | Planes: ${planeCount} | Refresh: 30s ${cacheStatus}`;

  } catch (e) {
    console.error('Fetch Error:', e);
    document.getElementById('status').innerText = 'Error fetching data. Retrying in 30s...';
  }
}

function showDetails(callsign, alt, speed, country) {
  const altText = alt ? alt.toLocaleString() + ' m' : '<span class="na">N/A</span>';
  const speedText = speed ? speed.toLocaleString() + ' km/h' : '<span class="na">N/A</span>';

  document.getElementById('details').innerHTML = `
    <div class="plane-card">
      <h3>${callsign}</h3>
      <p><b>Country:</b> ${country}</p>
      <p><b>Altitude:</b> ${altText}</p>
      <p><b>Speed:</b> ${speedText}</p>
    </div>
  `;
}

// Initial load + refresh every 30 seconds
fetchFlights();
setInterval(fetchFlights, 30000);
