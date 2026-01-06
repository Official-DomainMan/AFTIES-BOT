const { fetch } = require("undici");

async function fetchListing(subreddit, sort = "top", limit = 1) {
  const clean = subreddit.replace(/^r\//i, "").trim();
  const url = `https://www.reddit.com/r/${encodeURIComponent(
    clean
  )}/${sort}.json?limit=${limit}&t=day`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AFTIESBot/1.0 (Discord Bot)" },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status}`);

    const json = await res.json();
    const post = json?.data?.children?.[0]?.data;
    return post || null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchListing };
