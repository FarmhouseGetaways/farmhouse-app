/**
 * Scheduled: rolls the Instagram long-lived token before it expires.
 *
 * A long-lived token is good for 60 days and can be exchanged for a fresh 60
 * days at any point after it is 24 hours old. Miss the window and the feed
 * goes quiet until somebody notices and generates a new token by hand — which
 * is exactly the kind of chore that gets noticed three weeks late.
 *
 * This runs weekly, which leaves seven chances to succeed before anything is
 * actually at risk. The rolled token goes into Netlify Blobs; instagram.mjs
 * reads Blobs first and the IG_TOKEN environment variable second, so the
 * environment variable stays as the seed and is never rewritten.
 *
 * Schedule lives in netlify.toml.
 */
export default async () => {
  // Dynamic and guarded: a zip-drop deploy has no npm install, so this package
  // may not exist. Nothing to roll into in that case — say so and stop.
  let store;
  try {
    const { getStore } = await import("@netlify/blobs");
    store = getStore("instagram");
  } catch (err) {
    console.log("instagram-refresh: @netlify/blobs unavailable on this deploy — " +
                "regenerate IG_TOKEN by hand, or deploy from git");
    return new Response("no store", { status: 200 });
  }
  const current = ((await store.get("token")) || process.env.IG_TOKEN || "").trim();

  if (!current) {
    console.log("instagram-refresh: no token to roll — set IG_TOKEN and redeploy");
    return new Response("no token", { status: 200 });
  }

  const res = await fetch(
    "https://graph.instagram.com/refresh_access_token" +
      `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`
  );

  if (!res.ok) {
    // Deliberately not throwing. A failed roll is not an outage — the existing
    // token is still good for weeks, and there are six more attempts before it
    // matters. Throwing would just fill the log with red.
    console.log(`instagram-refresh: ${res.status} ${await res.text()}`);
    return new Response("refresh failed", { status: 200 });
  }

  const body = await res.json();
  if (!body.access_token) {
    console.log("instagram-refresh: no access_token in the response");
    return new Response("no token in response", { status: 200 });
  }

  await store.set("token", body.access_token);
  const days = Math.round((body.expires_in || 0) / 86400);
  console.log(`instagram-refresh: rolled, good for about ${days} days`);
  return new Response("ok", { status: 200 });
};
