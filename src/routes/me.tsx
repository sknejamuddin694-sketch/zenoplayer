import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, Clock, FolderDown, Play, UserRound } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { history, myList, type Saved } from "@/lib/library";
import { readSession, type Session } from "@/lib/auth";
import { stablePlaybackTitle, watchProgress, type WatchProgress } from "@/lib/playback";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "Me — ZenoPlayer" },
      { name: "description", content: "Your account and watch history on ZenoPlayer." },
    ],
  }),
  component: Page,
});

function Page() {
  const [hist, setHist] = useState<Saved[]>([]);
  const [savedList, setSavedList] = useState<Saved[]>([]);
  const [watched, setWatched] = useState<WatchProgress[]>([]);
  const [count, setCount] = useState(0);
  const [session, setSession] = useState<Session>({ mode: "guest", name: "Guest" });
  useEffect(() => {
    setHist(history.list());
    setSavedList(myList.list());
    setCount(myList.list().length);
    setWatched(watchProgress());
    setSession(readSession());
  }, []);

  return (
    <div className="min-h-screen px-4 pb-24 pt-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary"><UserRound className="h-6 w-6" /></div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{session.name}</h1>
          <span className="mt-1 inline-block rounded bg-secondary px-3 py-1 text-sm text-muted-foreground">{session.mode === "guest" ? "Guest" : session.email}</span>
        </div>
        <Link to="/login" className="btn-primary rounded-lg px-4 py-2">{session.mode === "guest" ? "Log in" : "Switch"}</Link>
      </div>

      {session.mode === "guest" && <Link to="/login" className="mt-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
        <div className="flex-1"><p className="font-bold">Connect your Guest account</p><p className="mt-1 text-sm text-muted-foreground">Create an account and keep your history and list on this device.</p></div>
        <ArrowRight className="h-5 w-5 text-primary" />
      </Link>}

      <div className="list-card mt-5">
        <div className="flex items-center gap-3 px-4 pt-4"><Clock className="h-6 w-6 text-muted-foreground" /><span className="text-base font-semibold">Watch History</span></div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 pt-3">
          {hist.length === 0 && <p className="text-sm text-muted-foreground">Nothing watched yet.</p>}
          {hist.map((h) => <Link key={h.slug} to="/title/$slug" params={{ slug: h.slug }} className="w-32 shrink-0"><img src={h.poster_url} alt="" className="aspect-video w-full rounded object-cover" /><p className="mt-1 line-clamp-1 text-sm">{h.name}</p></Link>)}
        </div>
      </div>

      <div className="list-card mt-3">
        <div className="flex items-center gap-3 border-b px-4 py-4"><Bookmark className="h-6 w-6 text-muted-foreground" /><span className="flex-1 text-base font-semibold">My List</span><span className="text-muted-foreground">{count}</span></div>
        {savedList.length > 0 && <div className="grid grid-cols-3 gap-2 p-3">
          {savedList.map((item) => <Link key={item.slug} to="/title/$slug" params={{ slug: item.slug }}>
            <img src={item.poster_url} alt="" className="aspect-[2/3] w-full rounded object-cover" />
            <p className="mt-1 line-clamp-2 text-xs">{item.name}</p>
          </Link>)}
        </div>}
        {savedList.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">My List is empty.</p>}
        <div className="border-t px-4 pb-2 pt-4"><p className="font-semibold">Watched episodes</p><p className="mt-1 text-xs text-muted-foreground">Har dekha hua season aur episode yahan save rahega.</p></div>
        <div className="divide-y">
          {watched.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Abhi episode progress nahi hai.</p>}
          {watched.map((entry) => {
            const item = [...hist, ...savedList].find((saved) => stablePlaybackTitle(saved.name) === entry.title);
            if (!item) return null;
            return <Link key={`${entry.title}-${entry.season}-${entry.episode}`} to="/title/$slug" params={{ slug: item.slug }} className="flex items-center gap-3 px-4 py-3">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded bg-card"><img src={item.poster_url} alt="" className="h-full w-full object-cover" /><Play className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 fill-current" /></div>
              <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">S{String(entry.season).padStart(2, "0")} E{String(entry.episode).padStart(2, "0")} · {entry.finished ? "Finished" : "In progress"}</p></div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>;
          })}
        </div>
        <Link to="/downloads" className="flex items-center gap-3 px-4 py-4"><FolderDown className="h-6 w-6 text-muted-foreground" /><span className="flex-1 text-base font-semibold">Downloads</span><ArrowRight className="h-5 w-5 text-muted-foreground" /></Link>
      </div>
      <BottomNav />
    </div>
  );
}
