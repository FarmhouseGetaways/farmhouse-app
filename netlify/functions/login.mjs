/**
 * GET    /.netlify/functions/login              -> { ok, signedIn, email, google }
 * GET    /.netlify/functions/login?code=...      -> Google's redirect back; signs in
 * DELETE /.netlify/functions/login               -> signs out
 *
 * The door into this app's own small admin corner (see CLAUDE.md — the
 * Push tab only, guest-broadcast + enrolling this phone; everything else
 * that used to be admin here moved to farmhouse-admin). Copied from that
 * repo's own `login.mjs` — same Authorization Code flow, same reasoning:
 * a plain top-level redirect to Google's sign-in page, not Google's
 * rendered button, because that button doesn't work in Safari (confirmed
 * live, see farmhouse-admin's CLAUDE.md for the detail).
 *
 * Reuses the SAME Google OAuth client farmhouse-admin and
 * farmhousegetaways.com's kpi.mjs already use — this app's own origin and
 * this function's own URL were added to that client's Authorized
 * JavaScript origins / Authorized redirect URIs in Google Cloud Console.
 */
import { verifyIdToken, configured as googleConfigured, clientId as googleClientId } from "./_lib/google.mjs";
import { isAllowed } from "./_lib/admin-emails.mjs";
import { currentEmail, makeSessionToken, sessionCookie, json } from "./_lib/session.mjs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

function redirectTo(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store", ...extraHeaders } });
}

function redirectUri(url) {
  return `${url.origin}/.netlify/functions/login`;
}

async function exchangeCode(code, redirectUriValue) {
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET is not set.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: clientSecret,
      redirect_uri: redirectUriValue,
      grant_type: "authorization_code",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id_token) {
    throw new Error(body.error_description || body.error || `Google's token exchange failed (${res.status}).`);
  }
  return body.id_token;
}

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("code") || url.searchParams.get("error")) {
      if (url.searchParams.get("error")) {
        return redirectTo("/admin.html?error=" + encodeURIComponent("Google sign-in was cancelled."));
      }
      // The browser sometimes fires this redirect twice for one sign-in (seen
      // live, both requests carrying the same code). Google's auth code is
      // single-use, so the second exchange always fails — but if the first
      // one already landed and set a valid session, treat the duplicate as
      // success instead of bouncing the user to an error page.
      if (currentEmail(req)) {
        return redirectTo("/admin.html");
      }
      try {
        const idToken = await exchangeCode(url.searchParams.get("code"), redirectUri(url));
        const claims = await verifyIdToken(idToken);
        if (!isAllowed(claims.email)) {
          return redirectTo("/admin.html?error=" + encodeURIComponent(`${claims.email} is not authorised for this app.`));
        }
        return redirectTo("/admin.html", { "Set-Cookie": sessionCookie(makeSessionToken(claims.email)) });
      } catch (err) {
        return redirectTo("/admin.html?error=" + encodeURIComponent(err.message || "Sign-in failed."));
      }
    }

    const email = currentEmail(req);
    return json({
      ok: true,
      signedIn: Boolean(email),
      email,
      google: googleConfigured() ? { clientId: googleClientId(), redirectUri: redirectUri(url) } : null,
    });
  }

  if (req.method === "DELETE") {
    return json({ ok: true, signedIn: false }, 200, { "Set-Cookie": sessionCookie("") });
  }

  return json({ ok: false }, 405);
};
