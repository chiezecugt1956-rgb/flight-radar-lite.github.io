// Simple in-memory cache to save API credits
let cache = {
  data: null,
  timestamp: 0
};
const CACHE_DURATION = 30000; // 30 seconds

export default async function handler(req, res) {
  try {
    const now = Date.now();
    
    // If cache is fresh, return it instead of hitting OpenSky
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json(cache.data);
    }

    const { lamin, lomin, lamax, lomax } = req.query;
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    const response = await fetch(url);
    if(!response.ok) throw new Error('OpenSky API error');
    
    const data = await response.json();

    // Save to cache
    cache.data = data;
    cache.timestamp = now;

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.status(200).json(data);

  } catch (error) {
    console.error(error);
    // If API fails but we have old cache, return old cache
    if(cache.data) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
}
