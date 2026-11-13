import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { get, RateLimitError, type Section } from "@/lib/api";
import { Header } from "@/components/Header";
import { Row } from "@/components/Poster";
import { getTab, sectionsForTab } from "@/lib/tabs";
import { BottomNav } from "@/components/BottomNav";
import { animeCollections, uniqueItems } from "@/lib/recommendations";

async function optional<T>(path: string, fallback: T): Promise<T> {
  try { return await get<T>(path); } catch { return fallback; }
}

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { tab?: string } => (typeof s["tab"] === "string" ? { tab: s["tab"] } : {}),
  head: () => ({
    meta: [
      { title: "ZenoPlayer — Watch movies & TV series free" },
      { name: "description", content: "Stream trending movies, TV series, anime and K-dramas in HD." },
      { property: "og:title", content: "ZenoPlayer — Watch movies & TV series" },
      { property: "og:description", content: "Stream trending movies, TV series, anime and K-dramas in HD." },
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
        const [home, trend, animation] = await Promise.all([
          get<{ sections: Section[] }>("/home"),
          optional<Section>("/anime", { section: "Anime", count: 0, movies: [] }),
          optional<{ sections: Section[] }>("/animation", { sections: [] }),
        ]);
        const top = home.sections.filter((x) => /anime/i.test(x.section));
        const trending = uniqueItems(trend.movies ?? []);
        const banner = { section: "Banner", count: 0, movies: uniqueItems([...trending, ...top.flatMap((x) => x.movies)]).slice(0, 8) };
        const curated = animeCollections(home.sections, trending);
        const liveAnimation = animation.sections.flatMap((section) => section.movies).length
          ? animation.sections
          : [];
        const seen = new Set<string>();
        const shelves = [...liveAnimation, ...top, ...curated].filter((section) => {
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
      const extra = [...movies.sections, ...tv.sections, ...anime.sections];
      return { sections: [...home.sections, ...extra] };
    },
    staleTime: 5 * 60_000,
  });
  const rest = sectionsForTab(tab, data?.sections ?? []);
  const ownBanner = data?.sections.find((s) => s.section === "Banner")?.movies ?? [];
  const banner = getTab(tab).match ? rest[0]?.movies.slice(0, 8) ?? [] : ownBanner;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!banner.length) return;
    const t = setInterval(() => setI((x) => (x + 1) % banner.length), 6000);
    return () => clearInterval(t);
  }, [banner.length]);
  useEffect(() => setI(0), [tab]);
  const hero = banner[i] ?? banner[0];


  return (
    <div className="min-h-screen pb-24">
      <Header tabs active={tab} />
      {isLoading && <div className="hero-skeleton" />}
      {error && !data && (
        <div className="p-10 text-center">
          <p className="text-muted-foreground">{error instanceof RateLimitError ? error.message : "Couldn't load movies."}</p>
          {!(error instanceof RateLimitError) && (
            <button onClick={() => refetch()} disabled={isFetching} className="btn-primary mx-auto mt-4">
              {isFetching ? "Loading…" : "Try again"}
            </button>
          )}
        </div>
      )}
      {hero && (
        <>
          <section className="hero">
            <img src={hero.poster_url} alt="" className="backdrop" aria-hidden="true" />
            <img src={hero.poster_url} alt={hero.name} className="hero-img" />
            <div className="hero-fade" />
            <div className="hero-copy">
              <p className="hero-kicker">ZenoPlayer spotlight</p>
              <h1>Best Movies and TV Shows to Watch</h1>
              <p>Fresh picks, popular series and anime in one place.</p>
            </div>
          </section>
          <div className="no-scrollbar relative z-10 -mt-12 flex gap-3 overflow-x-auto px-4">
            {banner.map((b, k) => (
              <Link
                key={b.slug}
                to="/title/$slug"
                params={{ slug: b.slug }}
                onMouseEnter={() => setI(k)}
                className={`flex w-[85%] max-w-md shrink-0 items-end gap-3 rounded-lg bg-card px-3 pb-3 ${k === i ? "" : "opacity-70"}`}
              >
                <img src={b.poster_url} alt="" className="-mt-4 h-20 w-16 rounded bg-secondary object-contain" />
                <div className="min-w-0 flex-1 pb-1">
                  <p className="line-clamp-1 text-base font-semibold">{b.name}</p>
                  <p className="text-sm text-muted-foreground">{b.badge ?? "Featured"}</p>
                </div>
                <span className="play-fab mb-2"><Play className="h-4 w-4 fill-current" /></span>
              </Link>
            ))}
          </div>
        </>
      )}
      {rest.map((s, k) => (
        <Row key={s.section} section={s.section} title={k === 0 ? `${s.section} 🔥` : s.section} items={s.movies} />
      ))}
      <BottomNav />
    </div>
  );
}
