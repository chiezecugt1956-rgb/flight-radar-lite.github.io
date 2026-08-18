// In-memory cache so most requests are instant and don't hit OpenSky every time
let cache = {
  data: null,
  timestamp: 0
};
const CACHE_DURATION = 30000; // 30 seconds

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

  try {
    const now = Date.now();

    // Serve from cache if it's fresh — avoids waiting on OpenSky most of the time
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cache.data);
    }

    const url = 'https://opensky-network.org/api/states/all';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // safely under Vercel's default 10s limit

    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) throw new Error(`OpenSky: ${response.status}`);
    const data = await response.json();

    cache.data = data;
    cache.timestamp = now;

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(data);

  } catch (error) {
    console.error("OpenSky error:", error.name, error.message);

    // If we have any old cached data, serve that instead of nothing
    if (cache.data) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }

    res.status(200).json({ time: 0, states: [], error: "OpenSky slow, trying again..." });
  }
}
