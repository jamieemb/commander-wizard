// Parse an Archidekt text export and resolve the card names against Scryfall.
import { collection, priceEUR } from "./scryfall.js";

// Archidekt category names (any case) -> wizard category keys.
const ALIASES = {
  lands: ["land", "lands", "mana base", "manabase"],
  ramp: ["ramp", "mana", "mana rocks", "rocks", "acceleration"],
  explosive: ["explosive", "explosive ramp", "explosiveramp", "rituals", "burst"],
  draw: ["draw", "card draw", "carddraw", "card advantage", "cards", "advantage"],
  removal: ["removal", "interaction", "targeted", "spot removal", "counterspells", "counters", "answers"],
  mass: ["mass", "mass removal", "massremoval", "board wipes", "board wipe", "wipes", "sweepers", "mass disruption"],
  protection: ["protection", "protect", "defense", "defence"],
  plan: ["plan", "plan cards", "theme", "synergy", "engine", "engines", "payoff", "payoffs", "amplifier", "amplifiers", "win con", "wincon", "wincons", "win conditions", "finisher", "finishers"],
  commander: ["commander"],
  ignore: ["sideboard", "maybeboard", "maybe", "considering"],
};
const ALIAS_LOOKUP = {};
for (const [key, list] of Object.entries(ALIASES)) for (const a of list) ALIAS_LOOKUP[a] = key;
const ALIASES_BY_LENGTH = Object.entries(ALIAS_LOOKUP).sort((a, b) => b[0].length - a[0].length);

export function categoryKey(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (ALIAS_LOOKUP[s]) return ALIAS_LOOKUP[s];
  for (const [alias, key] of ALIASES_BY_LENGTH) if (s.includes(alias)) return key;
  return "other";
}

/**
 * Parse Archidekt (or any) text export.
 * Accepts lines like "1 Arcane Signet", "1x Arcane Signet (cmm) 340 [Ramp,Draw]", "1 Arcane Signet [Ramp{top}]",
 * and bare header lines ("Ramp") that set the category for the lines beneath them.
 * Returns { entries: [{qty, name, cats:[key...], rawCats:[...]}], headers: [...] }.
 */
export function parseDeckText(text) {
  const entries = [];
  const headers = [];
  let current = null;
  for (let raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;
    const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (!m) {
      // header line e.g. "Ramp (12)" or "Ramp"
      const h = line.replace(/\s*\(\d+\)\s*$/, "").trim();
      if (h.length && h.length < 40) { current = h; headers.push(h); }
      continue;
    }
    let rest = m[2];
    const rawCats = [];
    rest = rest.replace(/\[([^\]]*)\]/g, (_, inner) => { inner.split(",").forEach(c => { const cc = c.replace(/\{[^}]*\}/g, "").trim(); if (cc) rawCats.push(cc); }); return ""; });
    rest = rest.replace(/\s*\^[^^]*\^\s*/g, " ");           // Archidekt modifiers like ^Foil^
    rest = rest.replace(/\s*\*[FE]\*\s*/gi, " ");            // *F* foil markers
    rest = rest.replace(/\s+\([a-z0-9]{2,6}\)\s*[\w★-]*\s*$/i, ""); // (set) collector number
    const name = rest.trim();
    if (!name) continue;
    const cats = (rawCats.length ? rawCats : (current ? [current] : [])).map(categoryKey);
    entries.push({ qty: Number(m[1]) || 1, name, cats: Array.from(new Set(cats)), rawCats: rawCats.length ? rawCats : (current ? [current] : []) });
  }
  return { entries, headers };
}

/** Resolve names to Scryfall cards (batched). Returns { byName: {lower name -> card}, notFound: [names] }. */
export async function resolveNames(names) {
  const unique = Array.from(new Set(names.map(n => n.split(" // ")[0].trim()))).filter(Boolean);
  return collection(unique);
}

/** Summarise resolved cards: curve, price, types. `entries` from parseDeckText, `byName` from resolveNames. */
export function summarise(entries, byName) {
  const curve = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let lands = 0, price = 0, unknown = [];
  const cards = [];
  for (const e of entries) {
    if (e.cats.includes("ignore") || e.cats.includes("commander")) continue;
    const card = byName[e.name.split(" // ")[0].trim().toLowerCase()];
    if (!card) { unknown.push(e.name); continue; }
    const isLand = /\bLand\b/.test(card.type_line || "") && !/\/\//.test(card.type_line || "") ? true : (card.type_line || "").startsWith("Land");
    const mv = card.cmc ?? 0;
    for (let i = 0; i < e.qty; i++) {
      if (isLand) lands++;
      else curve[Math.min(6, Math.max(1, Math.round(mv)))]++;
      price += priceEUR(card) || 0;
    }
    cards.push({ ...e, card, mv, isLand, eur: priceEUR(card) });
  }
  return { curve, lands, price, unknown, cards };
}
