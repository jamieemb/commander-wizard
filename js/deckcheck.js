// Turn a pasted Archidekt export into the numbers the cutting stages need.
import { parseDeckText, resolveNames } from "./archidekt.js";
import { priceEUR } from "./scryfall.js";
import { CATEGORIES } from "./numbers.js";

export const TAG_KEYS = ["GC", "Power", "Upgrade"];
export const BASIC_NAME = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" };

const faces = card => (card.card_faces && card.card_faces.length ? card.card_faces : [card]);
// A land is a land on its front face, or a modal double-faced card with a land on the back (you can always play those as a land).
// Transform cards whose back face is a land (Treasure Map) are not lands.
const isLandCard = card => /\bLand\b/.test(faces(card)[0].type_line || "") || (card.layout === "modal_dfc" && faces(card).some(f => /\bLand\b/.test(f.type_line || "")));
const isBasicCard = card => /\bBasic\b/.test(card.type_line || "") && /\bLand\b/.test(card.type_line || "");
function pipsOf(card) {
  const out = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const f of faces(card)) for (const m of (f.mana_cost || "").matchAll(/\{([^}]+)\}/g)) for (const ch of m[1].split("/")) if (out[ch] !== undefined) out[ch]++;
  return out;
}

/**
 * Parse + resolve + count a pasted export. Returns a plain object safe to store.
 * counts: per category (a card tagged twice counts in both). total: cards excluding commander/sideboard.
 */
export async function analyseDeck(text) {
  const { entries, headers } = parseDeckText(text);
  return analyseEntries(entries, headers);
}

/** The same count from entries already parsed: { qty, name, cats: [category keys], rawCats: [labels and tags] }. The in-app deck list uses this. */
export async function analyseEntries(entries, headers = []) {
  const live = entries.filter(e => !e.cats.includes("ignore") && !e.cats.includes("commander"));
  let byName = {}, scryfallOk = true;
  if (live.length) { try { ({ byName } = await resolveNames(live.map(e => e.name))); } catch { scryfallOk = false; } }

  const counts = Object.fromEntries([...CATEGORIES.map(x => x.key), "plan"].map(k => [k, 0]));
  const single = { ...counts }; // cards whose ONLY category is k; two-job cards are the slack the template relies on
  const tags = { GC: 0, Power: 0, Upgrade: 0 }, tagged = { GC: [], Power: [], Upgrade: [] };
  const curve = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const pips = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let total = 0, uncategorised = 0, twoJobs = 0, nonbasics = 0, basics = 0, price = 0, sixPlus = 0;
  const unknown = [], cards = [], uncategorisedNames = [];

  for (const e of live) {
    const card = byName[e.name.split(" // ")[0].trim().toLowerCase()] || null;
    if (!card && scryfallOk) unknown.push(e.name);
    const known = e.cats.filter(k => counts[k] !== undefined);
    const isLand = card ? isLandCard(card) : known.includes("lands");
    const isBasic = card ? isBasicCard(card) : false;
    const mv = card ? (card.cmc ?? 0) : null;
    total += e.qty;
    if (!known.length) { uncategorised += e.qty; uncategorisedNames.push(e.name); }
    for (const k of known) counts[k] += e.qty;
    if (known.length === 1) single[known[0]] += e.qty;
    if (known.length > 1) twoJobs += e.qty;
    for (const t of TAG_KEYS) if (e.rawCats.some(r => r.trim().toLowerCase() === t.toLowerCase())) { tags[t] += e.qty; tagged[t].push(e.name); }
    if (isLand) { if (isBasic) basics += e.qty; else nonbasics += e.qty; }
    else if (card) {
      curve[Math.min(6, Math.max(1, Math.round(mv)))] += e.qty;
      if (mv >= 6) sixPlus += e.qty;
      const p = pipsOf(card); for (const c in p) pips[c] += p[c] * e.qty;
    }
    if (card) price += (priceEUR(card) || 0) * e.qty;
    const oracle = card ? faces(card).map(f => f.oracle_text || "").join("\n") : "";
    const tapped = isLand && /enters(?: the battlefield)? tapped/i.test(oracle) ? (/unless|if you|as long as|if it|if there|choose/i.test(oracle) ? "maybe" : "yes") : false;
    const face = card ? faces(card)[0] : null;
    cards.push({ name: e.name, qty: e.qty, cats: e.cats, rawCats: e.rawCats, mv, isLand, isBasic, tapped, typeLine: face ? (face.type_line || card.type_line || "") : "", large: face && face.image_uris ? (face.image_uris.large || face.image_uris.normal || "") : "" });
  }
  return { headers, total, counts, single, uncategorised, uncategorisedNames, twoJobs, tags, tagged, curve, sixPlus, pips, nonbasics, basics, lands: nonbasics + basics, price, unknown, scryfallOk, cards };
}

/**
 * Is category k at its number? Two-job cards may push the count over the target; that is the overlap the
 * template relies on, so only one-job cards are held to the number.
 * Returns { state: "ok"|"over"|"under", cut, short, bonus }.
 */
export function categoryState(report, k, target) {
  const have = report.counts[k], one = (report.single || {})[k] ?? have; // reports saved before `single` existed
  if (have < target) return { state: "under", cut: 0, short: target - have, bonus: 0 };
  if (one > target) return { state: "over", cut: one - target, short: 0, bonus: have - one };
  return { state: "ok", cut: 0, short: 0, bonus: have - target };
}

/** Split n basics across the deck's colours in proportion to pips (largest remainder; every used colour gets at least one). */
export function basicSplit(pips, n, colors) {
  const cols = [...(colors || "")].filter(c => "WUBRG".includes(c));
  if (n <= 0) return {};
  if (!cols.length) return { C: n };
  const tot = cols.reduce((s, c) => s + (pips[c] || 0), 0);
  const rows = cols.map(c => ({ c, exact: tot ? n * (pips[c] || 0) / tot : n / cols.length }));
  const out = {}; let used = 0;
  for (const r of rows) { out[r.c] = Math.floor(r.exact); used += out[r.c]; }
  rows.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  for (let i = 0; used < n; i = (i + 1) % rows.length) { out[rows[i].c]++; used++; }
  if (n >= cols.length) for (const c of cols) if (!out[c]) { const big = cols.reduce((a, b) => (out[a] >= out[b] ? a : b)); out[big]--; out[c] = 1; }
  return out;
}
