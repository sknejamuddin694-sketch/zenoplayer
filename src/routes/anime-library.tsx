import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { ArrowLeft, ExternalLink, Search, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { get, type Item } from "@/lib/api";
import animeData from "@/data/imdb-anime.json";

type AnimeItem = { rank: number; title: string; imdbId: string };
const items = animeData.items as AnimeItem[];
const PAGE_SIZE = 48;

export const Route = createFileRoute("/anime-library")({
  head: () => ({ meta: [{ title: "Anime List — ZenoPlayer" }, { name: "description", content: "Browse the anime list and see which titles are available in ZenoPlayer right now." }] }),
  component: AnimeLibrary,
});

function AnimeLibrary() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Record<string, Item | null>>({});
  const [checking, setChecking] = useState(false);
  const requested = useRef(new Set<string>());
  const filtered = useMemo(() => items.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const visible = filtered.slice(0, page * PAGE_SIZE);
  useEffect(() => {
    let cancelled = false;
    const pending = visible.filter((item) => !(item.imdbId in matches) && !requested.current.has(item.imdbId));
    if (!pending.length) return;
    pending.forEach((item) => requested.current.add(item.imdbId));
    setChecking(true);
    (async () => {
      const next: Record<string, Item | null> = {};
      for (let i = 0; i < pending.length; i += 8) {
        const batch = await Promise.all(pending.slice(i, i + 8).map(async (item) => {
          try {
            const result = await get<{ movies: Item[] }>(`/search?q=${encodeURIComponent(item.title)}`);
            const wanted = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            const exact = result.movies.find((movie) => movie.name.toLowerCase().replace(/\[[^\]]+\]/g, "").replace(/[^a-z0-9]+/g, " ").trim().includes(wanted.split(" ").slice(0, 3).join(" ")));
            return [item.imdbId, exact ?? result.movies[0] ?? null] as const;
          } catch { return [item.imdbId, null] as const; }
        }));
        batch.forEach(([id, match]) => { next[id] = match; });
        if (!cancelled) setMatches((current) => ({ ...current, ...next }));
      }
      if (!cancelled) setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [visible, matches]);

  return (
    <div className="min-h-screen px-4 pb-24 pt-5">
      <header className="flex items-center gap-3">
        <Link to="/" search={{ tab: "anime" }} aria-label="Back to anime" className="rounded-full bg-secondary p-2"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">ZenoPlayer catalogue</p><h1 className="font-display text-2xl font-bold">Anime List</h1></div>
        <a href={animeData.source} target="_blank" rel="noreferrer" className="rounded-full bg-secondary p-2" aria-label="Open IMDb list"><ExternalLink className="h-5 w-5" /></a>
      </header>
      <div className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-purple-500/10 p-4">
        <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-bold">{animeData.total} anime titles</p><p className="mt-1 text-sm text-muted-foreground">Every title is checked against the live ZenoPlayer catalogue API. Available titles open directly in ZenoPlayer; unavailable titles stay visible and are marked.</p></div></div>
      </div>
      <label className="mt-4 flex items-center gap-2 rounded-xl border bg-card px-3 py-3"><Search className="h-5 w-5 text-muted-foreground" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Filter anime list" className="w-full bg-transparent outline-none" /></label>
      <p className="mt-5 text-sm text-muted-foreground">Showing {visible.length} of {filtered.length} titles</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {visible.map((item) => { const match = matches[item.imdbId]; return <article key={item.imdbId} className="flex min-h-36 flex-col justify-between rounded-xl border border-border bg-card p-3 shadow-sm"><div><span className="text-xs font-bold text-primary">#{item.rank}</span><h2 className="mt-2 line-clamp-3 text-sm font-bold leading-snug">{item.title}</h2><p className={`mt-2 text-xs font-semibold ${match ? "text-emerald-400" : item.imdbId in matches ? "text-muted-foreground" : "text-primary"}`}>{match ? "Available on ZenoPlayer" : item.imdbId in matches ? "Not available right now" : "Checking ZenoPlayer…"}</p></div><div className="mt-3 flex gap-2">{match ? <Link to="/title/$slug" params={{ slug: match.slug }} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-2 text-xs font-bold text-primary-foreground"><Search className="h-3.5 w-3.5" />Watch</Link> : <Link to="/search" search={{ q: item.title }} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-secondary px-2 py-2 text-xs font-bold text-muted-foreground"><Search className="h-3.5 w-3.5" />Search</Link>}<a href={`https://www.imdb.com/title/${item.imdbId}/`} target="_blank" rel="noreferrer" className="rounded-lg bg-secondary p-2" aria-label={`Open ${item.title} on IMDb`}><ExternalLink className="h-3.5 w-3.5" /></a></div></article>; })}
      </div>
      {visible.length < filtered.length && <button onClick={() => setPage((value) => value + 1)} className="btn-primary mx-auto mt-6 block rounded-xl">Load more anime</button>}
      {!filtered.length && <p className="mt-8 text-center text-muted-foreground">No anime matches that filter.</p>}
      <p className="mt-8 text-center text-xs text-muted-foreground">{checking ? "Checking visible titles in ZenoPlayer… " : ""}Titles and list attribution: <a className="text-primary underline" href={animeData.source} target="_blank" rel="noreferrer">IMDb community list</a>. Playback is always from ZenoPlayer.</p>
      <BottomNav />
    </div>
  );
}
