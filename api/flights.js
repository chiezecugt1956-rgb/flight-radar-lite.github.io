export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const { lamin, lomin, lamax, lomax } = req.query;

  // Basic validation
  if ([lamin, lomin, lamax, lomax].some(v => v === undefined || v === '')) {
    return res.status(400).json({ time: 0, states: [], error: 'Missing bounding-box parameters' });
  }

  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Optional: add your OpenSky credentials if you have them
        // 'Authorization': 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
      }
    });

    if (!response.ok) {
      throw new Error(`OpenSky ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data ?? { time: 0, states: [] });
  } catch (err) {
    console.error('OpenSky error:', err.name || err.message);

    // Optional very light retry (once)
    if (err.name === 'AbortError' || err.message?.includes('5')) {
      try {
        const retry = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (retry.ok) {
          const data = await retry.json();
          return res.status(200).json(data ?? { time: 0, states: [] });
        }
      } catch (_) { /* fall through */ }
    }

    return res.status(200).json({
      time: 0,
      states: [],
      error: 'OpenSky temporarily unavailable'
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
