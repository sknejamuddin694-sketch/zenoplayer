import type { Item, Section } from "@/lib/api";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function looksLikeAnime(value: { name?: string; slug?: string; badge?: string | null; genre?: string }, section = "") {
  const haystack = normalize([value.name, value.slug, value.badge, value.genre, section].filter(Boolean).join(" "));
  return /anime|animation|japanese|manga|naruto|bleach|one piece|dragon ball|jujutsu|demon slayer|my hero|attack on titan|studio ghibli|pokemon|digimon|one punch|sailor moon|evangelion|gundam|berserk|inuyasha/.test(haystack);
}

export function uniqueItems(items: Item[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.slug || seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });
}

function uniqueTitles(items: Item[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const title = normalize(item.name);
    if (!title || seen.has(title)) return false;
    seen.add(title);
    return true;
  });
}

function rotationSeed(value: string) {
  return [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function latestItems(items: Item[]) {
  return uniqueItems(items).sort((a, b) => (Date.parse(b.year || "") || 0) - (Date.parse(a.year || "") || 0));
}

function score(title: string, keywords: string[]) {
  const haystack = normalize(title);
  return keywords.reduce((total, keyword) => total + (haystack.includes(normalize(keyword)) ? 3 : 0), 0);
}

function shelf(source: Item[], keywords: string[], fallbackOffset: number) {
  const matched = source
    .map((item, index) => ({ item, rank: score(item.name, keywords), index }))
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((entry) => entry.item);
  if (matched.length >= 6) return uniqueItems(matched).slice(0, 18);
  const fallback = source.filter((_, index) => index % 5 === fallbackOffset).slice(0, 12);
  return uniqueItems([...matched, ...fallback]).slice(0, 18);
}

export function animeCollections(homeSections: Section[], trending: Item[]) {
  const homeAnime = homeSections.flatMap((section) => section.movies.filter((item) => looksLikeAnime(item, section.section)));
  const source = uniqueItems([...trending, ...homeAnime]);
  const trendingAnime = latestItems([...trending, ...homeAnime]).slice(0, 24);
  return [
    { section: "Trending Anime", count: trendingAnime.length, movies: trendingAnime },
    { section: "Romantic Anime", count: 0, movies: shelf(source, ["love", "romance", "romantic", "kiss", "heart", "marriage", "kaguya", "horimiya", "toradora", "fruit basket"], 0) },
    { section: "Classic Anime Series", count: 0, movies: shelf(source, ["naruto", "bleach", "dragon ball", "one piece", "yu yu", "sailor", "gundam", "cowboy", "samurai", "evangelion", "classic"], 1) },
    { section: "Burning with Ardour", count: 0, movies: shelf(source, ["fire", "flame", "burn", "blaze", "battle", "war", "hero", "demon", "soul", "strong"], 2) },
    { section: "Dark Fantasy", count: 0, movies: shelf(source, ["dark", "fantasy", "berserk", "hellsing", "fate", "jujutsu", "demon", "attack", "blood", "night"], 3) },
    { section: "Game On: Driven To Win!", count: 0, movies: shelf(source, ["game", "blue lock", "haikyu", "kuroko", "sports", "champion", "win", "battle", "beyblade", "yowamushi"], 4) },
  ];
}

export function relatedAnime(sections: Section[], trending: Item[], currentSlug: string, title: string, genre: string) {
  const anime = uniqueTitles(uniqueItems([
    ...trending,
    ...sections.flatMap((section) => section.movies.filter((item) => looksLikeAnime(item, section.section))),
  ])).filter((item) => item.slug !== currentSlug);
  const terms = normalize(`${title} ${genre}`).split(" ").filter((term) => term.length > 3);
  const shift = rotationSeed(`${currentSlug}:${title}:${new Date().toISOString().slice(0, 10)}`) % Math.max(anime.length, 1);
  return anime
    .map((item, index) => ({ item, rank: score(item.name, terms), index: (index + shift) % Math.max(anime.length, 1) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .slice(0, 12)
    .map((entry) => entry.item);
}
