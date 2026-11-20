/**
 * MovieBox API — Cloudflare Worker
 *
 * A complete port of the Python FastAPI to a zero-RAM Cloudflare Worker.
 * All endpoints use the MovieBox backend JSON APIs directly (no HTML scraping).
 * Video streaming pipes ReadableStream straight through — zero buffering.
 */

const BASE_URL = "https://moviebox.ph";
const H5_API = "https://h5-api.aoneroom.com";
const DEFAULT_DOMAIN = "https://123movienow.cc";
// MovieBox picks its catalogue by visitor region; ask for the India catalogue
// (Hindi / Tamil / Telugu dubs, Bollywood, anime) on every catalogue API call.
const REGION_IP = "49.36.10.1";
const IS_BROWSER = typeof window !== "undefined" && typeof document !== "undefined";
const fetch = (input, init = {}) => {
  const u = typeof input === "string" ? input : input.url;
  if (IS_BROWSER) {
    // Running in the visitor's browser (fallback when the host's servers are blocked by the
    // provider). Browsers can't send custom UA/XFF/cookie headers, and the provider's CORS only
    // allows content-type, so strip everything else. The visitor's own IP picks the region.
    const src = new Headers(init.headers || {});
    const headers = {};
    if (src.get("content-type")) headers["content-type"] = src.get("content-type");
    return globalThis.fetch(u, { method: init.method || "GET", body: init.body, headers });
  }
  if (!u.startsWith(H5_API) && !u.startsWith("https://moviebox.ph")) return globalThis.fetch(input, init);
  const headers = new Headers(init.headers || {});
  headers.set("X-Forwarded-For", REGION_IP);
  return globalThis.fetch(input, { ...init, headers });
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const searchCache = new Map();
const curatedAnimeCache = { expires: 0, payload: null };
const CURATED_ANIME_LIST_URL = "https://www.imdb.com/list/ls084262092/";
const CANONICAL_OSHI_NO_KO = {
  name: "Oshi No Ko S1-S3",
  poster_url: "https://pbcdnw.aoneroom.com/image/2026/08/23/da40eafdef4d64e3f50e41fc2c5fc944.jpg?x-oss-process=image/resize%2Cw_250",
  url: `${BASE_URL}/detail/oshi-no-ko-MWvgwneEFm9`,
  slug: "oshi-no-ko-MWvgwneEFm9",
  badge: null,
  blurhash: null,
};

function searchKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compactSearchKey(value) {
  return searchKey(value).replace(/\s+/g, "");
}

function searchRank(name, query) {
  const title = searchKey(name);
  const wanted = searchKey(query);
  const compactTitle = compactSearchKey(name);
  const compactWanted = compactSearchKey(query);
  if (title === wanted) return 1000;
  if (compactTitle === compactWanted) return 980;
  if (title.startsWith(wanted)) return 800;
  if (compactTitle.startsWith(compactWanted)) return 780;
  if (title.includes(wanted)) return 600;
  const words = wanted.split(" ").filter(Boolean);
  return words.reduce((score, word) => score + (title.includes(word) ? 20 : 0), 0);
}

async function movieBoxHeaders(keyword) {
  const base = {
    "User-Agent": UA,
    "X-Source": "downloader",
    "X-Site-Domain": "videodownloader.site",
    "Origin": "https://videodownloader.site",
  };
  const bootstrap = await fetch(`${H5_API}/wefeed-h5api-bff/subject/search-suggest`, {
    method: "POST",
    headers: { ...base, "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, perPage: 1 }),
  });
  const rawUser = bootstrap.headers.get("x-user");
  if (rawUser) {
    try {
      const token = JSON.parse(rawUser).token;
      if (token) {
        base.Authorization = `Bearer ${token}`;
        base.Cookie = `token=${token}`;
      }
    } catch {}
  }
  return base;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers":
    "Content-Length, Content-Range, Accept-Ranges, X-Stream-Resolution",
};

// ══════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, "") || "/";

    try {
      // ── Home ──────────────────────────────────────────────
      if (p === "/") return handleRoot();
      if (p === "/home") return handleHome();
      if (p === "/tab/movie") return json({ sections: await fetchHomeData(2) });
      if (p === "/anime") return handleTrendingGenre("Anime");
      if (p === "/curated-anime") return handleCuratedAnime();
      if (p === "/home/sections") return handleHomeSections();
      if (p === "/home/banner") return handleHomeBanner();
      if (p === "/home/trending") return handleHomeFilter("trending now", "popular movie");
      if (p === "/home/hot") return handleHomeFilter("hot");
      if (p === "/home/cinema") return handleHomeFilter("cinema", "popular series");

      // ── Home section by name ──────────────────────────────
      let m = p.match(/^\/home\/section\/(.+)$/);
      if (m) return handleHomeSectionByName(decodeURIComponent(m[1]));

      // ── Movies ────────────────────────────────────────────
      if (p === "/movies") return handleCategory("movie");
      m = p.match(/^\/movies\/sections$/);
      if (m) return handleCategorySections("movie");
      m = p.match(/^\/movies\/section\/(.+)$/);
      if (m) return handleCategorySectionByName("movie", decodeURIComponent(m[1]));

      // ── TV Series ─────────────────────────────────────────
      if (p === "/tv-series") return handleCategory("tv-series");
      m = p.match(/^\/tv-series\/sections$/);
      if (m) return handleCategorySections("tv-series");
      m = p.match(/^\/tv-series\/section\/(.+)$/);
      if (m) return handleCategorySectionByName("tv-series", decodeURIComponent(m[1]));

      // ── Animation ─────────────────────────────────────────
      if (p === "/animation") return handleCategory("animated-series");
      m = p.match(/^\/animation\/sections$/);
      if (m) return handleCategorySections("animated-series");
      m = p.match(/^\/animation\/section\/(.+)$/);
      if (m) return handleCategorySectionByName("animated-series", decodeURIComponent(m[1]));

      // ── Ranking ───────────────────────────────────────────
      if (p === "/ranking") return handleRanking();
      m = p.match(/^\/ranking\/sections$/);
      if (m) return handleRankingSections();
      m = p.match(/^\/ranking\/section\/(.+)$/);
      if (m) return handleRankingSectionByName(decodeURIComponent(m[1]));

      // ── Search ────────────────────────────────────────────
      if (p === "/search/suggest") return handleSearchSuggest(url.searchParams);
      if (p === "/search") return handleSearch(url.searchParams);

      // ── Detail ────────────────────────────────────────────
      m = p.match(/^\/detail\/(.+)$/);
      if (m) return handleDetail(decodeURIComponent(m[1]));

      // ── Episodes ──────────────────────────────────────────
      m = p.match(/^\/episodes\/(.+)$/);
      if (m) return handleEpisodes(decodeURIComponent(m[1]));

      // ── Streaming ─────────────────────────────────────────
      m = p.match(/^\/api\/stream\/(\d+)$/);
      if (m) return handleStreamApi(m[1], url.searchParams);

      m = p.match(/^\/download\/(\d+)$/);
      if (m) return handleWatch(m[1], url.searchParams, request, true);

      m = p.match(/^\/watch\/(\d+)$/);
      if (m) return handleWatch(m[1], url.searchParams, request);

      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message || "Internal error" }, 500);
    }
  },
};

// ══════════════════════════════════════════════════════════════════
// GET /  — endpoint listing
// ══════════════════════════════════════════════════════════════════

function handleRoot() {
  return json({ ok: true, service: "movie-catalogue", message: "Use the Movie Box website." });
  /* endpoints: {
      home: {
        "/home": "Get home page data (banners and sections)",
        "/home/sections": "List section names",
        "/home/section/{name}": "Get a section by name",
        "/home/banner": "Get banner items",
        "/home/trending": "Get trending section",
        "/home/hot": "Get hot section",
        "/home/cinema": "Get cinema section",
      },
      movies: {
        "/movies": "Get all movies",
        "/movies/sections": "List movie sections",
        "/movies/section/{name}": "Get a movie section by name",
      },
      tv_series: {
        "/tv-series": "Get all TV series",
        "/tv-series/sections": "List TV series sections",
        "/tv-series/section/{name}": "Get a TV series section by name",
      },
      animation: {
        "/animation": "Get all animations",
        "/animation/sections": "List animation sections",
        "/animation/section/{name}": "Get an animation section by name",
      },
      ranking: {
        "/ranking": "Get ranking lists",
        "/ranking/sections": "List ranking sections",
        "/ranking/section/{name}": "Get a ranking section by name",
      },
      search: {
        "/search?q={query}": "Search for titles",
        "/search/suggest?q={query}": "Get autocomplete suggestions",
      },
      detail: {
        "/detail/{slug}": "Get full metadata, cast, seasons, streams",
        "/episodes/{slug}": "Get episode list and counts for all seasons",
      },
      streaming: {
        "/api/stream/{subject_id}?detail_path=...": "Get raw stream URLs (JSON)",
        "/watch/{subject_id}?detail_path=...&resolution=480":
          "Stream video directly (zero-buffer proxy). Params: detail_path, se, ep, resolution",
      },
    }, */
}

// ══════════════════════════════════════════════════════════════════
// GET /home
// ══════════════════════════════════════════════════════════════════

async function fetchHomeData(tabId) {
  const resp = await fetch(
    tabId != null
      ? `${H5_API}/wefeed-h5api-bff/tab-operating?tabId=${tabId}`
      : `${H5_API}/wefeed-h5api-bff/home?host=moviebox.ph`,
    { headers: { "User-Agent": UA } }
  );
  if (!resp.ok) throw new Error(`Home API returned ${resp.status}`);
  const body = await resp.json();
  const ops = body?.data?.operatingList || [];

  const sections = [];
  for (const op of ops) {
    const title = op.title || "";

    // Banner
    if (op.banner) {
      const items = (op.banner.items || [])
        .filter((i) => i.title && !i.title.includes("Communities"))
        .map((i) => ({
          name: i.title,
          poster_url:
            i.image?.url || i.subject?.cover?.url || null,
          url: i.detailPath
            ? `${BASE_URL}/detail/${i.detailPath}`
            : null,
          badge: i.subject?.corner || null,
          slug: i.detailPath || null,
        }));
      sections.push({
        section: "Banner",
        count: items.length,
        movies: items,
        more_url: null,
      });
      continue;
    }

    const subs = op.subjects || [];
    if (!subs.length || !title) continue;

    const movies = subs.map((s) => ({
      name: s.title || s.name,
      poster_url: s.cover?.url || s.thumbnail || null,
      url: s.detailPath ? `${BASE_URL}/detail/${s.detailPath}` : null,
      slug: s.detailPath || null,
      badge: s.corner || null,
      blurhash: s.cover?.blurHash || null,
      year: s.releaseDate || s.year || null,
    }));

    sections.push({
      section: title,
      count: movies.length,
      movies,
      more_url: null,
    });
  }
  return sections;
}

async function handleHome() {
  const sections = await fetchHomeData();
  return json({
    source: `${H5_API}/wefeed-h5api-bff/home`,
    total_sections: sections.length,
    poster_map_size: 0,
    sections,
  });
}

async function handleHomeSections() {
  const sections = await fetchHomeData();
  return json({
    total: sections.length,
    sections: sections.map((s) => ({
      name: s.section,
      count: s.count,
      more_url: s.more_url,
    })),
  });
}

async function handleHomeBanner() {
  const sections = await fetchHomeData();
  const banner = sections.find((s) => s.section === "Banner");
  return json({
    count: banner ? banner.count : 0,
    featured: banner ? banner.movies : [],
  });
}

async function handleHomeFilter(...keywords) {
  const sections = await fetchHomeData();
  const match = sections.find((s) =>
    keywords.some((kw) => s.section.toLowerCase().includes(kw))
  );
  if (!match) return json({ error: "Section not found" }, 404);
  return json(match);
}

async function handleHomeSectionByName(name) {
  const sections = await fetchHomeData();
  const matched = sections.filter((s) =>
    s.section.toLowerCase().includes(name.toLowerCase())
  );
  if (!matched.length) {
    return json(
      {
        message: `No section matching '${name}'`,
        available: sections.map((s) => s.section),
      },
      404
    );
  }
  return json({ results: matched });
}

// ══════════════════════════════════════════════════════════════════
// GET /movies, /tv-series, /animation  (category pages)
// Uses the backend filter API instead of scraping HTML
// ══════════════════════════════════════════════════════════════════

async function fetchCategoryData(category) {
  // Provider's filter endpoint is POST-only; channelId picks movie / TV / animation.
  const plans = {
    movie: { channelId: 1, rows: [
      ["🔥 Hottest Movies", { sort: "Hottest" }],
      ["🆕 Latest Movies", { sort: "Latest" }],
      ["🇮🇳 Bollywood & Indian Movies", { sort: "Hottest", country: "India" }],
      ["🎬 Hollywood Movies", { sort: "Hottest", country: "United States" }],
      ["🇰🇷 Korean Movies", { sort: "Hottest", country: "South Korea" }],
    ] },
    "tv-series": { channelId: 2, rows: [
      ["🔥 Hot TV Series", { sort: "Hottest" }],
      ["🆕 Latest TV Series", { sort: "Latest" }],
      ["🇮🇳 Indian Series", { sort: "Hottest", country: "India" }],
      ["🇰🇷 Korean Drama", { sort: "Hottest", country: "South Korea" }],
      ["📺 Western TV Series", { sort: "Hottest", country: "United States" }],
    ] },
    "animated-series": { channelId: 1006, rows: [
      ["✨ Popular Animation", { sort: "Hottest" }],
      ["🆕 Latest Animation", { sort: "Latest" }],
      ["🇯🇵 Japanese Anime", { sort: "Hottest", country: "Japan" }],
    ] },
  };
  const plan = plans[category] || plans.movie;
  const rows = await Promise.all(plan.rows.map(async ([section, extra]) => {
    const pages = await Promise.all([1, 2].map(async (page) => {
      try {
        const resp = await fetch(`${H5_API}/wefeed-h5api-bff/subject/filter`, {
          method: "POST",
          headers: { "User-Agent": UA, accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ page, perPage: 24, channelId: plan.channelId, ...extra }),
        });
        if (!resp.ok) return [];
        const body = await resp.json();
        return body?.data?.items || [];
      } catch { return []; }
    }));
    const seen = new Set();
    const movies = pages.flat().filter((item) => {
      if (!item?.detailPath || !item.cover?.url || seen.has(item.detailPath)) return false;
      seen.add(item.detailPath);
      return true;
    }).map((s) => ({
      name: s.title || s.name || "",
      poster_url: s.cover?.url || null,
      url: `${BASE_URL}/detail/${s.detailPath}`,
      slug: s.detailPath,
      badge: s.corner || null,
      blurhash: s.cover?.blurHash || null,
      year: s.releaseDate || null,
      rating: s.imdbRatingValue || null,
    }));
    return { section, more_url: null, count: movies.length, movies };
  }));
  const filled = rows.filter((r) => r.movies.length);
  // Empty on the server usually means the provider blocked this host; fail so the app retries from the browser.
  if (!filled.length) throw new Error("Category API returned no items");
  return filled;
}

async function handleCategory(category) {
  const sections = await fetchCategoryData(category);
  return json({
    source: `${H5_API}/wefeed-h5api-bff/subject/filter`,
    total_sections: sections.length,
    poster_map_size: 0,
    sections,
  });
}

async function handleCategorySections(category) {
  const sections = await fetchCategoryData(category);
  return json({
    total: sections.length,
    sections: sections.map((s) => ({
      name: s.section,
      count: s.count,
      more_url: s.more_url,
    })),
  });
}

async function handleCategorySectionByName(category, name) {
  const sections = await fetchCategoryData(category);
  const matched = sections.filter((s) =>
    s.section.toLowerCase().includes(name.toLowerCase())
  );
  if (!matched.length) {
    return json(
      {
        message: `No section matching '${name}'`,
        available: sections.map((s) => s.section),
      },
      404
    );
  }
  return json({ results: matched });
}

// ══════════════════════════════════════════════════════════════════
// GET /ranking
// ══════════════════════════════════════════════════════════════════

async function fetchRankingData() {
  const resp = await fetch(
    `${H5_API}/wefeed-h5api-bff/subject/rank-list`,
    { headers: { "User-Agent": UA, accept: "application/json" } }
  );
  if (!resp.ok) throw new Error(`Ranking API returned ${resp.status}`);
  const body = await resp.json();
  const lists = body?.data || [];

  const sections = [];
  for (const list of Array.isArray(lists) ? lists : [lists]) {
    const title = list.title || "Most Watched";
    const items = list.items || list.subjects || [];
    const movies = items.map((s, i) => ({
      name: s.title || s.name || "",
      poster_url: s.cover?.url || null,
      url: s.detailPath ? `${BASE_URL}/detail/${s.detailPath}` : null,
      slug: s.detailPath || null,
      rank: String(i + 1),
      badge: s.corner || null,
    }));
    sections.push({
      section: title,
      more_url: null,
      count: movies.length,
      movies,
    });
  }
  return sections;
}

async function handleRanking() {
  const sections = await fetchRankingData();
  return json({
    source: `${H5_API}/wefeed-h5api-bff/subject/rank-list`,
    total_sections: sections.length,
    poster_map_size: 0,
    sections,
  });
}

async function handleRankingSections() {
  const sections = await fetchRankingData();
  return json({
    total: sections.length,
    sections: sections.map((s) => ({
      name: s.section,
      count: s.count,
      more_url: s.more_url,
    })),
  });
}

async function handleRankingSectionByName(name) {
  const sections = await fetchRankingData();
  const matched = sections.filter((s) =>
    s.section.toLowerCase().includes(name.toLowerCase())
  );
  if (!matched.length) {
    return json(
      {
        message: `No section matching '${name}'`,
        available: sections.map((s) => s.section),
      },
      404
    );
  }
  return json({ results: matched });
}

// ══════════════════════════════════════════════════════════════════
// GET /search/suggest  and  GET /search
// ══════════════════════════════════════════════════════════════════

async function handleSearchSuggest(params) {
  const q = params.get("q");
  if (!q) return json({ error: "q parameter required" }, 400);

  const resp = await fetch(
    `${H5_API}/wefeed-h5api-bff/subject/search-suggest`,
    {
      method: "POST",
      headers: { ...(await movieBoxHeaders(q)), "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: q, perPage: 10 }),
    }
  );
  if (!resp.ok) return json({ error: "Search API failed" }, 502);
  const body = await resp.json();
  const items = body?.data?.items || [];
  return json({
    query: q,
    suggestions: items.map((i) => i.word).filter(Boolean),
  });
}

async function handleSearch(params) {
  const q = params.get("q");
  if (!q) return json({ error: "q parameter required" }, 400);
  const key = searchKey(q);
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) return json(cached.payload, 200, { "x-search-cache": "HIT" });

  const resp = await fetch(
    `${H5_API}/wefeed-h5api-bff/subject/search`,
    {
      method: "POST",
      headers: { ...(await movieBoxHeaders(q)), "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: q, perPage: 50, page: 1 }),
    }
  );
  if (!resp.ok) return json({ error: "Search API failed" }, 502);
  const body = await resp.json();
  const items = body?.data?.items || [];

  const movies = items.map((s) => ({
    name: s.title || "",
    poster_url: s.cover?.url || null,
    url: s.detailPath ? `${BASE_URL}/detail/${s.detailPath}` : null,
    slug: s.detailPath || null,
    badge: s.corner || null,
    blurhash: s.cover?.blurHash || null,
  }));

  if (searchKey(q) === "oshi no ko") {
    const withoutCanonical = movies.filter((movie) => movie.slug !== CANONICAL_OSHI_NO_KO.slug);
    movies.splice(0, movies.length, CANONICAL_OSHI_NO_KO, ...withoutCanonical);
  }
  movies.sort((a, b) => searchRank(b.name, q) - searchRank(a.name, q));
  const payload = { query: q, count: movies.length, movies };
  searchCache.set(key, { expires: Date.now() + 60_000, payload });
  return json(payload, 200, { "x-search-cache": "MISS" });
}

// ══════════════════════════════════════════════════════════════════
// GET /detail/{slug}  — full metadata from NUXT_DATA
// ══════════════════════════════════════════════════════════════════

async function handleDetail(slug) {
  const pageUrl = `${BASE_URL}/detail/${slug}`;
  const resp = await fetch(pageUrl, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
  if (!resp.ok) return json({ error: "Movie not found" }, 404);
  const html = await resp.text();

  // Extract __NUXT_DATA__
  const match = html.match(
    /<script[^>]+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return json({ error: "Could not find NUXT data" }, 500);

  let nuxt;
  try {
    nuxt = JSON.parse(match[1]);
  } catch {
    return json({ error: "Failed to parse NUXT data" }, 500);
  }
  if (!Array.isArray(nuxt)) return json({ error: "Unexpected NUXT format" }, 500);

  // Resolve NUXT references
  function resolve(index) {
    if (typeof index !== "number" || index < 0 || index >= nuxt.length) return index;
    const val = nuxt[index];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const out = {};
      for (const [k, v] of Object.entries(val)) out[k] = resolve(v);
      return out;
    }
    if (Array.isArray(val)) return val.map(resolve);
    return val;
  }

  // Find movie metadata, seasons, cast, reviews
  let movieDict = null;
  let seasons = [];
  let topCast = [];
  let userReviews = [];

  for (let i = 0; i < nuxt.length; i++) {
    const resolved = resolve(i);
    if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) continue;

    if (resolved.subjectId && resolved.title && resolved.duration && !movieDict) {
      movieDict = resolved;
    }
    if (resolved.seasons) seasons = resolved.seasons;
    if (resolved.stars) topCast = resolved.stars;
    if (
      resolved.items &&
      Array.isArray(resolved.items) &&
      resolved.items.some((it) => it && typeof it === "object" && it.content)
    ) {
      userReviews = resolved.items;
    }
  }

  if (!movieDict) return json({ error: "Could not extract movie metadata" }, 404);

  // Collect stream URLs from raw data
  const mp4Urls = nuxt.filter((v) => typeof v === "string" && v.includes(".mp4"));
  const hlsUrls = nuxt.filter(
    (v) => typeof v === "string" && (v.includes(".m3u8") || v.includes("/m3u8/"))
  );

  return json({
    slug,
    source: pageUrl,
    metadata: {
      id: movieDict.subjectId,
      title: movieDict.title,
      description: movieDict.description,
      release_date: movieDict.releaseDate,
      duration: movieDict.duration,
      genre: movieDict.genre,
      country: movieDict.countryName,
      imdb_rating: movieDict.imdbRatingValue,
      poster:
        movieDict.cover && typeof movieDict.cover === "object"
          ? movieDict.cover.url
          : null,
      badge: movieDict.corner,
      dubs: movieDict.dubs && movieDict.dubs.length ? movieDict.dubs : await fetchDubs(slug),
      top_cast: topCast,
      seasons,
      user_reviews: userReviews
        .filter((r) => r && typeof r === "object" && r.content)
        .map((r) => ({
          user: r.user?.nickname || null,
          content: r.content,
          created_at: r.createdAt || null,
        })),
    },
    streams: { mp4: [], hls: [] },
  });
}

// ══════════════════════════════════════════════════════════════════
// GET /episodes/{slug}  — episode list from detail API
// ══════════════════════════════════════════════════════════════════

async function handleEpisodes(slug) {
  const resp = await fetch(
    `${H5_API}/wefeed-h5api-bff/detail?detailPath=${slug}`,
    { headers: { "User-Agent": UA } }
  );
  if (!resp.ok) return json({ error: "Movie/Series not found" }, 404);
  const body = await resp.json();
  const data = body?.data || {};
  const resource = data.resource || {};
  // Season zero is the movie resource, not a playable TV season.
  const seasonsData = (resource.seasons || []).filter((s) => Number(s.se) > 0 && Number(s.maxEp) > 0);

  // MovieBox API detail returns nested list structures, let's find subjectId in resource or data
  const subjectId = data.subject?.subjectId || data.subjectId || resource.id || null;

  if (!seasonsData.length) {
    return json({
      slug,
      message: "No seasons/episodes found. This might be a movie.",
      seasons: []
    });
  }

  const seasons = seasonsData.map((s) => {
    const epCount = s.maxEp || 0;
    const episodes = [];
    for (let i = 1; i <= epCount; i++) {
      episodes.push({
        name: `Episode ${i}`,
        ep: i,
        se: s.se,
        watch_url: null,
        stream_api_url: null
      });
    }
    return {
      season: s.se,
      episode_count: epCount,
      episodes
    };
  });

  return json({
    slug,
    subject_id: subjectId,
    total_seasons: seasons.length,
    seasons
  });
}

// ══════════════════════════════════════════════════════════════════
// GET /api/stream/{subject_id}  — raw stream URLs
// ══════════════════════════════════════════════════════════════════

async function discoverDomain() {
  try {
    const resp = await fetch(
      `${H5_API}/wefeed-h5api-bff/media-player/get-domain`,
      { headers: { "User-Agent": UA, "X-Client-Type": "h5" } }
    );
    if (resp.ok) {
      const d = await resp.json();
      return (d.data || DEFAULT_DOMAIN).replace(/\/+$/, "");
    }
  } catch {}
  return DEFAULT_DOMAIN;
}

async function fetchStreams(domain, subjectId, detailPath, se, ep) {
  const playUrl = `${domain}/wefeed-h5api-bff/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`;
  const resp = await fetch(playUrl, {
    headers: {
      accept: "application/json",
      referer: `${domain}/spa/videoPlayPage/movies/${detailPath}`,
      "x-client-info": '{"timezone":"Asia/Dhaka"}',
      cookie: "uuid=d8c3539e-2e46-4000-af20-7046a856e30a",
      "User-Agent": UA,
    },
  });
  if (!resp.ok) throw new Error(`Play API returned ${resp.status}`);
  const body = await resp.json();
  return body?.data?.streams || [];
}

async function handleStreamApi() {
  return json({ error: "Direct stream metadata is not public" }, 410);
}

async function handleStreamApiLegacy(subjectId, params) {
  const detailPath = params.get("detail_path");
  if (!detailPath) return json({ error: "detail_path is required" }, 400);
  const se = params.get("se") || "0";
  const ep = params.get("ep") || "0";

  const domain = await discoverDomain();
  const streams = await fetchStreams(domain, subjectId, detailPath, se, ep);

  if (!streams.length) return json({ error: "No streams found" }, 404);

  const formatted = streams
    .map((s) => ({
      resolution: s.resolutions ? `${s.resolutions}p` : "Unknown",
      format: s.format || null,
      url: s.url,
      size_bytes: s.size || null,
      size_mb: s.size ? Number((Number(s.size) / 1048576).toFixed(2)) : null,
      id: s.id || null,
    }))
    .sort((a, b) => {
      const ra = parseInt(a.resolution) || 0;
      const rb = parseInt(b.resolution) || 0;
      return rb - ra;
    });

  // Fetch subtitles (only EN requested)
  let subtitles = [];
  const streamId = streams[0]?.id;
  if (streamId) {
    try {
      const capUrl = `${H5_API}/wefeed-h5api-bff/subject/caption?subjectId=${subjectId}&id=${streamId}&detailPath=${detailPath}`;
      const capResp = await fetch(capUrl, {
        headers: { 
          "User-Agent": UA, 
          accept: "application/json",
          "x-client-info": '{"timezone":"Asia/Dhaka"}',
          cookie: "uuid=d8c3539e-2e46-4000-af20-7046a856e30a"
        },
      });
      if (capResp.ok) {
        const capBody = await capResp.json();
        const subs = capBody?.data?.subtitles || [];
        subtitles = subs
          .filter((s) => s.lan === "en" || s.lanName?.toLowerCase().includes("english"))
          .map((s) => ({
            language: s.lanName || "English",
            url: s.url,
          }));
      } else {
        console.error("Caption API error:", await capResp.text());
      }
    } catch (err) {
      console.error("Subtitle fetch failed:", err);
    }
  }

  return json({
    subject_id: subjectId,
    detail_path: detailPath,
    season: parseInt(se),
    episode: parseInt(ep),
    stream_domain: domain,
    count: formatted.length,
    sources: formatted,
    subtitles,
  });
}

// ══════════════════════════════════════════════════════════════════
// GET /watch/{subject_id}  — zero-buffer video streaming
// ══════════════════════════════════════════════════════════════════

async function handleWatch(subjectId, params, request, download = false) {
  const detailPath = params.get("detail_path");
  if (!detailPath) return json({ error: "detail_path is required" }, 400);
  const se = params.get("se") || "0";
  const ep = params.get("ep") || "0";
  const resolution = parseInt(params.get("resolution") || "0", 10);

  const domain = await discoverDomain();
  const streams = await fetchStreams(domain, subjectId, detailPath, se, ep);
  if (!streams.length) return json({ error: "No streams found" }, 404);

  // Pick resolution
  let stream;
  if (resolution > 0) {
    stream =
      streams.find((s) => parseInt(s.resolutions) === resolution) ||
      streams[streams.length - 1];
  } else {
    stream = streams.sort(
      (a, b) => parseInt(b.resolutions) - parseInt(a.resolutions)
    )[0];
  }

  const streamUrl = stream.url;
  if (!streamUrl) return json({ error: "Stream URL is empty" }, 404);

  // Build CDN headers
  const cdnHeaders = {
    Referer: `${domain}/`,
    Origin: domain,
    Accept: "*/*",
    "User-Agent": UA,
  };

  // Forward Range header for seeking
  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) cdnHeaders["Range"] = rangeHeader;

  const vidResp = await fetch(streamUrl, {
    headers: cdnHeaders,
    redirect: "follow",
  });

  if (vidResp.status !== 200 && vidResp.status !== 206) {
    const errBody = await vidResp.text();
    return json(
      { error: `CDN returned ${vidResp.status}`, detail: errBody.slice(0, 200) },
      vidResp.status
    );
  }

  // Response headers
  const respHeaders = new Headers(CORS);
  respHeaders.set("Accept-Ranges", "bytes");
  respHeaders.set(
    "Content-Type",
    vidResp.headers.get("Content-Type") || "video/mp4"
  );
  respHeaders.set("X-Stream-Resolution", `${stream.resolutions}p`);
  respHeaders.set("Cache-Control", "no-store");
  if (download) {
    const safeName = `${detailPath}-s${se}e${ep}-${stream.resolutions}p.mp4`.replace(/[^a-zA-Z0-9._-]/g, "_");
    respHeaders.set("Content-Disposition", `attachment; filename="${safeName}"`);
  }

  const cl = vidResp.headers.get("Content-Length");
  if (cl) respHeaders.set("Content-Length", cl);
  const cr = vidResp.headers.get("Content-Range");
  if (cr) respHeaders.set("Content-Range", cr);

  // Pipe ReadableStream straight through — ZERO buffering
  return new Response(vidResp.body, {
    status: vidResp.status,
    headers: respHeaders,
  });
}

// ══════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders },
  });
}


// Anime feed: trending pages filtered to the Anime genre.
async function handleTrendingGenre(genre) {
  const pages = await Promise.all([0, 1, 2, 3, 4, 5].map((pg) =>
    fetch(`${H5_API}/wefeed-h5api-bff/subject/trending?page=${pg}&perPage=50`, { headers: { "User-Agent": UA } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  const seen = new Set();
  const movies = [];
  for (const b of pages) for (const s of b?.data?.subjectList || []) {
    if (!(s.genre || "").includes(genre) || !s.detailPath || seen.has(s.detailPath)) continue;
    seen.add(s.detailPath);
    movies.push({ name: s.title, poster_url: s.cover?.url || null, slug: s.detailPath, badge: s.corner || null, type: s.subjectType, year: s.releaseDate || s.year || null });
  }
  movies.sort((a, b) => (Date.parse(b.year || "") || 0) - (Date.parse(a.year || "") || 0));
  return json({ section: genre, count: movies.length, movies });
}

// Curated anime feed; upstream is fetched server-side and cached.
async function handleCuratedAnime() {
  if (curatedAnimeCache.payload && curatedAnimeCache.expires > Date.now()) return json(curatedAnimeCache.payload, 200, { "x-curated-cache": "HIT" });
  try {
    const response = await fetch(CURATED_ANIME_LIST_URL, { headers: { "User-Agent": UA, "Accept": "text/html" }, redirect: "follow" });
    if (!response.ok) return json({ sections: [] }, 200, { "x-curated-source": "unavailable" });
    const html = await response.text();
    const blocks = html.match(/<li[^>]*>[\\s\\S]*?<\\/li>/gi) || [];
    const entries = [];
    for (const block of blocks) {
      const linkMatch = block.match(/<a[^>]+href=["']\\/title\\/(tt\\d+)\\/[^>]*>([^<]+)<\\/a>/i);
      if (!linkMatch) continue;
      const name = linkMatch[2].replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/^\\s*\\d+\\.\\s*/, "").trim();
      if (name && !entries.some((e) => e.name === name)) entries.push({ id: linkMatch[1], name });
    }
    const movies = [];
    for (let i = 0; i < Math.min(entries.length, 24); i += 4) {
      const batch = entries.slice(i, i + 4);
      const found = await Promise.all(batch.map(async (entry) => {
        try {
          const resp = await fetch(H5_API + "/wefeed-h5api-bff/subject/search", { method: "POST", headers: { ...(await movieBoxHeaders(entry.name)), "Content-Type": "application/json" }, body: JSON.stringify({ keyword: entry.name, perPage: 12, page: 1 }) });
          if (!resp.ok) return null;
          const body = await resp.json();
          const item = (body?.data?.items || []).find((x) => x.detailPath && searchRank(x.title || "", entry.name) > 0);
          return item ? { name: item.title, poster_url: item.cover?.url || null, slug: item.detailPath, badge: item.corner || null, year: item.releaseDate || item.year || null } : null;
        } catch { return null; }
      }));
      movies.push(...found.filter(Boolean));
    }
    const seen = new Set();
    const unique = movies.filter((item) => !seen.has(item.slug) && seen.add(item.slug);
    const payload = { sections: unique.length ? [{ section: "Recommended anime", count: unique.length, movies: unique }] : [] };
    curatedAnimeCache.payload = payload; curatedAnimeCache.expires = Date.now() + 21600000;
    return json(payload, 200, { "x-curated-cache": "MISS" });
  } catch { return json({ sections: [] }, 200, { "x-curated-source": "unavailable" }); }
}
// Language versions (dubs/subs) from the H5 detail API; the page scrape often omits them.
async function fetchDubs(slug) {
  try {
    const r = await fetch(`${H5_API}/wefeed-h5api-bff/detail?detailPath=${encodeURIComponent(slug)}`, { headers: { "User-Agent": UA } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d?.data?.subject?.dubs || []).filter((x) => x.detailPath && x.lanName);
  } catch {
    return [];
  }
}
