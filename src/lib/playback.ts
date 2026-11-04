export type Dub = { subjectId: string; lanName: string; detailPath: string };
export type Season = { season: number; episode_count: number };

// Providers include a season-zero resource for movies; it is not a TV season.
export function seriesSeasons(seasons: Season[] = []) {
  return seasons.filter((s) => s.season > 0 && s.episode_count > 0);
}

export function audioLanguages(dubs: Dub[] = [], id: string, slug: string, original?: string) {
  const valid = dubs.filter((d) => d.subjectId && d.detailPath && d.lanName);
  const options = valid.some((d) => d.subjectId === id)
    ? valid
    : [{ subjectId: id, detailPath: slug, lanName: original || "Original audio" }, ...valid];
  return options.filter((d, i) => options.findIndex((v) => v.subjectId === d.subjectId) === i);
}

export function stablePlaybackTitle(title: string) {
  return title.replace(/\s*\[[^\]]+\]\s*$/, "").trim().toLowerCase();
}

export function progressKey(title: string, season: number, episode: number) {
  return `moviebox-progress:${stablePlaybackTitle(title)}:${season}:${episode}`;
}

export function savedProgress(title: string, season: number, episode: number): number {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(progressKey(title, season, episode)));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function saveProgress(title: string, season: number, episode: number, seconds: number) {
  if (typeof window === "undefined" || !Number.isFinite(seconds) || seconds < 0) return;
  window.localStorage.setItem(progressKey(title, season, episode), String(Math.floor(seconds)));
  try {
    const key = "zenoplayer-watch-progress";
    const current = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<{ title: string; season: number; episode: number; seconds: number; finished: boolean; at: number }>;
    const entry = { title: stablePlaybackTitle(title), season, episode, seconds: Math.floor(seconds), finished: seconds === 0, at: Date.now() };
    const next = [entry, ...current.filter((item) => !(item.title === entry.title && item.season === season && item.episode === episode))].slice(0, 500);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch { /* ignore malformed local progress */ }
}

export type WatchProgress = { title: string; season: number; episode: number; seconds: number; finished: boolean; at: number };
export function watchProgress(): WatchProgress[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem("zenoplayer-watch-progress") || "[]") as WatchProgress[]; } catch { return []; }
}
