// api/flights.js

let cache = {
  data: null,
  timestamp: 0,
  token: null,
  tokenExpiry: 0
};

const CACHE_DURATION = 30_000;

const JP_BBOX = {
  lamin: 31.03,
  lomin: 129.41,
  lamax: 45.55,
  lomax: 145.54
};

const CLIENT_ID = "oloniyot123-api-client";
const CLIENT_SECRET = "7YFCBgFf8cpqsvH6IE5OF5MUgSbeKvd1";

async function getAccessToken() {
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

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Token failed (${res.status}): ${text}`);
  }

  const data = JSON.parse(text);
  cache.token = data.access_token;
  cache.tokenExpiry = Date.now() + (data.expires_in * 1000);

  return cache.token;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  try {
    const now = Date.now();

    if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cache.data);
    }

    const token = await getAccessToken();

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

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`OpenSky failed (${response.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);

    cache.data = data;
    cache.timestamp = now;

    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);

  } catch (error) {
    console.error("Error:", error.message);

    // Return the REAL error so we can see it
    return res.status(200).json({
      time: 0,
      states: [],
      error: error.message
    });
  }
}
