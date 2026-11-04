export type Tab = { id: string; label: string; source: "home" | "movie" | "anime"; match: RegExp | null };

// Each tab reads one MovieBox feed, optionally narrowed to sections whose name matches.
export const TABS: Tab[] = [
  { id: "trending", label: "Trending", source: "home", match: null },
  { id: "movie", label: "Movie", source: "movie", match: null },
  { id: "tv", label: "TV", source: "home", match: /drama|series|western tv|asian|short tv/i },
  { id: "anime", label: "Anime", source: "anime", match: null },
  { id: "bollywood", label: "Bollywood", source: "home", match: /bollywood|cinema|indian (movies|drama)/i },
  { id: "south", label: "South Indian", source: "home", match: /south indian/i },
  { id: "hollywood", label: "Hollywood", source: "home", match: /hollywood|western/i },
  { id: "soon", label: "Coming Soon", source: "home", match: /coming soon/i },
];

export const getTab = (id: string) => TABS.find((t) => t.id === id) ?? TABS[0]!;

export function sectionsForTab<T extends { section: string }>(tabId: string, sections: T[]): T[] {
  const tab = getTab(tabId);
  const rest = sections.filter((s) => s.section !== "Banner");
  return tab.match ? rest.filter((s) => tab.match!.test(s.section)) : rest;
}
