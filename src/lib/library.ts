import type { Item } from "@/lib/api";

// Watch history and downloads are kept on this device only.
export type Saved = Item & { at: number; note?: string };
const read = (k: string): Saved[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
};
const push = (k: string, it: Omit<Saved, "at">, max = 30) => {
  const list = [{ ...it, at: Date.now() }, ...read(k).filter((x) => x.slug !== it.slug)].slice(0, max);
  localStorage.setItem(k, JSON.stringify(list));
};
export const history = { list: () => read("rb_history"), add: (it: Omit<Saved, "at">) => push("rb_history", it) };
export const downloads = { list: () => read("rb_downloads"), add: (it: Omit<Saved, "at">) => push("rb_downloads", it) };
export const myList = {
  list: () => read("rb_mylist"),
  has: (slug: string) => read("rb_mylist").some((x) => x.slug === slug),
  toggle: (it: Omit<Saved, "at">) => {
    const l = read("rb_mylist");
    if (l.some((x) => x.slug === it.slug)) localStorage.setItem("rb_mylist", JSON.stringify(l.filter((x) => x.slug !== it.slug)));
    else push("rb_mylist", it, 200);
  },
};
