import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, Clock, FolderDown, Play, UserRound, Code2, Copy, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { history, myList, type Saved } from "@/lib/library";
import { readSession, type Session } from "@/lib/auth";
import { stablePlaybackTitle, watchProgress, type WatchProgress } from "@/lib/playback";

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [{ title: "My List — ZenoPlayer" }, { name: "description", content: "Your anime list, watch history, and episode tracker on ZenoPlayer." }] }),
  component: Page,
});

function Page() {
  const [hist, setHist] = useState<Saved[]>([]);
  const [savedList, setSavedList] = useState<Saved[]>([]);
  const [watched, setWatched] = useState<WatchProgress[]>([]);
  const [session, setSession] = useState<Session>({ mode: "guest", name: "Guest" });
  const [apiOpen, setApiOpen] = useState(false);

  useEffect(() => {
    setHist(history.list());
    setSavedList(myList.list());
    setWatched(watchProgress());
    setSession(readSession());
  }, []);

  const trackedEpisodes = watched.length;
  const completed = watched.filter((entry) => entry.finished).length;
  const inProgress = watched.filter((entry) => !entry.finished).length;
  const titleItems = [...savedList, ...hist.filter((entry) => !savedList.some((saved) => saved.slug === entry.slug))];

  return (
    <div className="app-page">
      <Header />
      <main className="app-content space-y-4">
        <section className="profile-route-hero">
          <div className="profile-route-top">
            <div className="tracker-avatar"><UserRound className="h-7 w-7" /></div>
            <div>
              <p className="page-kicker">YOUR TRACKER</p>
              <h1 className="profile-route-name">{session.name}</h1>
              <span className="profile-session-badge">{session.mode === "guest" ? "GUEST PROFILE" : session.email ?? "ACCOUNT"}</span>
            </div>
            <button type="button" onClick={() => setApiOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><Code2 className="h-4 w-4" /> API</button>
            <Link to="/login" className="btn-primary px-4 py-2 text-xs">{session.mode === "guest" ? "Connect" : "Switch"}</Link>
          </div>
          <p className="profile-route-note">{session.mode === "guest" ? "Your list and watch progress are saved locally on this device." : "Your anime tracker is ready whenever you are."}</p>
        </section>

        {session.mode === "guest" && (
          <Link to="/login" className="route-panel flex items-center gap-3 border-primary/20 bg-primary/5">
            <div className="min-w-0 flex-1"><p className="font-bold">Keep your tracker connected</p><p className="mt-1 text-xs text-muted-foreground">Create an account to keep your list together on this device.</p></div>
            <ArrowRight className="h-5 w-5 shrink-0 text-primary" />
          </Link>
        )}

        <div className="route-stat-grid">
          <div className="route-stat-card"><strong>{savedList.length}</strong><span>On your list</span></div>
          <div className="route-stat-card"><strong>{inProgress}</strong><span>In progress</span></div>
          <div className="route-stat-card"><strong>{completed}</strong><span>Completed</span></div>
        </div>

        <section className="route-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="page-kicker">YOUR COLLECTION</p><h2 className="font-display text-xl font-extrabold">My List <span className="text-sm text-muted-foreground">{savedList.length}</span></h2></div>
            <Link to="/anime-library" className="section-link">Add anime <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {savedList.length ? (
            <div className="profile-anime-grid">
              {savedList.map((item) => (
                <Link key={item.slug} to="/title/$slug" params={{ slug: item.slug }} className="profile-anime-card">
                  <img src={item.poster_url} alt={item.name} loading="lazy" />
                  <p>{item.name}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state"><Bookmark className="h-7 w-7" /><p className="font-bold text-foreground">Your list is empty</p><p className="text-xs">Open any title and tap “Add to list” to track it here.</p><Link to="/anime-library" className="btn-primary mt-1 px-4 py-2 text-xs">Browse anime</Link></div>
          )}
        </section>

        <section className="route-panel">
          <div className="mb-2 flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><div><p className="page-kicker">PICK UP AGAIN</p><h2 className="font-display text-lg font-extrabold">Watch history</h2></div></div>
          {hist.length ? hist.slice(0, 8).map((item) => (
            <Link key={item.slug} to="/title/$slug" params={{ slug: item.slug }} className="profile-history-item">
              <div className="profile-history-poster"><img src={item.poster_url} alt="" loading="lazy" /></div>
              <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-bold">{item.name}</p><p className="text-xs text-muted-foreground">Opened recently</p></div>
              <Play className="h-4 w-4 fill-current text-primary" />
            </Link>
          )) : <div className="empty-state mt-3"><Clock className="h-6 w-6" /><p className="text-sm">Your watch history will show up here.</p></div>}
        </section>

        <section className="route-panel">
          <div className="mb-2 flex items-center gap-2"><Play className="h-5 w-5 fill-current text-primary" /><div><p className="page-kicker">EPISODE PROGRESS</p><h2 className="font-display text-lg font-extrabold">Watching</h2></div></div>
          {watched.length ? watched.slice(0, 10).map((entry) => {
            const item = titleItems.find((saved) => stablePlaybackTitle(saved.name) === entry.title);
            if (!item) return null;
            return (
              <Link key={`${entry.title}-${entry.season}-${entry.episode}`} to="/title/$slug" params={{ slug: item.slug }} className="profile-progress-row">
                <div className="profile-progress-poster"><img src={item.poster_url} alt="" loading="lazy" /></div>
                <div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-bold">{item.name}</p><p className="text-xs text-muted-foreground">S{String(entry.season).padStart(2, "0")} · E{String(entry.episode).padStart(2, "0")} · {entry.finished ? "Finished" : "In progress"}</p></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          }) : <p className="py-3 text-sm text-muted-foreground">No episodes tracked yet. Start a title to save your progress.</p>}
          {trackedEpisodes > 10 && <p className="mt-2 text-xs text-muted-foreground">Showing your 10 most recently updated episodes.</p>}
        </section>

        <Link to="/downloads" className="route-panel flex items-center gap-3">
          <FolderDown className="h-5 w-5 text-primary" /><span className="flex-1 font-bold">Downloads</span><ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </main>
      {apiOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setApiOpen(false)}>
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div><p className="page-kicker">DEVELOPER ACCESS</p><h2 className="text-xl font-extrabold">ZenoPlayer API</h2></div>
              <button onClick={() => setApiOpen(false)} className="rounded-full p-2 text-muted-foreground" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">Use these endpoints in your bot, website or app. No API key is currently required. Requests are read-only catalogue/stream requests.</p>
            <div className="mb-4 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">BASE URL</p>
              <code className="break-all text-sm">https://zenoplayer.vercel.app/api/public/mb</code>
              <button className="mt-2 flex items-center gap-1 text-xs text-primary" onClick={() => navigator.clipboard?.writeText("https://zenoplayer.vercel.app/api/public/mb")}><Copy className="h-3.5 w-3.5" /> Copy base URL</button>
            </div>
            <div className="mb-4 rounded-xl border border-border p-3">
              <p className="mb-2 font-bold">Endpoints</p>
              <div className="space-y-2 text-xs">
                {[
                  ["GET","/home","Home feed & sections"],["GET","/home/sections","Section names"],["GET","/home/banner","Banners"],["GET","/home/trending","Trending"],["GET","/home/hot","Hot titles"],["GET","/home/cinema","Cinema section"],["GET","/home/section/{name}","Section by name"],
                  ["GET","/anime","Anime trending"],["GET","/curated-anime","Curated anime list"],["GET","/movies","Movie catalogue"],["GET","/movies/sections","Movie section names"],["GET","/movies/section/{name}","Movie section"],["GET","/tv-series","TV catalogue"],["GET","/tv-series/sections","TV section names"],["GET","/tv-series/section/{name}","TV section"],["GET","/animation","Animation catalogue"],["GET","/animation/sections","Animation section names"],["GET","/animation/section/{name}","Animation section"],["GET","/ranking","Rankings"],["GET","/ranking/sections","Ranking section names"],["GET","/ranking/section/{name}","Ranking section"],["GET","/search?q={query}","Search titles"],["GET","/search/suggest?q={query}","Search suggestions"],["GET","/detail/{slug}","Title metadata"],["GET","/episodes/{slug}","Seasons & episodes"],["GET","/api/stream/{subject_id}?detail_path={slug}&se=1&ep=1","Stream links JSON"],["GET","/watch/{subject_id}?detail_path={slug}&se=1&ep=1&resolution=480","Video stream proxy"],["GET","/download/{subject_id}?detail_path={slug}&se=1&ep=1&resolution=480","Download stream"]
                ].map(([method,path,desc]) => <div className="flex flex-wrap items-start gap-2 border-b border-border/60 pb-2 last:border-0"><span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-500">{method}</span><code className="break-all text-foreground">{path}</code><span className="text-muted-foreground">{desc}</span></div>)}
              </div>
            </div>
            <div className="mb-4 rounded-xl border border-border p-3">
              <p className="mb-1 font-bold">Example</p>
              <code className="block break-all text-xs">https://zenoplayer.vercel.app/api/public/mb/search?q=Blue%20Box</code>
              <button className="mt-2 flex items-center gap-1 text-xs text-primary" onClick={() => navigator.clipboard?.writeText("https://zenoplayer.vercel.app/api/public/mb/search?q=Blue%20Box")}><Copy className="h-3.5 w-3.5" /> Copy example</button>
            </div>
            <p className="text-xs text-muted-foreground">When a custom domain is connected, the same API path will work on it too (for example, your custom domain + /api/public/mb). Please use reasonable request rates; endpoint availability may change.</p>
          </section>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
