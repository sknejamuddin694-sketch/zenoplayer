import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Play, RefreshCw, Send } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Poster } from "@/components/Poster";
import { get, type Section } from "@/lib/api";
import { downloads, type Saved } from "@/lib/library";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — ZenoPlayer" },
      { name: "description", content: "Your downloaded movies and series on ZenoPlayer." },
      { property: "og:title", content: "Downloads — ZenoPlayer" },
      { property: "og:description", content: "Your downloaded movies and series on ZenoPlayer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const TABS = ["ZenoPlayer", "Local files", "Received"];

function Page() {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<Saved[]>([]);
  const [seed, setSeed] = useState(0);
  useEffect(() => setItems(downloads.list()), []);
  const { data } = useQuery({ queryKey: ["home"], queryFn: () => get<{ sections: Section[] }>("/home"), staleTime: 5 * 60_000 });
  const pool = (data?.sections ?? []).filter((s) => s.section !== "Banner").flatMap((s) => s.movies);
  const forYou = pool.slice((seed * 6) % Math.max(pool.length, 1)).slice(0, 6);
  const shown = tab === 0 ? items : [];

  return (
    <div className="min-h-screen pb-24">
      <header className="flex items-center justify-between border-b px-4 py-4">
        <h1 className="font-display text-2xl font-bold">Downloads</h1>
        <button className="btn-ghost text-primary"><Send className="h-4 w-4" />Transfer</button>
      </header>
      <div className="px-4">
        <div className="mt-4 flex items-baseline justify-between">
          <h2 className="text-xl font-extrabold">Downloaded</h2>
          <span className="text-sm text-muted-foreground">{items.length} saved</span>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {TABS.map((t, k) => (
            <button key={t} onClick={() => setTab(k)} className={k === tab ? "pill pill-on" : "pill"}>{t}</button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No downloads yet.</p>}
          {shown.map((d) => (
            <Link key={d.slug} to="/title/$slug" params={{ slug: d.slug }} className="flex items-center gap-3">
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-card">
                <img src={d.poster_url} alt="" className="h-full w-full object-cover" />
                <Play className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 fill-current" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 font-semibold">{d.name}</p>
                <p className="text-sm text-muted-foreground">{d.note ?? "Downloaded"}</p>
              </div>
            </Link>
          ))}
        </div>
        <h2 className="mt-6 text-xl font-extrabold">For You</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {forYou.map((m) => <Poster key={m.slug} item={m} />)}
        </div>
        <button onClick={() => setSeed((s) => s + 1)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-card py-3.5 text-muted-foreground">
          <RefreshCw className="h-5 w-5" /> Refresh new content
        </button>
      </div>
      <BottomNav />
    </div>
  );
}
