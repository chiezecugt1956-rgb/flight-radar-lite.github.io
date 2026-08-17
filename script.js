const NIGERIA_BOUNDS = { lamin: 4.0, lomin: 2.0, lamax: 14.0, lomax: 15.0 };
const VERCEL_BACKEND_URL = "https://openskyeee.vercel.app";

const map = L.map('map').setView([9.0820, 8.6753], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = {};
let planeCount = 0;

async function fetchFlights() {
  try {
    document.getElementById('status').innerText = 'Updating...';
    
    const url = `${VERCEL_BACKEND_URL}/api/flights?lamin=${NIGERIA_BOUNDS.lamin}&lomin=${NIGERIA_BOUNDS.lomin}&lamax=${NIGERIA_BOUNDS.lamax}&lomax=${NIGERIA_BOUNDS.lomax}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);

    const data = await res.json();
    const planes = data.states || [];
    planeCount = 0;
    const currentIds = new Set();

    planes.forEach(p => {
      const icao = p[0];
      const callsign = p[1];
      const country = p[2];
      const lon = p[5];
      const lat = p[6];
      const alt = p[7];
      const velocity = p[9];

      if (!lat || !lon) return;

      const id = String(icao);
      currentIds.add(id);
      planeCount++;

      const name = callsign ? callsign.trim() : 'Unknown';
      const altitude = alt ? Math.round(alt) : null;
      const speed = velocity ? Math.round(velocity * 3.6) : null;
      const countryName = country || 'N/A';

      if (markers[id]) {
        markers[id].setLatLng([lat, lon]);
      } else {
        const marker = L.marker([lat, lon], {
          icon: L.divIcon({ className: 'plane-icon', html: '✈️', iconSize: [20, 20] })
        }).addTo(map);

        marker.on('click', () => showDetails(name, altitude, speed, countryName));
        markers[id] = marker;
      }
    });

    Object.keys(markers).forEach(id => {
      if (!currentIds.has(id)) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });

    if (planeCount === 0) {
      document.getElementById('status').innerText =
        `Last updated: ${new Date().toLocaleTimeString()} | Planes: 0 (No active ADS-B receivers online in Nigeria) | Refresh: 30s`;
    } else {
      document.getElementById('status').innerText =
        `Last updated: ${new Date().toLocaleTimeString()} | Planes: ${planeCount} | Refresh: 30s`;
    }

  } catch (e) {
    console.error('Fetch Error:', e);
    document.getElementById('status').innerText = 'Error fetching data. Check backend CORS config.';
  }
}

function showDetails(callsign, alt, speed, country) {
  const altText = alt ? alt.toLocaleString() + ' meters' : '<span class="na">N/A</span>';
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

fetchFlights();
setInterval(fetchFlights, 30000);
