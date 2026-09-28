// The deck itself, kept in the app: the two packages, the plan cards gathered in Stage 3, and the basics added last.
// Lives in store.deck.list. A cut card stays in the list with cut: true (so it can be put back) and drops out of every count.
import { store } from "./store.js";
import { CATEGORIES } from "./numbers.js";
import { planList } from "./planlist.js";
import { analyseEntries, TAG_KEYS, BASIC_NAME } from "./deckcheck.js";

export const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.key, c.label]));
CAT_LABEL.plan = "Plan";
export const CAT_KEYS = [...CATEGORIES.map(c => c.key), "plan"];
const KEYS = new Set(CAT_KEYS);
/** Archidekt category names for the export: "Explosive Ramp", "Card Draw", "Mass Removal". */
const exportLabel = k => CAT_LABEL[k].replace(/\b\w/g, ch => ch.toUpperCase());

export const keyOf = name => String(name || "").split(" //")[0].trim().toLowerCase();
const list = () => { const d = store.deck; if (!Array.isArray(d.list)) d.list = []; return d.list; };

export const decklist = {
  all() { return list().slice(); },
  live() { return list().filter(e => !e.cut); },
  get(key) { return list().find(e => e.key === key) || null; },
  has(name) { return list().some(e => e.key === keyOf(name)); },
  count(src) { return list().filter(e => !e.cut && (!src || e.src === src)).reduce((n, e) => n + e.qty, 0); },
  hasPackages() { return list().some(e => e.src === "base") && list().some(e => e.src === "lands"); },

  /** Entries from a parsed export (js/archidekt.js), tagged with where they came from. Names already in the deck are skipped. */
  addEntries(parsed, src) {
    let n = 0;
    store.update(() => {
      for (const e of parsed) {
        if (e.cats.includes("ignore") || e.cats.includes("commander")) continue;
        const key = keyOf(e.name);
        if (!key || list().some(x => x.key === key)) continue;
        const cats = e.cats.filter(k => KEYS.has(k));
        const tags = TAG_KEYS.filter(t => e.rawCats.some(r => r.trim().toLowerCase() === t.toLowerCase()));
        list().push({ key, name: e.name.split(" //")[0].trim(), qty: e.qty || 1, cats: cats.length ? cats : (src === "lands" ? ["lands"] : []), tags, src, cut: false });
        n++;
      }
    });
    return n;
  },

  /** The plan cards mirror the Stage 3 plan list: new ones come in, ones removed there go, cuts and extra jobs stay. */
  syncPlan() {
    const want = new Map(planList.list().map(c => [keyOf(c.front), c]));
    const l = list();
    const kept = l.filter(e => !(e.src === "plan" && !want.has(e.key)));
    for (const [key, c] of want) if (!kept.some(e => e.key === key)) kept.push({ key, name: c.front, qty: 1, cats: ["plan"], tags: [], src: "plan", cut: false });
    if (kept.length !== l.length) store.update(d => { d.list = kept; });
  },

  setCut(key, cut) { store.update(() => { const e = list().find(x => x.key === key); if (e) e.cut = !!cut; }); },
  setCats(key, cats) { store.update(() => { const e = list().find(x => x.key === key); if (e) e.cats = cats.filter(k => KEYS.has(k)); }); },
  remove(key) { store.update(d => { d.list = list().filter(e => e.key !== key); }); },
  removeSrc(src) { store.update(d => { d.list = list().filter(e => e.src !== src); }); },
  clear() { store.update(d => { d.list = []; }); },

  /** Replace the basics with a split like { B: 18, U: 1 } from deckcheck.basicSplit. */
  setBasics(split) {
    store.update(d => {
      const l = list().filter(e => e.src !== "basic");
      for (const [col, n] of Object.entries(split)) if (n > 0) l.push({ key: BASIC_NAME[col].toLowerCase(), name: BASIC_NAME[col], qty: n, cats: ["lands"], tags: [], src: "basic", cut: false });
      d.list = l;
    });
  },
  basics() { return list().filter(e => e.src === "basic").reduce((n, e) => n + e.qty, 0); },

  /** The live entries in the shape deckcheck reads: category keys, plus the labels and tags as raw categories. */
  entries(includeCut = false) {
    return list().filter(e => includeCut || !e.cut).map(e => ({ qty: e.qty, name: e.name, cats: e.cats.slice(), rawCats: [...e.cats.map(k => CAT_LABEL[k]), ...e.tags] }));
  },
  /** The same report Stages 4 and 5 used to get from a pasted export, now from the list. */
  analyse() { return analyseEntries(this.entries()); },

  /** Export text. "archidekt": categories and tags in brackets, commander on top; "moxfield": one plain line per card. */
  toText(format = "archidekt") {
    const c = store.deck.commander.chosen, lines = [];
    const name = c ? c.name.split(" //")[0] : "";
    if (c) lines.push(format === "archidekt" ? `1 ${name} [Commander{top}]` : `1 ${name}`);
    for (const e of this.live()) {
      const cats = [...e.cats.map(exportLabel), ...e.tags];
      lines.push(format === "archidekt" && cats.length ? `${e.qty} ${e.name} [${cats.join(",")}]` : `${e.qty} ${e.name}`);
    }
    return lines.join("\n");
  },
};
