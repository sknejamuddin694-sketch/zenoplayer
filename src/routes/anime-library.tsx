import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { ArrowUpRight, Check, ExternalLink, Plus, Search } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { get, type Item } from "@/lib/api";
import { myList } from "@/lib/library";
import animeData from "@/data/imdb-anime.json";

type AnimeItem = { rank: number; title: string; imdbId: string };
const items = animeData.items as AnimeItem[];
const PAGE_SIZE = 48;

export const Route = createFileRoute("/anime-library")({
  head: () => ({ meta: [{ title: "Community anime picks — ZenoPlayer" }, { name: "description", content: "Explore an IMDb community-sourced anime list and add titles to your ZenoPlayer tracker." }] }),
  component: AnimeLibrary,
});

function AnimeLibrary() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Record<string, Item | null>>({});
  const [tracked, setTracked] = useState<Set<string>>(() => new Set());
  const [checking, setChecking] = useState(false);
  const requested = useRef(new Set<string>());
  const filtered = useMemo(() => items.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => setTracked(new Set(myList.list().map((item) => item.slug))), []);

  useEffect(() => {
    const pending = visible.filter((item) => !requested.current.has(item.imdbId));
    if (!pending.length) { setChecking(false); return; }
    pending.forEach((item) => requested.current.add(item.imdbId));
    setChecking(true);
    (async () => {
      const next: Record<string, Item | null> = {};
      for (let index = 0; index < pending.length; index += 8) {
        const batch = await Promise.all(pending.slice(index, index + 8).map(async (item) => {
          try {
            const result = await get<{ movies: Item[] }>(`/search?q=${encodeURIComponent(item.title)}`);
            const wanted = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            const exact = result.movies.find((movie) => movie.name.toLowerCase().replace(/\[[^\]]+\]/g, "").replace(/[^a-z0-9]+/g, " ").trim().includes(wanted.split(" ").slice(0, 3).join(" ")));
            return [item.imdbId, exact ?? result.movies[0] ?? null] as const;
          } catch { return [item.imdbId, null] as const; }
        }));
        batch.forEach(([id, match]) => { next[id] = match; });
        setMatches((current) => ({ ...current, ...next }));
      }
      setChecking(false);
    })();
  }, [visible]);

  return (
    <div className="app-page">
      <Header />
      <main className="app-content">
        <section className="community-banner">
          <div>
            <p className="page-kicker">COMMUNITY-SOURCED LIST</p>
            <h1 className="page-heading">Anime community picks</h1>
            <p>Explore titles from an IMDb community list. Add anything you find to your private tracker.</p>
          </div>
          <div className="community-total"><strong>{animeData.total}</strong><span>titles</span></div>
        </section>

        <label className="field-focus mt-4 flex items-center gap-3 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Filter community picks" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Showing {visible.length} of {filtered.length} titles</span>
          {checking && <span className="text-primary">Checking availability…</span>}
        </div>

        <div className="community-grid mt-3">
          {visible.map((item) => {
            const match = matches[item.imdbId];
            const checked = item.imdbId in matches;
            return (
              <article key={item.imdbId} className="community-title-card">
                <div className="community-title-art">
                  {match?.poster_url ? <img src={match.poster_url} alt={item.title} loading="lazy" /> : <span className="community-rank-big">#{item.rank}</span>}
                  <span className="community-rank">#{item.rank}</span>
                </div>
                <div className="community-title-copy">
                  <h2>{match ? <Link to="/title/$slug" params={{ slug: match.slug }}>{item.title}</Link> : item.title}</h2>
                  <p className={match ? "text-premium" : checked ? "text-muted-foreground" : "text-primary"}>{match ? "Available to watch" : checked ? "Not available right now" : "Checking availability"}</p>
                  <div className="community-actions">
                    {match ? <button type="button" aria-pressed={tracked.has(match.slug)} onClick={() => { const alreadyTracked = tracked.has(match.slug); myList.toggle(match); setTracked((current) => { const next = new Set(current); if (alreadyTracked) next.delete(match.slug); else next.add(match.slug); return next; }); }} className={tracked.has(match.slug) ? "btn-ghost" : "btn-primary"}>{tracked.has(match.slug) ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{tracked.has(match.slug) ? "Saved" : "Track"}</button> : <Link to="/search" search={{ q: item.title }} className="btn-ghost"><Search className="h-3.5 w-3.5" />Search</Link>}
                    <a href={`https://www.imdb.com/title/${item.imdbId}/`} target="_blank" rel="noreferrer" className="community-imdb" aria-label={`Open ${item.title} on IMDb`}><ExternalLink className="h-4 w-4" /></a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {visible.length < filtered.length && <button onClick={() => setPage((value) => value + 1)} className="btn-primary mx-auto mt-6 flex">Load more anime <ArrowUpRight className="h-4 w-4" /></button>}
        {!filtered.length && <div className="empty-state mt-5"><Search className="h-7 w-7" /><p className="font-bold text-foreground">No titles match that filter</p></div>}
        <p className="mt-7 text-center text-xs text-muted-foreground">Community-list source: <a className="text-primary underline" href={animeData.source} target="_blank" rel="noreferrer">IMDb</a>. Playback is provided through ZenoPlayer; list and progress stay local to your device.</p>
      </main>
      <BottomNav />
    </div>
  );
}
