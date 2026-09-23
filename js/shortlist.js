// The shortlist: commanders the user likes the sound of, kept in this browser until they pick one.
// Not tied to a deck, because it exists before the deck does.
import { imageOf, largeImageOf, priceEUR, collection, purgeCache } from "./scryfall.js";
import { analyse } from "./reading.js";

const KEY = "cw:shortlist";
export const PENDING_KEY = "cw:pendingCommander";   // Stage 1 looks this name up on arrival
const listeners = new Set();

function load() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
/** Write the list; if the browser's storage is full, drop the Scryfall caches and try once more. Returns false if it still failed. */
function save(list) {
  const json = JSON.stringify(list);
  try { localStorage.setItem(KEY, json); }
  catch {
    purgeCache();
    try { localStorage.setItem(KEY, json); } catch (e) { console.warn("Commander Wizard: could not save the shortlist", e); return false; }
  }
  listeners.forEach(fn => fn(list));
  return true;
}

/** The little we need to show a shortlisted card again without asking Scryfall. */
export function compactCard(c) {
  const a = analyse(c);
  return {
    id: c.id, name: c.name, front: (c.name || "").split(" //")[0], image: imageOf(c), large: largeImageOf(c),
    mv: c.cmc ?? 0, eur: priceEUR(c), colors: (c.color_identity || []).join("") || "C",
    typeLine: (c.type_line || "").split(" //")[0], uri: c.scryfall_uri, addedAt: Date.now(),
    rank: c.edhrec_rank ?? null,            // EDHREC popularity rank, lower is more played
    scales: a.scales === "good",            // rules text hits each opponent / every player
    protects: a.protects,                   // hexproof, ward, indestructible and friends
  };
}
/** Entries saved before rank / scaling / protection were recorded. */
const stale = c => c.rank === undefined || c.scales === undefined || c.protects === undefined;

export const shortlist = {
  list() { return load(); },
  count() { return load().length; },
  has(id) { return load().some(c => c.id === id); },
  /** "added" | "duplicate" | "full" */
  add(card) { const l = load(); if (l.some(c => c.id === card.id)) return "duplicate"; l.push(compactCard(card)); return save(l) ? "added" : "full"; },
  remove(id) { const l = load(); if (!l.some(c => c.id === id)) return false; save(l.filter(c => c.id !== id)); return true; },
  clear() { save([]); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Fill in rank / scaling / protection for older entries with one batched Scryfall call. Resolves true if anything changed. */
  async backfill() {
    const l = load(), todo = l.filter(stale);
    if (!todo.length) return false;
    const { byName } = await collection(todo.map(c => c.front));
    let changed = false;
    for (const c of l) {
      if (!stale(c)) continue;
      const card = byName[c.front.toLowerCase()] || byName[(c.name || "").toLowerCase()];
      if (!card) continue;
      Object.assign(c, { ...compactCard(card), id: c.id, addedAt: c.addedAt });
      changed = true;
    }
    if (changed) save(l);
    return changed;
  },
};

/** Hand a commander name to the Deck Builder: Stage 1 looks it up as soon as it renders. */
export function useInDeckBuilder(name) {
  try { sessionStorage.setItem(PENDING_KEY, name); } catch {}
  location.hash = "#wizard/1";
}
