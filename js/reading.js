// Reading a commander's rules text: the jobs it does by itself, whether it scales against three opponents,
// whether it protects itself, whether the table will hate it, and the key words for the plan-card searches.
// No DOM, no storage: shared by Stage 1 and the shortlist.
import { oracleOf } from "./scryfall.js";

// ---------- reading a commander's text ----------
const JOB_TESTS = [
  { key: "mana", label: "makes mana", re: /add \{|treasure token|add (one|two|three) mana|mana of any|costs? \{?\d?\}? ?less to cast|cost \{\d\} less|pay \d+ life rather than pay|phyrexian mana/i },
  { key: "cards", label: "draws cards", re: /draw (a|two|three|x|that many) cards?|draws? a card|look at the top|exile the top .* you may (play|cast)/i },
  { key: "tokens", label: "makes tokens", re: /create .*token/i },
  { key: "removal", label: "removes things", re: /destroy target|exile target|deals? \d+ damage to (any target|target|each)|sacrifices? a (creature|permanent)|fights? /i },
  { key: "recursion", label: "brings things back", re: /return .* from your graveyard|from your graveyard to/i },
];
const SCALE_GOOD = /each opponent|each player|whenever an? (creature|player|opponent|artifact|land|nontoken)|opponents? (control|cast|casts)|whenever another/i;
const SCALE_WEAK = /whenever ~ attacks|target opponent|once each turn|only during your turn|whenever you attack/i;
const PROTECT_RE = /hexproof|ward|indestructible|shroud|can't be countered|return (it|~) to (its owner's|your) hand|regenerate|phase out/i;
const MEAN_RE = /gain control of|steal|can't cast spells|can't untap|skip (their|your|each)|doesn't untap|opponents can't/i;
const KEYWORD_CANDIDATES = [
  "enters", "leaves the battlefield", "attacks", "dies", "sacrifice", "token", "+1/+1 counter", "counter",
  "draw", "discard", "graveyard", "exile", "cast", "instant", "sorcery", "noncreature spell", "artifact", "enchantment",
  "equipment", "aura", "land", "landfall", "treasure", "food", "clue", "lifelink", "gain life", "lose life", "damage",
  "flying", "haste", "trample", "menace", "deathtouch", "copy", "mill", "tap", "untap", "goad", "proliferate", "monarch",
  "end step", "upkeep", "combat", "blocks", "each opponent", "legendary", "historic", "planeswalker", "modified", "energy",
];
/** Subtypes from the type line, lower-cased: "Legendary Creature — Tiefling Warlock" → ["tiefling", "warlock"]. */
function subtypesOf(card) {
  const faces = card.card_faces && card.card_faces.length ? card.card_faces : [card];
  const out = [];
  for (const f of faces) for (const part of (f.type_line || card.type_line || "").split(" // ")) {
    const sub = part.split("—")[1];
    if (sub) for (const w of sub.trim().split(/\s+/)) { const k = w.toLowerCase(); if (k && !out.includes(k)) out.push(k); }
  }
  return out;
}
export function analyse(card) {
  const o = oracleOf(card);
  const jobs = JOB_TESTS.filter(j => j.re.test(o)).map(j => j.key);
  const scales = SCALE_GOOD.test(o) ? "good" : SCALE_WEAK.test(o) ? "weak" : "unclear";
  const ol = o.toLowerCase();
  const keywords = KEYWORD_CANDIDATES.filter(k => ol.includes(k));
  for (const t of subtypesOf(card)) if (!keywords.includes(t)) keywords.push(t);
  return { jobs, scales, protects: PROTECT_RE.test(o), mean: MEAN_RE.test(o), mv: card.cmc ?? 0, keywords };
}
export const JOB_LABEL = Object.fromEntries(JOB_TESTS.map(j => [j.key, j.label]));
