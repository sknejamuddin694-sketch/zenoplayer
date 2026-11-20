import { createFileRoute } from "@tanstack/react-router";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/playback/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const api = process.env.PLAYBACK_API_URL;
        if (!api) return json({ error: "Playback source is not configured", code: "SOURCE_NOT_CONFIGURED" }, 503);
        try {
          const url = new URL(api);
          url.searchParams.set("slug", params.slug);
          const upstream = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
          if (!upstream.ok) return json({ error: "Playback provider returned an error", provider_status: upstream.status }, 502);
          const payload: any = await upstream.json();
          const rawSources = Array.isArray(payload?.sources) ? payload.sources : (payload?.url ? [{ url: payload.url, quality: payload.quality, type: payload.type }] : []);
          const sources = rawSources.filter((s: any) => typeof s?.url === "string" && /^https:\/\//i.test(s.url)).map((s: any) => ({
            url: s.url, quality: s.quality ?? "auto", type: s.type ?? (s.url.includes(".m3u8") ? "hls" : "mp4")
          }));
          if (!sources.length) return json({ slug: params.slug, status: "unavailable", sources: [], error: "Provider returned no valid playback sources" }, 404);
          return json({ slug: params.slug, status: "ready", sources, subtitles: Array.isArray(payload.subtitles) ? payload.subtitles : [] });
        } catch {
          return json({ error: "Playback provider unreachable or invalid response", code: "UPSTREAM_ERROR" }, 502);
        }
      }
    }
  }
});
