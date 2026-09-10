/**
 * Who is allowed into this app's own small admin corner — the same three
 * accounts as farmhouse-admin, all with identical access. Copied, not
 * shared: these are two separate Netlify sites.
 */
const normaliseEmail = (v) => String(v ?? "").trim().toLowerCase();

const ALLOWED_EMAILS = new Set([
  "farmhousegetaways@gmail.com",
  "corydzbinski@gmail.com",
  "carissau@gmail.com",
].map(normaliseEmail));

export const isAllowed = (email) => ALLOWED_EMAILS.has(normaliseEmail(email));
