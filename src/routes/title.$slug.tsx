import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Settings2, ChevronRight, Circle, CircleCheck, Crown, Download, FolderDown, ListPlus, Play, Share2, Star, X } from "lucide-react";
import { downloads, history, myList } from "@/lib/library";
import { get, watchUrl, type Section } from "@/lib/api";
import { savedProgress, saveProgress, stablePlaybackTitle } from "@/lib/playback";
import { Poster } from "@/components/Poster";
import { looksLikeAnime, relatedAnime } from "@/lib/recommendations";

type Dub = { subjectId: string; lanName: string; detailPath: string };
type Detail = {
  metadata: {
    id: string; title: string; description: string; release_date: string; genre: string;
    country: string; imdb_rating?: string; poster: string; duration: number | string; dubs: Dub[];
    top_cast: { name: string; character: string; avatarUrl: string }[];
  };
};
type Episodes = { subject_id: string; total_seasons: number; seasons: { season: number; episode_count: number }[] };

export const Route = createFileRoute("/title/$slug")({
  head: () => ({
    meta: [
      { title: "Watch — ZenoPlayer" },
      { name: "description", content: "Watch this title in HD on ZenoPlayer." },
      { property: "og:title", content: "Watch on ZenoPlayer" },
      { property: "og:description", content: "Watch this title in HD on ZenoPlayer." },
    ],
  }),
  component: TitlePage,
});

const RES = [0, 1080, 720, 480, 360];

function TitlePage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["detail", slug], queryFn: () => get<Detail>(`/detail/${slug}`) });
  const { data: eps } = useQuery({ queryKey: ["eps", slug], queryFn: () => get<Episodes>(`/episodes/${slug}`) });
  const isSeries = (eps?.total_seasons ?? 0) > 0;
  const [se, setSe] = useState(1);
  const [ep, setEp] = useState(1);
  const [res, setRes] = useState(0);
  const [playing, setPlaying] = useState(true);
  const player = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [browseSe, setBrowseSe] = useState(1);
  const [inList, setInList] = useState(false);
  const [pick, setPick] = useState<null | "lang" | "season" | "quality">(null);
  const video = useRef<HTMLVideoElement>(null);
  const router = useRouter();
  const { data: home } = useQuery({ queryKey: ["home"], queryFn: () => get<{ sections: Section[] }>("/home"), staleTime: 5 * 60_000, refetchInterval: 10 * 60_000, refetchOnWindowFocus: true });
  const { data: animeFeed } = useQuery({ queryKey: ["anime-trending"], queryFn: () => get<Section>("/anime"), staleTime: 5 * 60_000, refetchInterval: 10 * 60_000 });

  useEffect(() => { setPlaying(true); setPicked([]); setInList(myList.has(slug)); }, [slug]);
  useEffect(() => { if (data?.metadata) history.add({ name: data.metadata.title, poster_url: data.metadata.poster, slug }); }, [data, slug]);
  useEffect(() => {
    if (!data?.metadata?.title || !eps) return;
    const raw = sessionStorage.getItem("zenoplayer-selection");
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { title?: string; season?: number; episode?: number };
      if (saved.title === stablePlaybackTitle(data.metadata.title)) {
        const nextSeason = eps.seasons.find((s) => s.season === saved.season) ?? eps.seasons[0];
        if (nextSeason) {
          setSe(nextSeason.season);
          setBrowseSe(nextSeason.season);
          setEp(Math.min(saved.episode ?? 1, nextSeason.episode_count));
        }
      }
    } catch { /* ignore malformed session state */ }
    sessionStorage.removeItem("zenoplayer-selection");
  }, [data?.metadata?.title, eps]);
  useEffect(() => {
    if (eps?.seasons.length && !eps.seasons.some((s) => s.season === browseSe)) setBrowseSe(eps.seasons[0]!.season);
  }, [eps, browseSe]);

  if (isLoading || !data) return (<div className="min-h-screen"><div className="aspect-video w-full animate-pulse bg-card" /></div>);
  const m = data.metadata;
  const id = m.id;
  const src = watchUrl(id, slug, isSeries ? se : 0, isSeries ? ep : 0, res);
  const season = eps?.seasons.find((s) => s.season === se);
  const browseSeason = eps?.seasons.find((s) => s.season === browseSe);
  const isAnimeTitle = looksLikeAnime({ name: m.title, slug, genre: m.genre }, m.genre);
  const forYou = isAnimeTitle
    ? relatedAnime(home?.sections ?? [], animeFeed?.movies ?? [], slug, m.title, m.genre)
    : (home?.sections ?? []).filter((x) => x.section !== "Banner").flatMap((x) => x.movies).filter((x) => x.slug !== slug).slice(0, 12);

  const item = { name: m.title, poster_url: m.poster, slug };
  const badge = (m as { badge?: string }).badge;
  const curDub = m.dubs?.find((d) => d.detailPath === slug) ?? (badge ? m.dubs?.find((d) => d.lanName.toLowerCase().startsWith(badge.toLowerCase())) : undefined);
  const curLang = curDub?.lanName ?? (badge ? `${badge} dub` : "Original Audio");
  const playbackTitle = m.title;
  const playbackSeason = isSeries ? se : 0;
  const playbackEpisode = isSeries ? ep : 0;
  const startPlayback = (element: HTMLVideoElement) => {
    element.play().catch(() => {
      // Browsers may block audible autoplay until the first user gesture.
      // The native controls remain available without forcing a second app tap.
    });
  };
  const rememberProgress = () => {
    const current = video.current?.currentTime;
    if (Number.isFinite(current) && current !== undefined) saveProgress(playbackTitle, playbackSeason, playbackEpisode, current);
    sessionStorage.setItem("zenoplayer-selection", JSON.stringify({ title: stablePlaybackTitle(playbackTitle), season: se, episode: ep }));
  };
  const PRIO = ["original", "hindi", "tamil", "telugu", "bengali", "malayalam", "kannada", "english"];
  const rank = (n: string) => { const i = PRIO.findIndex((p) => n.toLowerCase().startsWith(p)); return (i < 0 ? 99 : i) + (n.includes("sub") ? 0.5 : 0); };
  const langs = [...(m.dubs ?? [])].sort((x, y) => rank(x.lanName) - rank(y.lanName));
  const startDownload = () => {
    const list = isSeries ? (picked.length ? picked : [browseSe === se ? ep : 1]) : [0];
    list.forEach((e, k) => {
      const a = document.createElement("a");
      a.href = watchUrl(id, slug, isSeries ? browseSe : 0, isSeries ? e : 0, res).replace("/watch/", "/download/");
      setTimeout(() => a.click(), k * 800);
    });
    downloads.add({ ...item, note: isSeries ? `S${browseSe} · ${list.length} episode${list.length > 1 ? "s" : ""}` : `${res || "Best"}p` });
    setSheet(false);
  };
  const play = (s?: number, e?: number) => {
    rememberProgress();
    if (s) { setSe(s); setBrowseSe(s); }
    if (e) setEp(e);
    setPlaying(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const share = () => {
    if (navigator.share) navigator.share({ title: m.title, url: location.href }).catch(() => {});
    else navigator.clipboard?.writeText(location.href);
  };

  return (
    <div className="min-h-screen pb-24">
      <div ref={player} className="sticky top-0 z-30 bg-background">
        <div className="relative aspect-video w-full overflow-hidden bg-card">
          {playing ? (
            <video ref={video} key={src} src={src} controls autoPlay playsInline preload="auto" controlsList="nodownload noremoteplayback" disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()} className="h-full w-full bg-background"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                const resume = savedProgress(playbackTitle, playbackSeason, playbackEpisode);
                if (resume > 0 && Number.isFinite(v.duration) && resume < v.duration - 2) v.currentTime = resume;
                v.playbackRate = 1;
                startPlayback(v);
              }}
              onCanPlay={(e) => startPlayback(e.currentTarget)}
              onTimeUpdate={(e) => saveProgress(playbackTitle, playbackSeason, playbackEpisode, e.currentTarget.currentTime)}
              onPause={(e) => saveProgress(playbackTitle, playbackSeason, playbackEpisode, e.currentTarget.currentTime)}
              onEnded={() => {
                saveProgress(playbackTitle, playbackSeason, playbackEpisode, 0);
                if (isSeries && season && ep < season.episode_count) {
                  setEp((current) => current + 1);
                  setPlaying(true);
                }
              }} />
          ) : (
            <button onClick={() => play()} className="group absolute inset-0" aria-label="Play">
              <img src={m.poster} alt={m.title} className="h-full w-full object-cover opacity-60" />
              <span className="play-fab absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2"><Play className="h-7 w-7 fill-current" /></span>
            </button>
          )}
          <button onClick={() => router.history.back()} aria-label="Back" className="absolute left-2 top-2 rounded-full p-1.5 text-foreground">
            <ChevronLeft className="h-7 w-7" />
          </button>
        </div>
        {playing && (
          <div className="no-scrollbar flex items-center gap-4 overflow-x-auto border-b px-4 py-2 text-sm text-muted-foreground">
            <button onClick={() => { rememberProgress(); setPick("quality"); }} className="flex shrink-0 items-center gap-1 font-bold text-foreground"><Settings2 className="h-5 w-5" />{res ? `${res}P` : "Best"}</button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-baseline gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-extrabold leading-tight">{m.title}</h1>
          <button onClick={() => setInfo((v) => !v)} className="flex shrink-0 items-center text-sm text-muted-foreground">Info <ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {m.imdb_rating && <span className="flex items-center gap-1 text-star"><Star className="h-4 w-4 fill-current" />{m.imdb_rating}</span>}
          <span>{m.release_date?.slice(0, 4)}</span><span>|</span>
          <span>{m.country}</span><span>|</span>
          <span>{m.genre?.split(",")[0]}</span>
          {isSeries && <><span>|</span><span>{eps?.total_seasons} seasons</span></>}
        </div>


        <div className="mt-4 grid grid-cols-4 gap-2 [&>*]:!flex-col [&>*]:!gap-1 [&>*]:!px-1 [&>*]:!py-2.5 [&>*]:!text-xs [&>*]:text-center">
          <button onClick={() => { myList.toggle(item); setInList(myList.has(slug)); }} className="btn-ghost">
            {inList ? <Check className="h-4 w-4 text-primary" /> : <ListPlus className="h-4 w-4" />}{inList ? "In my list" : "Add to list"}
          </button>
          <button onClick={share} className="btn-ghost"><Share2 className="h-4 w-4" />Share</button>
          <button onClick={() => setSheet(true)} className="btn-ghost"><Download className="h-4 w-4" />Download</button>
          <Link to="/downloads" className="btn-ghost"><FolderDown className="h-4 w-4" />Downloads</Link>
        </div>

        <div className="mt-6 flex items-baseline gap-2">
          <h2 className="text-lg font-extrabold">Resources</h2>
          <span className="text-sm text-muted-foreground">Choose language & episode</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setPick("lang")} className="chip gap-2">{curLang}<ChevronDown className="h-4 w-4" /></button>
          {isSeries && eps && (
            <button onClick={() => setPick("season")} className="chip gap-2">Season {String(browseSe).padStart(2, "0")}<ChevronDown className="h-4 w-4" /></button>
          )}
        </div>
        {isSeries && (
          <div className="mt-3 grid grid-cols-6 gap-2 [&>*]:!w-auto [&>*]:!min-w-0">
            {Array.from({ length: browseSeason?.episode_count ?? 0 }, (_, k) => k + 1).map((e) => (
              <button key={e} onClick={() => play(browseSe, e)} className={browseSe === se && e === ep ? "ep ep-on" : "ep"}>{String(e).padStart(2, "0")}</button>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-6 border-b">
          <span className="border-b-4 border-foreground pb-2 text-lg font-extrabold">For you</span>
          <button onClick={() => setInfo(true)} className="pb-2 text-lg text-muted-foreground">Cast</button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {forYou.map((x) => <Poster key={x.slug} item={x} />)}
        </div>
      </div>

      {pick && (
        <div className="sheet fixed inset-x-0 bottom-0 top-[56vw] z-50 overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <h2 className="text-xl font-extrabold">
              {pick === "lang" ? "Select language" : pick === "season" ? `${eps?.seasons.length ?? 0} seasons` : "Select quality"}
            </h2>
            <button onClick={() => setPick(null)} aria-label="Close"><X className="h-6 w-6" /></button>
          </div>
          <div className="space-y-3 p-4">
            {pick === "lang" && (langs.length ? langs : [{ subjectId: "o", lanName: curLang, detailPath: slug }]).map((d) => (
              <Link key={d.subjectId} to="/title/$slug" params={{ slug: d.detailPath }} onClick={() => { rememberProgress(); setPick(null); }}
                className={`block rounded-lg py-3.5 text-center ${d.subjectId === curDub?.subjectId || d.detailPath === slug ? "chip-on" : "bg-secondary text-muted-foreground"}`}>{d.lanName}</Link>
            ))}
            {pick === "season" && eps?.seasons.map((x) => (
              <button key={x.season} onClick={() => { setBrowseSe(x.season); setPick(null); }}
                className={`block w-full rounded-lg py-3.5 text-center ${x.season === browseSe ? "chip-on" : "bg-secondary text-muted-foreground"}`}>Season {String(x.season).padStart(2, "0")}</button>
            ))}
            {pick === "quality" && RES.filter(Boolean).map((r) => (
              <button key={r} onClick={() => { rememberProgress(); setRes(r); setPick(null); }}
                className={`block w-full rounded-lg py-3.5 text-center ${r === res ? "chip-on" : "bg-secondary text-muted-foreground"}`}>{r}P</button>
            ))}
          </div>
        </div>
      )}

      {sheet && (
        <div className="sheet fixed inset-x-0 bottom-0 top-[56vw] z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-4">
            <h2 className="text-xl font-extrabold">Download</h2>
            <button onClick={() => setSheet(false)} aria-label="Close"><X className="h-6 w-6" /></button>
          </div>
          <div className="mx-4 rounded-lg bg-card p-4">
            <p className="font-extrabold">Resources <span className="text-sm font-normal text-muted-foreground">Choose quality</span></p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {RES.filter(Boolean).reverse().map((r) => (
                <button key={r} onClick={() => setRes(r)} className={r === res ? "ep ep-on gap-1" : "ep gap-1"}>
                  <span className="flex items-center gap-1">{r >= 720 && <Crown className="h-3.5 w-3.5 text-premium" />}{r}P</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex-1 overflow-y-auto px-4">
            {isSeries ? (
              Array.from({ length: browseSeason?.episode_count ?? 0 }, (_, k) => k + 1).map((e) => {
                const on = picked.includes(e);
                return (
                  <button key={e} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== e) : [...p, e]))} className="flex w-full items-center gap-4 py-3.5 text-left">
                    {on ? <CircleCheck className="h-6 w-6 text-primary" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
                    <span className="text-base">E{String(e).padStart(2, "0")}</span>
                  </button>
                );
              })
            ) : (
              <p className="py-6 text-sm text-muted-foreground">Movie · {res}p</p>
            )}
          </div>
          <div className="flex items-center gap-3 border-t px-4 py-3">
            {isSeries && (
              <button
                onClick={() => setPicked((p) => (p.length === (browseSeason?.episode_count ?? 0) ? [] : Array.from({ length: browseSeason?.episode_count ?? 0 }, (_, k) => k + 1)))}
                className="flex items-center gap-2"
              >
                {picked.length && picked.length === browseSeason?.episode_count ? <CircleCheck className="h-6 w-6 text-primary" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
                Select All
              </button>
            )}
            <button onClick={startDownload} className="btn-primary ml-auto flex-1 justify-center rounded-lg py-3">
              <Download className="h-5 w-5" /> Download{picked.length > 1 ? ` (${picked.length})` : ""}
            </button>
          </div>
        </div>
      )}

      {info && (
        <div className="sheet fixed inset-x-0 bottom-0 top-[56vw] z-50 overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <h2 className="text-xl font-extrabold">More details</h2>
            <button onClick={() => setInfo(false)} aria-label="Close"><X className="h-6 w-6" /></button>
          </div>
          <div className="px-4 pb-10">
            <div className="mt-4 flex gap-3">
              <img src={m.poster} alt="" className="h-24 w-16 rounded object-cover" />
              <div>
                <p className="text-lg font-extrabold">{m.title}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                  {m.imdb_rating && <span className="flex items-center gap-1 text-star"><Star className="h-4 w-4 fill-current" />{m.imdb_rating}</span>}
                  <span>{m.release_date?.slice(0, 4)}</span><span>{m.country}</span><span>{m.genre}</span>
                </p>
              </div>
            </div>
            <h3 className="mt-6 text-lg font-extrabold">Info</h3>
            <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
            {m.top_cast?.length > 0 && (
              <>
                <h3 className="mt-6 text-lg font-extrabold">Starring ({m.top_cast.length})</h3>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {m.top_cast.map((c, k) => (
                    <div key={k}>
                      <div className="aspect-[3/4] overflow-hidden rounded bg-card">
                        {c.avatarUrl && <img src={c.avatarUrl} alt={c.name} className="h-full w-full object-cover" loading="lazy" />}
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs">{c.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{c.character}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button onClick={() => setSheet(true)} className="btn-primary fixed bottom-6 left-1/2 z-40 -translate-x-1/2 px-8 py-3 text-lg">
        <Download className="h-5 w-5" /> Download
      </button>
    </div>
  );
}
