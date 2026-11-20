import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/playback/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => proxyRequest(request),
      HEAD: async ({ request }) => proxyRequest(request, true),
    }
  }
});

async function proxyRequest(request: Request, head = false) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return new Response("Missing url", { status: 400 });
  let target: URL;
  try { target = new URL(raw); } catch { return new Response("Invalid url", { status: 400 }); }
  const hosts = (process.env.PLAYBACK_ALLOWED_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (target.protocol !== "https:" || !hosts.includes(target.hostname.toLowerCase()) || target.username || target.password || target.port && target.port !== "443") {
    return new Response("Host not allowed. Configure PLAYBACK_ALLOWED_HOSTS for your licensed provider/CDN.", { status: 403 });
  }
  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  let upstream: Response;
  try {
    upstream = await fetch(target, { method: head ? "HEAD" : "GET", headers, redirect: "error", signal: AbortSignal.timeout(20000) });
  } catch { return new Response("Upstream unavailable", { status: 502 }); }
  const outHeaders = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(key); if (value) outHeaders.set(key, value);
  }
  outHeaders.set("Access-Control-Allow-Origin", "*");
  outHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  outHeaders.set("Cache-Control", "no-store");
  return new Response(head ? null : upstream.body, { status: upstream.status, headers: outHeaders });
}
