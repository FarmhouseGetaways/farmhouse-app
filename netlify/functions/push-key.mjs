/**
 * GET /.netlify/functions/push-key
 *
 * Hands the browser the VAPID public key it needs to subscribe.
 *
 * It is served rather than baked into the build on purpose: rotating keys then
 * means changing one environment variable, not rebuilding and redeploying the
 * app and hoping every installed phone picks it up. The public key is public
 * by design — it is the private one that never leaves Netlify.
 */
export default async () =>
  Response.json(
    { key: process.env.VAPID_PUBLIC || "" },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
