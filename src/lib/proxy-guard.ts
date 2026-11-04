// Only our own sites may use the MovieBox proxy. Blocks bots, scripts and other websites.
// Every new deployment host (Vercel preview/production domains included) has to be listed
// here, or the whole app starts answering 403.
const ALLOWED = [/(^|\.)co08\.art$/, /(^|\.)onrender\.com$/, /(^|\.)vercel\.app$/, /(^|\.)lovable\.app$/, /(^|\.)lovableproject\.com$/, /(^|\.)workers\.dev$/, /(^|\.)pages\.dev$/, /^localhost$/, /^127\.0\.0\.1$/];
const BOT_UA = /bot|crawl|spider|curl|wget|python|httpie|axios|node-fetch|go-http|java\/|okhttp|postman|insomnia|scrapy|headless|phantom|selenium|puppeteer|playwright|libwww|aiohttp|php|ruby|perl|powershell|yt-dlp|youtube-dl|ffmpeg|aria2|idm|download/i;

function hostOf(v: string | null) {
  if (!v) return null;
  try { return new URL(v).hostname; } catch { return null; }
}

export function isProxyRequestAllowed(request: { headers: Headers }): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return false;
  const host = hostOf(request.headers.get("origin")) ?? hostOf(request.headers.get("referer"));
  if (!host || !ALLOWED.some((r) => r.test(host))) return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "same-site") return false;
  return true;
}
