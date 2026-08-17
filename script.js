// Replace with your actual Vercel backend domain
const VERCEL_BACKEND_URL = "https://openskyeee.vercel.app";
// Bounding box for Nigerian airspace
const lamin = 4.0;
const lomin = 2.0;
const lamax = 14.0;
const lomax = 15.0;
async function fetchFlights() {
  // Use absolute URL pointing to your Vercel deployment instead of a relative path
  const url = `${VERCEL_BACKEND_URL}/api/flights?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  try {
    const response = await fetch(url);
   
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
   
    // OpenSky returns { states: [...] } or null if no flights are in the bounding box
    const flights = data.states || [];
    if (flights.length === 0) {
      console.log("No live aircraft detected in Nigerian airspace at this moment.");
      showEmptyStateNotice();
    } else {
      clearEmptyStateNotice();
      renderFlightsOnMap(flights);
    }
  } catch (error) {
    console.error("Fetch Error:", error);
    showErrorNotice("Unable to load flight data. Check backend status.");
  }
}
// Function to render markers on your map
function renderFlightsOnMap(flights) {
  // Clear existing markers first if your mapping library requires it
 
  flights.forEach(flight => {
    const icao24 = flight[0];
    const callsign = flight[1] ? flight[1].trim() : 'Unknown';
    const country = flight[2];
    const lon = flight[5];
    const lat = flight[6];
    const altitudeMeters = flight[7];
    const velocityMps = flight[9];
    const heading = flight[10];
    // Skip flights missing location coordinates
    if (lat === null || lon === null) return;
    // Example Leaflet.js / Mapbox marker creation:
    // L.marker([lat, lon]).addTo(map).bindPopup(`<b>${callsign}</b><br>ICAO: ${icao24}`);
  });
}
// Visual helpers for empty states or errors
function showEmptyStateNotice() {
  const statusDiv = document.getElementById("status-message");
  if (statusDiv) {
    statusDiv.innerText = "No active aircraft broadcasting ADS-B data over Nigerian airspace right now.";
    statusDiv.style.display = "block";
  }
}
function clearEmptyStateNotice() {
  const statusDiv = document.getElementById("status-message");
  if (statusDiv) {
    statusDiv.style.display = "none";
  }
}
function showErrorNotice(msg) {
  const statusDiv = document.getElementById("status-message");
  if (statusDiv) {
    statusDiv.innerText = msg;
    statusDiv.style.display = "block";
  }
}
// Initial fetch on page load
fetchFlights();
// Refresh flight positions every 30 seconds
setInterval(fetchFlights, 30000);
