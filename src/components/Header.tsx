import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { readSession } from "@/lib/auth";
import { MessageCircle, Search, UserRound } from "lucide-react";
import { TABS } from "@/lib/tabs";

export function Header({ tabs = false, active = "trending", initialQuery = "" }: { tabs?: boolean; active?: string; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [name, setName] = useState("Z");
  const nav = useNavigate();
  const [sug, setSug] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const session = readSession();
    setName(session.name?.trim().charAt(0).toUpperCase() || "Z");
  }, []);

  useEffect(() => setQ(initialQuery), [initialQuery]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setSug([]); return; }
    const timer = setTimeout(() => {
      get<{ suggestions: string[] }>(`/search/suggest?q=${encodeURIComponent(term)}`)
        .then((result) => setSug(result.suggestions?.slice(0, 8) ?? []))
        .catch(() => setSug([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (value: string) => {
    setOpen(false);
    setQ(value);
    nav({ to: "/search", search: { q: value } });
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" search={{ tab: "trending" }} aria-label="ZenoPlayer home" className="brand-link">
          <span className="brand-symbol" aria-hidden="true">Z</span>
          <span className="brand-wordmark">Zeno<span>Player</span></span>
        </Link>
        <form
          className="header-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (q.trim()) go(q.trim());
          }}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => { setQ(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search anime..."
            aria-label="Search anime and titles"
          />
          <button type="submit" className="header-search-submit" aria-label="Submit search"><Search className="h-4 w-4" /></button>
          {open && sug.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {sug.map((suggestion) => (
                <li key={suggestion}>
                  <button type="button" onMouseDown={() => go(suggestion)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-secondary">
                    <Search className="h-4 w-4 text-muted-foreground" />{suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
        <Link to="/anime-library" className="header-action" aria-label="Community anime list"><MessageCircle className="h-4 w-4" /></Link>
        <Link to="/me" className="header-action header-user" aria-label="My profile">{name || <UserRound className="h-4 w-4" />}</Link>
      </div>
      {tabs && (
        <nav className="header-tabs" aria-label="Browse categories">
          {TABS.map((tab) => (
            <Link key={tab.id} to="/" search={{ tab: tab.id }} className={active === tab.id ? "header-tab is-active" : "header-tab"}>
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
