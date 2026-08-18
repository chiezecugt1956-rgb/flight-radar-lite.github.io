// In-memory cache so most requests are instant and don't hit OpenSky every time
let cache = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION = 30_000; // 30 seconds

// Contiguous United States (lower 48) bounding box
const US_BBOX = {
  lamin: 24.4,   // south
  lomin: -125.0, // west
  lamax: 49.4,   // north
  lomax: -66.9   // east
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const now = Date.now();

    // Serve from cache if it's still fresh
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cache.data);
    }

    const url = new URL('https://opensky-network.org/api/states/all');
    url.searchParams.set('lamin', US_BBOX.lamin);
    url.searchParams.set('lomin', US_BBOX.lomin);
    url.searchParams.set('lamax', US_BBOX.lamax);
    url.searchParams.set('lomax', US_BBOX.lomax);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // safely under Vercel's 10s limit

    let response;
    try {
      response = await fetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`OpenSky: ${response.status}`);
    }

    const data = await response.json();

    // Update cache
    cache.data = data;
    cache.timestamp = now;

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);

  } catch (error) {
    console.error('OpenSky error:', error.name, error.message);

    // Fallback to stale cache if available
    if (cache.data) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }

    // Last resort – return empty data so the frontend doesn't crash
    return res.status(200).json({
      time: 0,
      states: [],
      error: 'OpenSky temporarily unavailable'
    });
  }
}
