import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { get, type Section } from "@/lib/api";
import { Poster } from "@/components/Poster";
import { BottomNav } from "@/components/BottomNav";
import { animeCollections } from "@/lib/recommendations";

async function optional<T>(path: string, fallback: T): Promise<T> {
  try { return await get<T>(path); } catch { return fallback; }
}

export const Route = createFileRoute("/section/$name")({
  head: () => ({
    meta: [
      { title: "Browse — ZenoPlayer" },
      { name: "description", content: "Browse a full collection of titles on ZenoPlayer." },
      { property: "og:title", content: "Browse — ZenoPlayer" },
      { property: "og:description", content: "Browse a full collection of titles on ZenoPlayer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { name } = Route.useParams();
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["section", name],
    queryFn: async () => {
      const [a, b, movies, anime, animeTrend] = await Promise.all([
        get<{ sections: Section[] }>("/home"),
        optional<{ sections: Section[] }>("/tab/movie", { sections: [] }),
        optional<{ sections: Section[] }>("/movies", { sections: [] }),
        optional<{ sections: Section[] }>("/animation", { sections: [] }),
        optional<Section>("/anime", { section: "Anime", count: 0, movies: [] }),
      ]);
      return {
        sections: [
          ...a.sections,
          ...b.sections,
          ...movies.sections.map((s) => ({ ...s, section: "More Movies" })),
          ...anime.sections.map((s) => ({ ...s, section: "More Anime" })),
          ...animeCollections(a.sections, animeTrend.movies),
        ],
      };
    },
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    refetchOnWindowFocus: true,
  });
  const sec = data?.sections.find((s) => s.section === name);
  return (
    <div className="min-h-screen px-4 pb-24">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-2 bg-background px-2 py-3">
        <button onClick={() => router.history.back()} aria-label="Back"><ChevronLeft className="h-7 w-7" /></button>
        <h1 className="text-xl font-extrabold">{name}</h1>
      </header>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {data && !sec && <p className="text-muted-foreground">Nothing here.</p>}
      <div className="grid grid-cols-3 gap-2">{sec?.movies.map((m) => <Poster key={m.slug} item={m} />)}</div>
      <BottomNav />
    </div>
  );
}
