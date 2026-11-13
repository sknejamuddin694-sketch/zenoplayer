export type Item = { name: string; poster_url: string; slug: string; badge?: string | null; year?: string | null };
export type Section = { section: string; count: number; movies: Item[] };

export const API = "/api/public/mb";

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfter: string | null) {
    const seconds = Number(retryAfter);
    const wait = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
    super(`Too many requests. Please wait ${wait} seconds before trying again.`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = wait;
  }
}

// The app's server normally talks to MovieBox. Some hosts (e.g. Cloudflare-based hosting) get
// rate-limited by the provider, so if the server call fails we run the same MovieBox code in the
// visitor's browser, which talks to the provider directly (its CORS allows our sites). Explicit
// 429 responses are surfaced and never retried directly against the provider.
let browserMode = false;

async function getInBrowser<T>(path: string): Promise<T> {
  const { default: worker } = await import("@/shared/moviebox.js");
  const r = await worker.fetch(new Request("https://mb.local" + path));
  if (r.status === 429) throw new RateLimitError(r.headers.get("retry-after"));
  if (!r.ok) throw new Error("Request failed");
  return r.json();
}

export async function get<T>(path: string): Promise<T> {
  if (!browserMode) {
    try {
      const r = await fetch(API + path);
      if (r.status === 429) throw new RateLimitError(r.headers.get("retry-after"));
      if (r.ok) return await r.json();
    } catch (error) {
      if (error instanceof RateLimitError) throw error;
      /* fall through to browser mode */
    }
    if (typeof window === "undefined") throw new Error("Request failed");
  }
  const data = await getInBrowser<T>(path);
  browserMode = true;
  return data;
}

export const watchUrl = (id: string, slug: string, se = 0, ep = 0, res = 0) =>
  `${API}/watch/${id}?detail_path=${encodeURIComponent(slug)}&se=${se}&ep=${ep}&resolution=${res}`;
