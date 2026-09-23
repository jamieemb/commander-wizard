// Colour helpers shared by every screen: pips, escaping, colour words, identity lookup, and the Scryfall commander search builder.
import { IDENTITIES, COLOR_NAMES } from "../data/colors.js";

export function pips(colors) {
  return `<span class="pips">${[...(colors || "")].map(c => `<span class="pip ${c}" title="${COLOR_NAMES[c]}"></span>`).join("")}</span>`;
}
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
export function colourWords(colors) { return [...(colors || "")].map(c => COLOR_NAMES[c]).join(", "); }

/** The identity record for a WUBRG string (order-insensitive), or null. */
export function identityFor(colors) {
  const key = [...(colors || "C")].sort().join("");
  return IDENTITIES.find(t => [...t.colors].sort().join("") === key) || null;
}

/** How the commander list is ordered. */
export const SORTS = [
  { key: "edhrec", label: "Popular", phrase: "most-played", order: "edhrec", dir: null },
  { key: "eur", label: "Cheapest", phrase: "cheapest", order: "eur", dir: "asc" },
];

/**
 * What a commander does by itself, as Scryfall filters. Built from Scryfall's oracle tags (otag:), checked
 * against the commander pool in September 2026: parent tags already include some children (removal covers
 * creature removal, edicts and board wipes; card-advantage covers draw, impulse draw, wheels, rummaging;
 * ramp covers dorks, land ramp, extra lands, doublers) but not others, which are added explicitly.
 * No oracle tag exists for token making or Treasure, so those use rules text.
 */
export const JOBS = [
  { key: "mv4", label: "MV ≤ 4", phrase: "cost 4 or less", q: "mv<=4" },
  { key: "mana", label: "Makes mana", phrase: "make mana", q: "(otag:ramp or otag:cost-reducer or otag:untapper or o:treasure)" },
  { key: "draw", label: "Draws cards", phrase: "draw cards", q: "otag:card-advantage" },
  { key: "tutor", label: "Tutors", phrase: "tutor", q: "otag:tutor" },
  { key: "tokens", label: "Makes tokens", phrase: "make tokens", q: "((o:create o:token) or otag:token-doubler)" },
  { key: "removal", label: "Removes things", phrase: "remove things", q: "(otag:removal or otag:burn or otag:bounce or otag:tapper or otag:counterspell)" },
  { key: "wipe", label: "Wipes the board", phrase: "wipe the board", q: "otag:board-wipe" },
  { key: "protects", label: "Protects itself", phrase: "protect themselves", q: "(kw:hexproof or kw:indestructible or kw:ward or kw:shroud or o:regenerate or o:\"phase out\")" },
  { key: "recursion", label: "Brings things back", phrase: "bring things back", q: "otag:recursion" },
  { key: "each", label: "Hits each opponent", phrase: "hit each opponent", q: "o:\"each opponent\"" },
  { key: "drain", label: "Drains life", phrase: "drain life", q: "(otag:life-drain or o:\"each opponent loses\")" },
  { key: "wide", label: "Goes wide", phrase: "go wide", q: "(otag:anthem or otag:overrun)" },
  { key: "copy", label: "Copies things", phrase: "copy things", q: "otag:copy" },
  { key: "theft", label: "Steals things", phrase: "steal things", q: "otag:theft" },
  { key: "sac", label: "Sacrifice outlet", phrase: "sacrifice for value", q: "otag:sacrifice-outlet" },
  { key: "tax", label: "Taxes the table", phrase: "tax the table", q: "(otag:tax or otag:hatebear or otag:pillow-fort)" },
  { key: "hug", label: "Group hug", phrase: "hug the table", q: "otag:group-hug" },
  { key: "partner", label: "Partner", phrase: "have a partner", q: "(kw:partner or o:\"choose a background\" or o:\"friends forever\" or o:\"doctor's companion\")" },
];

/** The Scryfall query for an identity's commanders with the chosen jobs (AND-ed). */
export function commanderQuery(t, jobKeys = []) {
  const parts = [`id=${t.colors.toLowerCase()}`, "is:commander", ...JOBS.filter(j => jobKeys.includes(j.key)).map(j => j.q)];
  return parts.join(" ");
}
