import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { get, RateLimitError, type Item } from "@/lib/api";
import { Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: String(s["q"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Search — ZenoPlayer" },
      { name: "description", content: "Search movies and TV series on ZenoPlayer." },
      { property: "og:title", content: "Search — ZenoPlayer" },
      { property: "og:description", content: "Search movies and TV series on ZenoPlayer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q],
    queryFn: () => get<{ movies: Item[] }>(`/search?q=${encodeURIComponent(q)}`),
    enabled: !!q,
  });
  return (
    <div className="min-h-screen pb-24">
      <Header tabs active="" />
      <div className="px-4">
        <h1 className="mt-4 text-xl font-extrabold">Results for “{q}”</h1>
        {error && <p role="alert" className="mt-3 text-muted-foreground">{error instanceof RateLimitError ? error.message : "Search is temporarily unavailable."}</p>}
        {isLoading && <p className="mt-6 text-muted-foreground">Searching…</p>}
        {data && !data.movies.length && <p className="mt-6 text-muted-foreground">Nothing found.</p>}
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data?.movies.map((m) => <Poster key={m.slug} item={m} />)}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
