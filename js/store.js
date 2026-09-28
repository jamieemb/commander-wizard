// Wizard state, persisted per deck in localStorage.

const KEY = "cw:decks";
const CURRENT = "cw:currentDeck";

const blankDeck = () => ({
  name: "",
  practice: false,        // a practice rep: random commander, built for the repetitions
  createdAt: null,
  savedAt: null,          // ISO time of the last save, for the "Saved in this browser · HH:MM" note
  currentStage: 1,
  completed: {},
  // Stage 1: colours, commander, aim
  colours: { colorId: null, colors: "", colorName: "", notes: "" },
  commander: {
    identityMode: "exact",     // "exact" = id=..., "within" = id<=...
    sort: "edhrec",
    jobs: [],                  // quick filters: mana, cards, tokens, removal, protects
    mvMax: null,
    partner: false,
    text: "",
    shortlist: [],
    chosen: null,              // compact card summary + what was read from its text
    role: "",                  // engine | amplifier | payoff | helper
    timing: "",                // setup | finisher
    keywords: [],
    checks: { notMean: false },
    notes: "",
  },
  aim: {
    theme: "", does: "", capitalises: "", wins: "",
    rarerType: "", rarerCount: null,
    checks: { twoPiece: false, table: false, pilot: false },
    notes: "",
  },
  // Stage 2: numbers
  numbers: {
    bracket: 2,
    forCommander: null, // chosen.id the auto numbers were computed for; a change recomputes them
    targets: {},        // category key -> number
    because: {},        // category key -> reason
    nonBasics: null,    // how many of the lands are non-basic (default: half)
    turnPlan: { t2: "", t3: "", t4: "" },
    notes: "",
  },
  // Stage 3: plan cards
  gather: { packagesAdded: false, list: [], searched: [], pasted: "", lastReport: null, notes: "" },   // list: plan cards gathered in the app (js/planlist.js); searched: generated searches already clicked through
  // Stages 4 and 5: cutting
  cut: { pasted4: "", report4: null, notes4: "", pasted5: "", report5: null, notes5: "" },
  // The deck itself (js/decklist.js): packages, plan cards and basics, each with its jobs, tags and cut flag
  list: [],
});

/** What a deck is called in the picker: its own name, else its commander, else "New deck". */
export function deckName(d) {
  return d.name || (d.commander && d.commander.chosen && d.commander.chosen.name.split(" //")[0]) || "New deck";
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

export const store = {
  deckId: null,
  deck: null,
  listeners: new Set(),

  init() {
    let id = null;
    try { id = localStorage.getItem(CURRENT); } catch {}
    const all = loadAll();
    if (!id || !all[id]) {
      id = "deck-" + Date.now().toString(36);
      all[id] = blankDeck();
      saveAll(all);
      try { localStorage.setItem(CURRENT, id); } catch {}
    }
    this.deckId = id;
    this.deck = deepMerge(blankDeck(), all[id]);
    return this.deck;
  },

  save() {
    this.deck.savedAt = new Date().toISOString();
    const all = loadAll();
    all[this.deckId] = this.deck;
    saveAll(all);
    this.listeners.forEach(fn => fn(this.deck));
  },

  update(mutator) { mutator(this.deck); this.save(); },

  reset() {
    const all = loadAll();
    all[this.deckId] = blankDeck();
    saveAll(all);
    this.deck = blankDeck();
    this.listeners.forEach(fn => fn(this.deck));
  },

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },

  /** Every deck saved in this browser, most recently saved first. */
  decks() {
    const all = loadAll();
    return Object.entries(all)
      .map(([id, d]) => ({ id, name: deckName(d), practice: !!d.practice, savedAt: d.savedAt || "", createdAt: d.createdAt || "", current: id === this.deckId }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  },
  /** A fresh deck, made current. `init(deck)` may fill it in (a chosen commander, say) before the first save. */
  create({ practice = false } = {}, init) {
    const all = loadAll();
    const id = "deck-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const d = blankDeck();
    d.practice = practice; d.createdAt = new Date().toISOString();
    if (init) init(d);
    d.savedAt = new Date().toISOString();
    all[id] = d; saveAll(all);
    try { localStorage.setItem(CURRENT, id); } catch {}
    this.deckId = id; this.deck = d;
    this.listeners.forEach(fn => fn(this.deck));
    return id;
  },
  switchTo(id) {
    const all = loadAll();
    if (!all[id]) return false;
    try { localStorage.setItem(CURRENT, id); } catch {}
    this.deckId = id; this.deck = deepMerge(blankDeck(), all[id]);
    this.listeners.forEach(fn => fn(this.deck));
    return true;
  },
  /** Delete a deck. Deleting the current one moves to the most recent other deck, or a blank one. */
  remove(id) {
    const all = loadAll();
    delete all[id]; saveAll(all);
    if (id !== this.deckId) return;
    const next = Object.entries(all).sort((a, b) => (b[1].savedAt || "").localeCompare(a[1].savedAt || ""))[0];
    if (next) this.switchTo(next[0]);
    else { try { localStorage.removeItem(CURRENT); } catch {} this.deckId = null; this.init(); this.listeners.forEach(fn => fn(this.deck)); }
  },

  exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), deck: this.deck }, null, 2);
  },
};

function deepMerge(base, over) {
  if (Array.isArray(base) || typeof base !== "object" || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = (typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k]))
      ? deepMerge(base[k], over[k])
      : over[k];
  }
  return out;
}
