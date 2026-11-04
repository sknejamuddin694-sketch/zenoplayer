import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { Search } from "lucide-react";

import { TABS } from "@/lib/tabs";

export function Header({ tabs = false, active = "trending" }: { tabs?: boolean; active?: string }) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const [sug, setSug] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setSug([]); return; }
    const h = setTimeout(() => {
      get<{ suggestions: string[] }>(`/search/suggest?q=${encodeURIComponent(t)}`)
        .then((r) => setSug(r.suggestions?.slice(0, 8) ?? []))
        .catch(() => setSug([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);
  const go = (v: string) => { setOpen(false); setQ(v); nav({ to: "/search", search: { q: v } }); };
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 pb-1 shadow-lg shadow-background/20 backdrop-blur-xl">
      <div className="zeno-topbar flex items-center gap-3 px-4 pt-3">
        <Link to="/" aria-label="ZenoPlayer home" className="zeno-brand flex shrink-0 items-center gap-2">
          <span className="zeno-mark" aria-hidden="true"><span /></span>
          <span className="hidden font-display text-base font-bold leading-none tracking-tight min-[380px]:block">Zeno<span>Player</span></span>
        </Link>
        <form
          className="relative flex flex-1 items-center gap-2 rounded-lg bg-secondary/90 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) go(q.trim());
          }}
        >
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Black Clover [Hindi]"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="zeno-search font-bold">Search</button>
          {open && sug.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg bg-card shadow-lg">
              {sug.map((x) => (
                <li key={x}>
                  <button type="button" onMouseDown={() => go(x)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-secondary">
                    <Search className="h-4 w-4 text-muted-foreground" />{x}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
        <button type="button" className="zeno-language hidden shrink-0 sm:block" aria-label="Language">EN <span>⌄</span></button>
      </div>
      {tabs && (
        <nav className="zeno-nav no-scrollbar mt-2 flex items-center gap-5 overflow-x-auto px-4 py-2">
          {TABS.map((t) => (
            <Link key={t.id} to="/" search={{ tab: t.id }} className={active === t.id ? "tab-on shrink-0" : "tab-off shrink-0"}>{t.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
