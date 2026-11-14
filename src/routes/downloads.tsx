import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowUpRight, Play, RefreshCw, Send } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Poster } from "@/components/Poster";
import { get, type Section } from "@/lib/api";
import { downloads, type Saved } from "@/lib/library";

export const Route = createFileRoute("/downloads")({
  head: () => ({ meta: [{ title: "Downloads — ZenoPlayer" }, { name: "description", content: "Your saved downloads and anime recommendations on ZenoPlayer." }] }),
  component: Page,
});

const TABS = ["ZenoPlayer", "Local files", "Received"];

function Page() {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState<Saved[]>([]);
  const [seed, setSeed] = useState(0);
  useEffect(() => setItems(downloads.list()), []);
  const { data } = useQuery({ queryKey: ["home"], queryFn: () => get<{ sections: Section[] }>("/home"), staleTime: 5 * 60_000 });
  const pool = (data?.sections ?? []).filter((section) => section.section !== "Banner").flatMap((section) => section.movies);
  const forYou = pool.slice((seed * 6) % Math.max(pool.length, 1)).slice(0, 6);
  const shown = tab === 0 ? items : [];

  return (
    <div className="app-page">
      <Header />
      <main className="app-content">
        <p className="page-kicker">YOUR OFFLINE SHELF</p>
        <div className="flex items-start justify-between gap-3">
          <div><h1 className="page-heading">Downloads</h1><p className="-mt-2 text-sm text-muted-foreground">Saved titles on this device.</p></div>
          <button className="btn-ghost shrink-0 px-3 py-2 text-xs"><Send className="h-4 w-4" />Transfer</button>
        </div>

        <section className="route-panel mt-5">
          <div className="mb-3 flex items-center justify-between"><div><p className="page-kicker">LIBRARY</p><h2 className="font-display text-xl font-extrabold">Downloaded</h2></div><span className="week-pill">{items.length} SAVED</span></div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {TABS.map((label, index) => <button key={label} onClick={() => setTab(index)} className={index === tab ? "pill pill-on" : "pill"}>{label}</button>)}
          </div>
          <div className="mt-3 space-y-2">
            {shown.length === 0 && <div className="empty-state"><Play className="h-6 w-6 fill-current" /><p className="font-bold text-foreground">No downloads yet</p><p className="text-xs">Open a title and choose Download to save it here.</p></div>}
            {shown.map((item) => (
              <Link key={item.slug} to="/title/$slug" params={{ slug: item.slug }} className="profile-history-item">
                <div className="profile-history-poster"><img src={item.poster_url} alt="" loading="lazy" /></div>
                <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{item.note ?? "Downloaded"}</p></div>
                <Play className="h-4 w-4 fill-current text-primary" />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="poster-row-heading mb-2 px-0"><h2>For you</h2><span className="section-link">Fresh picks <ArrowUpRight className="h-4 w-4" /></span></div>
          <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
            {forYou.map((item) => <Poster key={item.slug} item={item} />)}
          </div>
          <button onClick={() => setSeed((value) => value + 1)} className="btn-ghost mt-4 w-full justify-center"><RefreshCw className="h-4 w-4" />Refresh recommendations</button>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
