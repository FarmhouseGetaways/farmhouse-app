/**
 * Who is allowed into this app's own small admin corner (Push tab only —
 * see CLAUDE.md's "MBM-only admin corner" section for why this exists
 * separately from farmhouse-admin). Same three accounts, same full access,
 * as farmhouse-admin's own allowlist — copied rather than shared, since
 * these are two separate Netlify sites with no runtime in common.
 */
const normaliseEmail = (v) => String(v ?? "").trim().toLowerCase();

const ALLOWED_EMAILS = new Set([
  "farmhousegetaways@gmail.com",
  "corydzbinski@gmail.com",
  "carissau@gmail.com",
].map(normaliseEmail));

export const isAllowed = (email) => ALLOWED_EMAILS.has(normaliseEmail(email));
