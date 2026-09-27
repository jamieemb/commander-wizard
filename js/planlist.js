// The plan list: candidate plan cards gathered in the app, kept with the deck, copied to Archidekt in one go.
// Lives in store.deck.gather.list so it resets with the deck and rides along with everything else saved.
import { store } from "./store.js";
import { imageOf, largeImageOf, priceEUR } from "./scryfall.js";

const front = c => (c.name || "").split(" //")[0];

/** The little we need to show a plan card again without asking Scryfall. */
export function compactPlanCard(c) {
  return {
    id: c.id, name: c.name, front: front(c), image: imageOf(c), large: largeImageOf(c),
    mv: c.cmc ?? 0, eur: priceEUR(c), colors: (c.color_identity || []).join("") || "C",
    typeLine: (c.type_line || (c.card_faces && c.card_faces[0].type_line) || "").split(" //")[0],
    uri: c.scryfall_uri, addedAt: Date.now(),
  };
}

const list = () => { const g = store.deck.gather; if (!Array.isArray(g.list)) g.list = []; return g.list; };

export const planList = {
  list() { return list().slice(); },
  count() { return list().length; },
  has(id) { return list().some(c => c.id === id); },
  /** "added" | "duplicate" */
  add(card) {
    if (this.has(card.id)) return "duplicate";
    store.update(() => list().push(compactPlanCard(card)));
    return "added";
  },
  remove(id) {
    if (!this.has(id)) return false;
    store.update(d => { d.gather.list = list().filter(c => c.id !== id); });
    return true;
  },
  toggle(card) { return this.has(card.id) ? (this.remove(card.id), "removed") : this.add(card); },
  clear() { store.update(d => { d.gather.list = []; }); },
  /** Archidekt import text: one card per line, all in the Plan category. */
  toText() { return list().map(c => `1 ${c.front} [Plan]`).join("\n"); },
  /** Cardmarket total of everything in the list, in EUR. */
  totalEUR() { return list().reduce((n, c) => n + (c.eur || 0), 0); },
  onChange(fn) { return store.onChange(fn); },
};
