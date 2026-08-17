export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

  const { lamin, lomin, lamax, lomax } = req.query;
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    
    if (!response.ok) throw new Error(`OpenSky: ${response.status}`);
    const data = await response.json();
    
    res.status(200).json(data || { time: 0, states: [] });
    
  } catch (error) {
    console.error("OpenSky error:", error.name);
    // Return empty data instead of crashing
    res.status(200).json({ time: 0, states: [], error: "OpenSky slow, trying again..." });
    
  } finally {
    // This runs no matter what - try OR catch
    clearTimeout(timeoutId); 
  }
}
