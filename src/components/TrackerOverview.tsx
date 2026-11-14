import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Play, Sparkles } from "lucide-react";
import { history, myList, type Saved } from "@/lib/library";
import { readSession } from "@/lib/auth";
import { stablePlaybackTitle, watchProgress, type WatchProgress } from "@/lib/playback";

type Snapshot = {
  name: string;
  isGuest: boolean;
  saved: Saved[];
  recent: Saved[];
  progress: WatchProgress[];
};

const initialSnapshot: Snapshot = { name: "Anime fan", isGuest: true, saved: [], recent: [], progress: [] };

export function TrackerOverview() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const session = readSession();
    setSnapshot({
      name: session.name || "Anime fan",
      isGuest: session.mode === "guest",
      saved: myList.list(),
      recent: history.list(),
      progress: watchProgress(),
    });
  }, []);

  const { name, isGuest, saved, recent, progress } = snapshot;
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const count = progress.filter((entry) => new Date(entry.at).toDateString() === date.toDateString()).length;
    return { date, count };
  });
  const activeDays = week.filter((day) => day.count > 0).length;
  const displayItems = saved.length ? saved.slice(0, 3) : recent.slice(0, 3);
  const firstName = name.trim().split(/\s+/)[0] || "Anime fan";

  return (
    <section className="tracker-dashboard" aria-label="Anime tracking overview">
      <div className="tracker-profile-card">
        <div className="tracker-profile-main">
          <div className="tracker-avatar" aria-hidden="true"><Sparkles className="h-7 w-7" /></div>
          <div className="tracker-profile-copy">
            <p className="tracker-eyebrow">YOUR ANIME TRACKER</p>
            <h1>Hey, {firstName}</h1>
            <p>{isGuest ? "Your watch data stays on this device." : "Pick up right where you left off."}</p>
          </div>
          <Link to="/me" className="tracker-profile-link">Profile <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        <div className="tracker-stats">
          <div className="tracker-stat"><strong>{saved.length}</strong><span>On your list</span></div>
          <div className="tracker-stat"><strong>{progress.length}</strong><span>Episodes tracked</span></div>
          <div className="tracker-stat"><strong>{activeDays}<small>/7</small></strong><span>Active days</span></div>
        </div>
      </div>

      <section className="tracker-week-card" aria-label="Weekly watch activity">
        <div className="tracker-week-header">
          <div>
            <p className="tracker-eyebrow">YOUR ACTIVITY</p>
            <h2>Tracking this week</h2>
          </div>
          <span className="week-pill">{activeDays} {activeDays === 1 ? "DAY" : "DAYS"} ACTIVE</span>
        </div>
        <div className="tracker-week-grid">
          {week.map(({ date, count }) => (
            <div key={date.toISOString()} className={`tracker-day${count ? " is-active" : ""}`} aria-label={`${date.toLocaleDateString("en", { weekday: "long" })}: ${count} tracked episodes`}>
              <span className="tracker-day-name">{date.toLocaleDateString("en", { weekday: "short" })}</span>
              <span className="tracker-day-date">{date.getDate()}</span>
              <span className="tracker-day-count">{count || "·"}</span>
            </div>
          ))}
        </div>
        <p className="tracker-week-note">Activity is based on the episode progress saved on this device.</p>
      </section>

      <section className="tracker-list-section">
        <div className="section-heading">
          <div>
            <p className="tracker-eyebrow">YOUR COLLECTION</p>
            <h2>{saved.length ? "Track your anime" : recent.length ? "Recently watched" : "Start your anime list"}</h2>
          </div>
          <Link to={saved.length || recent.length ? "/me" : "/anime-library"} className="section-link">See all <ArrowUpRight className="h-4 w-4" /></Link>
        </div>

        {displayItems.length > 0 ? (
          <div className="tracker-list-grid">
            {displayItems.map((item) => {
              const entry = progress.find((candidate) => stablePlaybackTitle(candidate.title) === stablePlaybackTitle(item.name));
              return (
                <Link key={item.slug} to="/title/$slug" params={{ slug: item.slug }} className="tracker-anime-card">
                  <div className="tracker-anime-image">
                    <img src={item.poster_url} alt={item.name} loading="lazy" />
                    <span className="tracker-anime-tag">{entry ? (entry.finished ? "COMPLETED" : "WATCHING") : saved.length ? "IN MY LIST" : "RECENT"}</span>
                  </div>
                  <div className="tracker-anime-copy">
                    <h3>{item.name}</h3>
                    <p>{entry ? `S${String(entry.season).padStart(2, "0")} · E${String(entry.episode).padStart(2, "0")}` : "Ready when you are"}</p>
                    <span className="tracker-resume">{entry && !entry.finished ? "Continue" : "Open title"}<Play className="h-3.5 w-3.5 fill-current" /></span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="tracker-empty">
            <span className="tracker-empty-icon"><Sparkles className="h-6 w-6" /></span>
            <div><h3>Your list is waiting</h3><p>Save anime from any title page and your tracker will keep it here.</p></div>
            <Link to="/anime-library" className="btn-primary tracker-empty-cta">Explore anime <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        )}
      </section>
    </section>
  );
}
