// src/modules/reddit/fetcher.js

const BASE = "https://oauth.reddit.com";
const PUBLIC_BASE = "https://www.reddit.com";

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Normalize subreddit input:
 * memes -> memes
 * r/memes -> memes
 */
function normalizeSubreddit(input) {
  if (!input) return "all";
  return input.replace(/^r\//i, "").trim();
}

/**
 * Get Reddit OAuth token (if env vars provided)
 */
async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "AFTIESBot/1.0",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`);
  }

  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Core Reddit request
 */
async function redditFetch(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const fullPath = qs ? `${path}?${qs}` : path;

  const token = await getAccessToken();

  const base = token ? BASE : PUBLIC_BASE;

  const res = await fetch(`${base}${fullPath}`, {
    headers: {
      "User-Agent": process.env.REDDIT_USER_AGENT || "AFTIESBot/1.0",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit responded with status ${res.status}`);
  }

  return res.json();
}

/* ================================
   Public helpers
================================ */

async function getHot(subreddit, limit = 25) {
  subreddit = normalizeSubreddit(subreddit);
  return redditFetch(`/r/${subreddit}/hot.json`, {
    limit,
  });
}

async function getTop(subreddit, time = "day", limit = 25) {
  subreddit = normalizeSubreddit(subreddit);
  return redditFetch(`/r/${subreddit}/top.json`, {
    t: time,
    limit,
  });
}

async function searchPosts(
  query,
  subreddit = null,
  sort = "relevance",
  limit = 25,
) {
  if (subreddit) {
    subreddit = normalizeSubreddit(subreddit);
    return redditFetch(`/r/${subreddit}/search.json`, {
      q: query,
      sort,
      limit,
      restrict_sr: true,
    });
  }

  return redditFetch(`/search.json`, {
    q: query,
    sort,
    limit,
  });
}

async function getUserPosts(username, limit = 10) {
  return redditFetch(`/user/${username}/submitted.json`, {
    limit,
  });
}

/* ================================
   Exports
================================ */

module.exports = {
  normalizeSubreddit,
  getHot,
  getTop,
  searchPosts,
  getUserPosts,
};
