import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { get, type Item } from "@/lib/api";
import animeData from "@/data/imdb-anime.json";
import { Poster } from "@/components/Poster";

type CommunityItem = { rank: number; title: string; imdbId: string };
const items = animeData.items as CommunityItem[];
const PAGE_SIZE = 48;

export function CommunityAnimeShelf({ enabled }: { enabled: boolean }) {
  const [page, setPage] = useState(1);
  const [matches, setMatches] = useState<Record<string, Item | null>>({});
  const [checked, setChecked] = useState(0);
  const [checking, setChecking] = useState(false);
  const requested = useRef(new Set<string>());
  const visible = useMemo(() => items.slice(0, page * PAGE_SIZE), [page]);
  const available = visible.flatMap((item) => {
    const match = matches[item.imdbId];
    return match ? [match] : [];
  });

  useEffect(() => {
    if (!enabled) return;
    const pending = visible.filter((item) => !requested.current.has(item.imdbId));
    if (!pending.length) return;
    pending.forEach((item) => requested.current.add(item.imdbId));
    setChecking(true);

    void (async () => {
      for (let index = 0; index < pending.length; index += 8) {
        const batch = await Promise.all(pending.slice(index, index + 8).map(async (item) => {
          try {
            const result = await get<{ movies: Item[] }>(`/search?q=${encodeURIComponent(item.title)}`);
            const wanted = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
            const prefix = wanted.split(" ").slice(0, 3).join(" ");
            const match = result.movies?.find((movie) =>
              movie.name.toLowerCase().replace(/\[[^\]]+\]/g, "").replace(/[^a-z0-9]+/g, " ").trim().includes(prefix)
            ) ?? result.movies?.[0] ?? null;
            return [item.imdbId, match] as const;
          } catch {
            return [item.imdbId, null] as const;
          }
        }));
        setMatches((current) => {
          const next = { ...current };
          batch.forEach(([id, match]) => { next[id] = match; });
          return next;
        });
        setChecked((current) => current + batch.length);
      }
      setChecking(false);
    })();
  }, [enabled, visible]);

  if (!enabled) return null;

  return (
    <section className="poster-row">
      <div className="poster-row-heading">
        <div>
          <h2>Community anime · Watch now</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {checking ? `Checking community picks… ${checked}/${visible.length}` : `${available.length} available from ${visible.length} checked`}
          </p>
        </div>
        <Link to="/anime-library" className="section-link">See all <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
      {available.length > 0 ? (
        <div className="row-scroll">
          {available.map((item) => (
            <div key={item.slug} className="w-[32%] max-w-44 shrink-0">
              <Poster item={item} />
              <Link to="/title/$slug" params={{ slug: item.slug }} className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-primary">
                <Play className="h-3 w-3 fill-current" /> Watch now
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          {checking ? "Finding titles available to watch…" : "No available titles found in this batch."}
        </p>
      )}
      {page * PAGE_SIZE < items.length && (
        <button
          type="button"
          onClick={() => setPage((current) => current + 1)}
          disabled={checking}
          className="btn-ghost mx-auto mt-4 flex"
        >
          {checking ? "Checking…" : "Load more community anime"}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}
