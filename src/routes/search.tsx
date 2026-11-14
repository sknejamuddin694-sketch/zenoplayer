import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles } from "lucide-react";
import { get, RateLimitError, type Item } from "@/lib/api";
import { Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({ q: String(search["q"] ?? "") }),
  head: () => ({ meta: [{ title: "Search anime — ZenoPlayer" }, { name: "description", content: "Find anime and titles to add to your ZenoPlayer tracker." }] }),
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
    <div className="app-page">
      <Header initialQuery={q} />
      <main className="app-content">
        <p className="page-kicker">DISCOVER SOMETHING NEW</p>
        <h1 className="page-heading">{q ? "Search results" : "Find your next favorite"}</h1>
        {q && <p className="mb-4 text-sm text-muted-foreground">Matches for <span className="font-bold text-foreground">“{q}”</span>{data ? ` · ${data.movies.length} titles` : ""}</p>}
        {error && <p role="alert" className="route-panel text-sm text-muted-foreground">{error instanceof RateLimitError ? error.message : "Search is temporarily unavailable."}</p>}
        {isLoading && <div className="route-panel animate-pulse text-sm text-muted-foreground">Finding titles…</div>}
        {!q && <div className="empty-state mt-4"><SearchIcon className="h-7 w-7" /><p className="font-bold text-foreground">Search anime, movies, and series</p><p className="text-xs">Type in the search bar above to get started.</p></div>}
        {q && data && !data.movies.length && <div className="empty-state mt-5"><Sparkles className="h-7 w-7" /><p className="font-bold text-foreground">No titles found</p><p className="text-xs">Try another title or a shorter search.</p></div>}
        <div className="mt-5 grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 md:grid-cols-5">
          {data?.movies.map((item) => <Poster key={item.slug} item={item} />)}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
