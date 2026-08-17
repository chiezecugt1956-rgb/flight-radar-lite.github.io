// Nigeria airspace bounds for OpenSky API
const NIGERIA_BOUNDS = { lamin: 4.0, lomin: 2.0, lamax: 14.0, lomax: 15.0 };

const map = L.map('map').setView([9.0820, 8.6753], 6); // Center of Nigeria
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

let markers = {};
let planeCount = 0;

async function fetchFlights() {
  try {
    document.getElementById('status').innerText = 'Updating...';
    const url = `/api/flights?lamin=${NIGERIA_BOUNDS.lamin}&lomin=${NIGERIA_BOUNDS.lomin}&lamax=${NIGERIA_BOUNDS.lamax}&lomax=${NIGERIA_BOUNDS.lomax}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('API Error');

    const data = await res.json();
    const planes = data.states || [];
    planeCount = 0;

    planes.forEach(p => {
      const [icao, callsign, country,, lon, lat, alt, velocity] = p;
      if(!lat ||!lon || alt < 1000) return; // skip ground planes
      planeCount++;

      const id = icao;
      const name = callsign? callsign.trim() : 'Unknown';
      const altitude = Math.round(alt);
      const speed = Math.round(velocity * 3.6); // m/s to km/h

      if(markers[id]) {
        markers[id].setLatLng([lat, lon]);
      } else {
        const marker = L.marker([lat, lon]).addTo(map);
        marker.on('click', () => showDetails(name, altitude, speed, country));
        markers[id] = marker;
      }
    });

    document.getElementById('status').innerText = `Last updated: ${new Date().toLocaleTimeString()} | Planes: ${planeCount}`;

  } catch(e) {
    console.error("Error:", e);
    document.getElementById('status').innerText = 'Error fetching data. Retrying...';
  }
}

function showDetails(callsign, alt, speed, country) {
  document.getElementById('details').innerHTML = `
    <div class="plane-card">
      <h3>${callsign}</h3>
      <p><b>Country:</b> ${country}</p>
      <p><b>Altitude:</b> ${alt.toLocaleString()} meters</p>
      <p><b>Speed:</b> ${speed.toLocaleString()} km/h</p>
    </div>
  `;
}

// Initial load + poll every 10 seconds
fetchFlights();
setInterval(fetchFlights, 10000);
