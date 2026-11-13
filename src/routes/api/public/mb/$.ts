import { createFileRoute } from "@tanstack/react-router";
import worker from "@/shared/moviebox.js";
import { isProxyRequestAllowed } from "@/lib/proxy-guard";

const buckets = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function limited(request: Request, path: string) {
  const media = /^\/(watch|download|api\/stream)\//.test(path);
  const key = `${clientKey(request)}:${media ? "media" : "api"}`;
  const now = Date.now();
  const current = buckets.get(key);
  const limit = media ? 45 : 240;
  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > limit;
}

async function handle({ request }: { request: Request }) {
  if (!isProxyRequestAllowed(request)) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/public\/mb/, "") || "/";
  if (limited(request, path)) return new Response("Too Many Requests", { status: 429, headers: { "retry-after": "60", "cache-control": "no-store" } });
  const target = new Request(`https://mb.local${path}${url.search}`, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: request.headers,
  });
  const res = await worker.fetch(target);
  const out = new Response(res.body, res);
  out.headers.delete("access-control-allow-origin");
  out.headers.set("x-robots-tag", "noindex, nofollow");
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "same-origin");
  out.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  const media = /^\/(watch|download|api\/stream)(\/|$)/.test(path);
  if (!media && res.status === 200) {
    out.headers.set("cache-control", "public, max-age=30, s-maxage=180, stale-while-revalidate=300");
  } else {
    out.headers.set("cache-control", "private, no-store");
  }
  return out;
}

export const Route = createFileRoute("/api/public/mb/$")({
  server: { handlers: { GET: handle, HEAD: handle } },
});
