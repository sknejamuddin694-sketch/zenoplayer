import { createFileRoute } from "@tanstack/react-router";
import worker from "@/shared/moviebox.js";

const buckets = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;

// Only provider-owned hosts are accepted by the asset proxy (prevents SSRF).
function allowedProviderUrl(target: URL) {
  const host = target.hostname.toLowerCase();
  const allowedHost =
    host === "moviebox.ph" ||
    host.endsWith(".moviebox.ph") ||
    host === "aoneroom.com" ||
    host.endsWith(".aoneroom.com") ||
    host === "123movienow.cc" ||
    host.endsWith(".123movienow.cc") ||
    host === "videodownloader.site" ||
    host.endsWith(".videodownloader.site");
  return target.protocol === "https:" && !target.username && !target.password &&
    (!target.port || target.port === "443") && allowedHost;
}

function rewriteExternalUrls(value: unknown, publicOrigin: string): unknown {
  if (typeof value === "string") {
    if (value.startsWith("//")) value = "https:" + value;
    if (!/^https?:\/\//i.test(value)) return value;
    try {
      const remote = new URL(value);
      if (remote.origin === publicOrigin) return value;
      // Movie detail links should resolve to our own detail API, not MovieBox pages.
      if (
        (remote.hostname === "moviebox.ph" || remote.hostname.endsWith(".moviebox.ph")) &&
        remote.pathname.startsWith("/detail/")
      ) {
        return new URL("/api/public/mb" + remote.pathname + remote.search + remote.hash, publicOrigin).toString();
      }
      const local = new URL("/api/public/mb/proxy", publicOrigin);
      local.searchParams.set("url", remote.toString());
      return local.toString();
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map((item) => rewriteExternalUrls(item, publicOrigin));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        rewriteExternalUrls(item, publicOrigin),
      ]),
    );
  }
  return value;
}

async function proxyProviderAsset(request: Request, url: URL) {
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) return new Response("Missing url parameter", { status: 400 });
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }
  if (!allowedProviderUrl(target)) return new Response("Upstream host is not allowed", { status: 403 });

  const headers = new Headers({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    Accept: request.headers.get("accept") || "*/*",
    Referer: "https://moviebox.ph/",
    Origin: "https://moviebox.ph",
  });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  let upstream: Response | null = null;
  // Validate every redirect target too; do not allow a trusted host to redirect to an arbitrary host.
  for (let hop = 0; hop < 6; hop += 1) {
    upstream = await fetch(target.toString(), {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "manual",
    });
    if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
    const location = upstream.headers.get("location");
    if (!location) break;
    target = new URL(location, target);
    if (!allowedProviderUrl(target)) return new Response("Redirect host is not allowed", { status: 403 });
  }
  if (!upstream) return new Response("Upstream request failed", { status: 502 });

  const responseHeaders = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

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
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/public\/mb/, "") || "/";
  if (limited(request, path)) return new Response("Too Many Requests", { status: 429, headers: { "retry-after": "60", "cache-control": "no-store" } });
  const target = new Request(`https://mb.local${path}${url.search}`, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: request.headers,
  });
  let res = path === "/proxy"
    ? await proxyProviderAsset(request, url)
    : await worker.fetch(target);

  // Populate episode watch links automatically using the public streaming endpoint.
  if (request.method !== "HEAD" && path.startsWith("/episodes/") && res.ok && (res.headers.get("content-type") || "").includes("json")) {
    try {
      const episodePayload = await res.clone().json();
      const slug = decodeURIComponent(path.slice("/episodes/".length));
      const subjectId = episodePayload?.subject_id;
      if (subjectId && Array.isArray(episodePayload?.seasons)) {
        for (const season of episodePayload.seasons) {
          for (const episode of season.episodes || []) {
            const watch = new URL(`/api/public/mb/watch/${subjectId}`, url.origin);
            watch.searchParams.set("detail_path", slug);
            watch.searchParams.set("se", String(episode.se ?? season.season ?? season.se ?? 1));
            watch.searchParams.set("ep", String(episode.ep ?? 1));
            watch.searchParams.set("resolution", "480");
            episode.watch_url = watch.toString();
          }
        }
        res = new Response(JSON.stringify(episodePayload), { status: res.status, statusText: res.statusText, headers: res.headers });
      }
    } catch { /* Keep original episode metadata if link generation fails. */ }
  }

  // Rewrite every absolute URL in JSON payloads so API consumers only see ZenoPlayer links.
  if (request.method !== "HEAD" && (res.headers.get("content-type") || "").includes("json")) {
    try {
      const payload = await res.clone().json();
      const localized = rewriteExternalUrls(payload, url.origin);
      const jsonHeaders = new Headers(res.headers);
      jsonHeaders.delete("content-length");
      jsonHeaders.delete("content-encoding");
      res = new Response(JSON.stringify(localized), {
        status: res.status,
        statusText: res.statusText,
        headers: jsonHeaders,
      });
    } catch {
      // Preserve non-JSON or malformed upstream bodies unchanged.
    }
  }
  const out = new Response(res.body, res);
  out.headers.set("access-control-allow-origin", "*");
  out.headers.set("access-control-allow-methods", "GET, HEAD, OPTIONS");
  out.headers.set("access-control-allow-headers", "Content-Type");
  out.headers.set("x-robots-tag", "noindex, nofollow");
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "same-origin");
  out.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  const media = /^\/(watch|download|api\/stream)(\/|$)/.test(path);
  if (path === "/proxy" && res.status === 200) {
    out.headers.set("cache-control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
  } else if (!media && res.status === 200) {
    out.headers.set("cache-control", "public, max-age=30, s-maxage=180, stale-while-revalidate=300");
  } else {
    out.headers.set("cache-control", "private, no-store");
  }
  return out;
}

export const Route = createFileRoute("/api/public/mb/$")({
  server: { handlers: { GET: handle, HEAD: handle, OPTIONS: () => new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "Content-Type", "access-control-max-age": "86400" } }) } },
});
