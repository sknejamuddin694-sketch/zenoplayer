import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { get, RateLimitError, type Section } from "@/lib/api";
import { Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { BottomNav } from "@/components/BottomNav";
import { animeCollections } from "@/lib/recommendations";

async function optional<T>(path: string, fallback: T): Promise<T> {
  try { return await get<T>(path); } catch { return fallback; }
}

export const Route = createFileRoute("/section/$name")({
  head: () => ({ meta: [{ title: "Anime collection — ZenoPlayer" }, { name: "description", content: "Explore a curated collection of anime and titles on ZenoPlayer." }] }),
  component: Page,
});

function Page() {
  const { name } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["section", name],
    queryFn: async () => {
      const [home, tabMovie, movies, anime, animeTrend] = await Promise.all([
        get<{ sections: Section[] }>("/home"),
        optional<{ sections: Section[] }>("/tab/movie", { sections: [] }),
        optional<{ sections: Section[] }>("/movies", { sections: [] }),
        optional<{ sections: Section[] }>("/animation", { sections: [] }),
        optional<Section>("/anime", { section: "Anime", count: 0, movies: [] }),
      ]);
      return { sections: [...home.sections, ...tabMovie.sections, ...movies.sections.map((section) => ({ ...section, section: "More Movies" })), ...anime.sections.map((section) => ({ ...section, section: "More Anime" })), ...animeCollections(home.sections, animeTrend.movies)] };
    },
    staleTime: 5 * 60_000,
  });
  const section = data?.sections.find((item) => item.section === name);

  return (
    <div className="app-page">
      <Header />
      <main className="app-content">
        <p className="page-kicker">CURATED COLLECTION</p>
        <h1 className="page-heading">{name}</h1>
        {section && <p className="mb-5 text-sm text-muted-foreground">{section.count || section.movies.length} titles to explore</p>}
        {error && <p role="alert" className="route-panel text-sm text-muted-foreground">{error instanceof RateLimitError ? error.message : "This collection is temporarily unavailable."}</p>}
        {isLoading && <p className="route-panel animate-pulse text-sm text-muted-foreground">Loading this collection…</p>}
        {data && !section && <div className="empty-state"><p className="font-bold text-foreground">Nothing here yet</p><p className="text-xs">Try another anime collection.</p></div>}
        {section && !section.movies.length && <div className="empty-state"><p className="font-bold text-foreground">No titles in this collection</p></div>}
        <div className="mt-5 grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 md:grid-cols-5">
          {section?.movies.map((item) => <Poster key={item.slug} item={item} />)}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
