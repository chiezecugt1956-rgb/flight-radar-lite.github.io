const API_BASE = 'https://flight-radar-lite-github-io-imln.vercel.app';

const map = L.map('map').setView([20, 0], 2); // Zoomed out to show the whole world
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = {};
let planeCount = 0;

async function fetchFlights() {
  try {
    document.getElementById('status').innerText = 'Updating...';
    const url = `${API_BASE}/api/flights`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    const planes = data.states || [];
    planeCount = 0;
    const currentIds = new Set();

    planes.forEach(p => {
      const [icao, callsign, country, , , lon, lat, alt, , velocity] = p;
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

    const cacheStatus = res.headers.get('X-Cache') || '';
    document.getElementById('status').innerText =
      `Last updated: ${new Date().toLocaleTimeString()} | Planes: ${planeCount} | Refresh: 30s ${cacheStatus}`;
  } catch (e) {
    console.error('Fetch Error:', e);
    document.getElementById('status').innerText = 'Error fetching data. Retrying in 30s...';
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
