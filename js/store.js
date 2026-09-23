// Wizard state, persisted per deck in localStorage.

const KEY = "cw:decks";
const CURRENT = "cw:currentDeck";

const blankDeck = () => ({
  name: "",
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
  gather: { packagesAdded: false, pasted: "", lastReport: null, notes: "" },
  // Stages 4 and 5: cutting
  cut: { pasted4: "", report4: null, notes4: "", pasted5: "", report5: null, notes5: "" },
});

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
