// api/flights.js  (or whatever your API route is named)

let cache = {
  data: null,
  timestamp: 0,
  token: null,
  tokenExpiry: 0
};

const CACHE_DURATION = 30_000; // 30 seconds

// Japan bounding box
const JP_BBOX = {
  lamin: 31.03,
  lomin: 129.41,
  lamax: 45.55,
  lomax: 145.54
};

// Your OpenSky credentials
const CLIENT_ID = "oloniyot123-api-client";
const CLIENT_SECRET = "7YFCBgFf8cpqsvH6IE5OF5MUgSbeKvd1";

async function getAccessToken() {
  // Reuse token if still valid (with 60s buffer)
  if (cache.token && Date.now() < cache.tokenExpiry - 60000) {
    return cache.token;
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  const res = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  if (!res.ok) {
    throw new Error(`Token error: ${res.status}`);
  }

  const data = await res.json();
  cache.token = data.access_token;
  cache.tokenExpiry = Date.now() + (data.expires_in * 1000);

  return cache.token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  try {
    const now = Date.now();

    // Serve from cache if fresh
    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cache.data);
    }

    // Get token
    const token = await getAccessToken();

    // Build OpenSky URL
    const url = new URL("https://opensky-network.org/api/states/all");
    url.searchParams.set("lamin", JP_BBOX.lamin);
    url.searchParams.set("lomin", JP_BBOX.lomin);
    url.searchParams.set("lamax", JP_BBOX.lamax);
    url.searchParams.set("lomax", JP_BBOX.lomax);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    let response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
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

    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);

  } catch (error) {
    console.error("OpenSky error:", error.name, error.message);

    // Return stale cache if available
    if (cache.data) {
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(cache.data);
    }

    return res.status(200).json({
      time: 0,
      states: [],
      error: "OpenSky temporarily unavailable",
    });
  }
}
