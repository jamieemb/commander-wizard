// Small Scryfall client: rate-limited (Scryfall asks for 50-100ms between requests),
// with a localStorage cache so the tribe gallery loads instantly after the first visit.

const API = "https://api.scryfall.com";
const CACHE_PREFIX = "cw:scry:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 160;

let queue = Promise.resolve();
let lastCall = 0;

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) { localStorage.removeItem(CACHE_PREFIX + key); return null; }
    return v;
  } catch { return null; }
}
function cacheSet(key, v) {
  const item = JSON.stringify({ t: Date.now(), v });
  try { localStorage.setItem(CACHE_PREFIX + key, item); }
  catch { purgeCache(); try { localStorage.setItem(CACHE_PREFIX + key, item); } catch { /* still full or blocked: live without the cache */ } }
}

/** Drop cached Scryfall responses (all of them, or those whose path starts with `prefix`). Cheap to refetch. */
export function purgeCache(prefix = "") {
  const gone = [];
  try {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(CACHE_PREFIX + prefix)) gone.push(k); }
    gone.forEach(k => localStorage.removeItem(k));
  } catch {}
  return gone.length;
}

/** Roughly how much of localStorage is in use, in bytes. */
export function storageBytes() {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch {}
  return n;
}

/** Only the fields the app reads: a full Scryfall card is 6-10 KB, this is about a quarter of that. */
const FACE_KEYS = ["name", "type_line", "oracle_text", "mana_cost", "colors", "power", "toughness", "loyalty", "image_uris"];
const CARD_KEYS = ["id", "oracle_id", "name", "layout", "type_line", "oracle_text", "mana_cost", "cmc", "colors", "color_identity", "keywords", "power", "toughness", "loyalty", "image_uris", "scryfall_uri", "edhrec_rank", "rarity", "set", "set_name", "collector_number"];
export function slimCard(c) {
  if (!c || typeof c !== "object") return c;
  const out = {};
  for (const k of CARD_KEYS) if (c[k] !== undefined) out[k] = c[k];
  if (c.prices) out.prices = { eur: c.prices.eur ?? null, eur_foil: c.prices.eur_foil ?? null, usd: c.prices.usd ?? null };
  if (c.card_faces) out.card_faces = c.card_faces.map(f => { const o = {}; for (const k of FACE_KEYS) if (f[k] !== undefined) o[k] = f[k]; return o; });
  return out;
}

function scheduled(fn) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + MIN_GAP_MS - Date.now());
    if (wait) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

/** One retry after a pause, both for a 429 and for a fetch that fails outright (network blip, or a rate-limit
 *  response served without CORS headers, which the browser reports as a bare "Failed to fetch"). */
async function fetchWithRetry(url, init) {
  let res;
  try { res = await fetch(url, init); } catch (e) { await new Promise(r => setTimeout(r, 1500)); return fetch(url, init); }
  if (res.status === 429 || res.status >= 500) {
    await new Promise(r => setTimeout(r, 1500));
    res = await fetch(url, init);
  }
  return res;
}

async function getJSON(path, transform = x => x) {
  const cached = cacheGet(path);
  if (cached) return cached;
  return scheduled(async () => {
    const res = await fetchWithRetry(API + path, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Scryfall ${res.status} for ${path}`);
    const json = transform(await res.json());
    cacheSet(path, json);
    return json;
  });
}

/**
 * Fetch many cards by exact name in ONE request (Scryfall allows 75 per call).
 * Returns { byName: { lowercased name -> card }, notFound: [names] }.
 */
export async function collection(names) {
  const key = `/cards/collection?names=${names.map(encodeURIComponent).join("|")}`;
  const cached = cacheGet(key);
  if (cached) return withFrontFaces(cached);
  const out = { byName: {}, notFound: [] };
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75);
    const json = await scheduled(async () => {
      const res = await fetchWithRetry(API + "/cards/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
      });
      if (!res.ok) throw new Error(`Scryfall ${res.status} for /cards/collection`);
      return res.json();
    });
    for (const c of json.data || []) out.byName[c.name.toLowerCase()] = slimCard(c);
    for (const nf of json.not_found || []) if (nf.name) out.notFound.push(nf.name);
  }
  cacheSet(key, out);
  return withFrontFaces(out);
}

/** Double-faced cards come back as "Front // Back"; make them findable by the front face too. */
function withFrontFaces(out) {
  for (const k of Object.keys(out.byName)) {
    const front = k.split(" // ")[0];
    if (!out.byName[front]) out.byName[front] = out.byName[k];
  }
  return out;
}

/** Art crop URL for a card object (handles double-faced cards). */
export function artOf(card) {
  const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]);
  return face && face.image_uris ? (face.image_uris.art_crop || face.image_uris.normal) : null;
}

/** One random card matching a query. Never cached: the point is a different card every time. */
export async function randomCard(query) {
  return scheduled(async () => {
    const res = await fetchWithRetry(`${API}/cards/random?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Scryfall ${res.status} for a random card`);
    return res.json();
  });
}

/** Fetch a card by exact-ish name. */
export async function cardNamed(name) {
  return getJSON(`/cards/named?fuzzy=${encodeURIComponent(name)}`, slimCard);
}

/**
 * Fetch an absolute Scryfall URL (used for next_page links). Cached like getJSON, except search pages
 * (`persist: false`): those are ~175 full card objects each, so they live in memory for this visit only.
 */
const memory = new Map();
export async function getURL(url, { persist = true } = {}) {
  const key = url.replace(API, "");
  const cached = persist ? cacheGet(key) : memory.get(key);
  if (cached) return cached;
  return scheduled(async () => {
    const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
    if (res.status === 404) return { data: [], total_cards: 0, has_more: false };
    if (!res.ok) throw new Error(`Scryfall ${res.status}`);
    const json = await res.json();
    if (persist) cacheSet(key, json); else memory.set(key, json);
    return json;
  });
}

/** One page of search results with paging info: { cards, total, nextPage }. */
export async function searchPage(query, { order = "edhrec", dir = "asc" } = {}, nextPageURL = null) {
  const url = nextPageURL || `${API}/cards/search?q=${encodeURIComponent(query)}&order=${order}&dir=${dir}&unique=cards`;
  const json = await getURL(url, { persist: false });
  return { cards: json.data || [], total: json.total_cards || 0, nextPage: json.has_more ? json.next_page : null };
}

/** Cardmarket price in EUR as a number, or null. */
export function priceEUR(card) {
  const p = card.prices && (card.prices.eur || card.prices.eur_foil);
  return p ? Number(p) : null;
}

/** Large card image URL (672×936, front face); falls back to normal. */
export function largeImageOf(card) {
  const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]);
  return face && face.image_uris ? (face.image_uris.large || face.image_uris.normal) : null;
}

/** Normal-size card image URL (front face). */
export function imageOf(card) {
  const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]);
  return face && face.image_uris ? face.image_uris.normal : null;
}

/** Oracle text with the card's own name replaced by ~ (front face + back face). */
export function oracleOf(card) {
  const faces = card.card_faces && card.card_faces.length ? card.card_faces : [card];
  const name = (card.name || "").split(" // ")[0];
  return faces.map(f => (f.oracle_text || "").split(name).join("~")).join("\n//\n");
}

/** Search; returns up to `limit` card objects (first page only). */
export async function search(query, { order = "edhrec", limit = 5, dir = "asc" } = {}) {
  const q = `${query} legal:commander`;
  const path = `/cards/search?q=${encodeURIComponent(q)}&order=${order}&dir=${dir}&unique=cards`;
  try {
    const json = await getJSON(path);
    return { total: json.total_cards || 0, cards: (json.data || []).slice(0, limit) };
  } catch (e) {
    if (String(e.message).includes("404")) return { total: 0, cards: [] };
    throw e;
  }
}

/** Top commanders for a Scryfall type filter, e.g. "t:elf". */
export async function commandersFor(typeFilter, limit = 5) {
  return search(`${typeFilter} is:commander`, { order: "edhrec", limit });
}

/** How many Commander-legal cards match a filter (for the two-piece rule check). */
export async function countMatching(query) {
  const r = await search(query, { limit: 1 });
  return r.total;
}

/** Build a scryfall.com URL a human can open. */
export function webSearchURL(query, order = "edhrec", dir = null) {
  return `https://scryfall.com/search?q=${encodeURIComponent(query)}&order=${order}${dir ? `&dir=${dir}` : ""}`;
}

/** Representative art for a tribe: named card first, then the top commander of that type. */
export async function tribeArt(tribe) {
  try {
    const c = await cardNamed(tribe.art);
    const url = artOf(c);
    if (url) return url;
  } catch { /* fall through */ }
  try {
    const r = await commandersFor(tribe.scry, 1);
    return r.cards[0] ? artOf(r.cards[0]) : null;
  } catch { return null; }
}
