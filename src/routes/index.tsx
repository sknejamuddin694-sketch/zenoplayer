import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import { get, RateLimitError, type Section } from "@/lib/api";
import { Header } from "@/components/Header";
import { Row } from "@/components/Poster";
import { BottomNav } from "@/components/BottomNav";
import { TrackerOverview } from "@/components/TrackerOverview";
import { getTab, sectionsForTab } from "@/lib/tabs";
import { animeCollections, uniqueItems } from "@/lib/recommendations";

async function optional<T>(path: string, fallback: T): Promise<T> {
  try { return await get<T>(path); } catch { return fallback; }
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => (typeof search["tab"] === "string" ? { tab: search["tab"] } : {}),
  head: () => ({
    meta: [
      { title: "ZenoPlayer — Your Anime Tracker" },
      { name: "description", content: "Track your anime and discover your next favorite series on ZenoPlayer." },
      { property: "og:title", content: "ZenoPlayer — Your Anime Tracker" },
      { property: "og:description", content: "Track episodes, keep your list, and find your next anime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const tab = Route.useSearch().tab ?? "trending";
  const source = getTab(tab).source;
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["feed", source],
    queryFn: async (): Promise<{ sections: Section[] }> => {
      if (source === "movie") {
        const [tabMovie, movies] = await Promise.all([
          get<{ sections: Section[] }>("/tab/movie"),
          optional<{ sections: Section[] }>("/movies", { sections: [] }),
        ]);
        return { sections: [...tabMovie.sections, ...movies.sections] };
      }
      if (source === "anime") {
        const [home, trend, animation, curated] = await Promise.all([
          get<{ sections: Section[] }>("/home"),
          optional<Section>("/anime", { section: "Anime", count: 0, movies: [] }),
          optional<{ sections: Section[] }>("/animation", { sections: [] }),
          optional<{ sections: Section[] }>("/curated-anime", { sections: [] }),
        ]);
        const top = home.sections.filter((section) => /anime/i.test(section.section));
        const trending = uniqueItems(trend.movies ?? []);
        const curatedMovies = curated.sections.flatMap((section) => section.movies);
        const banner = { section: "Banner", count: 0, movies: uniqueItems([...curatedMovies, ...trending, ...top.flatMap((section) => section.movies)]).slice(0, 8) };
        const curated = animeCollections(home.sections, trending);
        const liveAnimation = animation.sections.flatMap((section) => section.movies).length ? animation.sections : [];
        const seen = new Set<string>();
        const shelves = [...curated.sections, ...liveAnimation, ...top, ...curated].filter((section) => {
          if (seen.has(section.section)) return false;
          seen.add(section.section);
          return section.movies.length > 0;
        });
        return { sections: [banner, ...shelves] };
      }
      const [home, movies, anime, tv] = await Promise.all([
        get<{ sections: Section[] }>("/home"),
        optional<{ sections: Section[] }>("/movies", { sections: [] }),
        optional<{ sections: Section[] }>("/animation", { sections: [] }),
        optional<{ sections: Section[] }>("/tv-series", { sections: [] }),
      ]);
      return { sections: [...home.sections, ...movies.sections, ...tv.sections, ...anime.sections] };
    },
    staleTime: 5 * 60_000,
  });
  const rest = sectionsForTab(tab, data?.sections ?? []);
  const ownBanner = data?.sections.find((section) => section.section === "Banner")?.movies ?? [];
  const banner = getTab(tab).match ? rest[0]?.movies.slice(0, 8) ?? [] : ownBanner;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!banner.length) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % banner.length), 7000);
    return () => clearInterval(timer);
  }, [banner.length]);
  useEffect(() => setIndex(0), [tab]);
  const hero = banner[index] ?? banner[0];

  return (
    <div className="app-page">
      <Header tabs active={tab} />
      <main className="app-content">
        <TrackerOverview />

        {isLoading && <div className="route-panel mt-6 animate-pulse text-sm text-muted-foreground">Loading your next favorites…</div>}
        {error && !data && (
          <div className="route-panel mt-6 text-center">
            <p className="text-sm text-muted-foreground">{error instanceof RateLimitError ? error.message : "Couldn't load titles right now."}</p>
            {!(error instanceof RateLimitError) && <button onClick={() => refetch()} disabled={isFetching} className="btn-primary mt-4">{isFetching ? "Loading…" : "Try again"}</button>}
          </div>
        )}

        {hero && (
          <section className="spotlight-card mt-7" aria-label="Featured title">
            <div className="spotlight-copy">
              <p className="page-kicker">{tab === "anime" ? "ANIME SPOTLIGHT" : "TODAY'S SPOTLIGHT"}</p>
              <h2>{tab === "anime" ? "Your next anime obsession" : "Find your next favorite"}</h2>
              <p className="line-clamp-1">{hero.name}{hero.badge ? ` · ${hero.badge}` : ""}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link to="/title/$slug" params={{ slug: hero.slug }} className="btn-primary px-4 py-2 text-xs">Explore title <Play className="h-3.5 w-3.5 fill-current" /></Link>
                {banner.length > 1 && <button onClick={() => setIndex((current) => (current + 1) % banner.length)} className="btn-ghost px-3 py-2 text-xs">Next pick <ArrowUpRight className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
            <Link to="/title/$slug" params={{ slug: hero.slug }} className="spotlight-image" aria-label={`Explore ${hero.name}`}>
              <img src={hero.poster_url} alt={hero.name} loading="lazy" />
            </Link>
          </section>
        )}

        {rest.map((section) => <Row key={section.section} section={section.section} title={section.section} items={section.movies} />)}
      </main>
      <BottomNav />
    </div>
  );
}
