// Router: hash-routed screens. #find (the default) = browse colour identities; #shortlist; #wizard[/N] = the five stages.
import { store } from "./store.js";
import { renderFind } from "./screens/find.js";
import { renderShortlist } from "./screens/shortlist.js";
import { shortlist } from "./shortlist.js";
import { purgeCache, storageBytes } from "./scryfall.js";
import { renderStage1 } from "./stages/stage1.js";
import { renderStage2 } from "./stages/stage2.js";
import { renderStage3 } from "./stages/stage3.js";
import { renderStage4 } from "./stages/stage4.js";
import { renderStage5 } from "./stages/stage5.js";
import { armTinder } from "./screens/tinder.js";

export const STAGES = [
  { n: 1, title: "Commander", time: "30–40 min", render: renderStage1 },
  { n: 2, title: "Numbers", time: "5 min", render: renderStage2 },
  { n: 3, title: "Plan cards", time: "30–60 min", render: renderStage3 },
  { n: 4, title: "Cut packages", time: "30 min", render: renderStage4 },
  { n: 5, title: "Cut to 99", time: "30 min", render: renderStage5 },
];

const root = document.getElementById("root");

/** Parse the hash: {screen: "find"|"wizard", stage}. Legacy #stage-N still works. */
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h === "shortlist") return { screen: "shortlist" };
  if (h === "wizard" || h.startsWith("wizard/") || h.startsWith("stage-")) {
    const m = h.match(/^wizard\/(\d+)/) || h.match(/^stage-(\d+)/);
    const n = m ? Number(m[1]) : (store.deck.currentStage || 1);
    return { screen: "wizard", stage: STAGES.some(s => s.n === n) ? n : 1 };
  }
  return { screen: "find" };   // the front door: no hash, #find, or anything unknown
}

export function goToStage(n) {
  store.update(d => { d.currentStage = n; });
  location.hash = `#wizard/${n}`;
}

function renderStepper(active) {
  const row = document.createElement("div");
  row.className = "stepper-row";
  const nav = document.createElement("nav");
  nav.className = "tabs stepper";
  nav.setAttribute("aria-label", "Stages");
  for (const s of STAGES) {
    const el = document.createElement("button");
    const done = !!store.deck.completed[s.n];
    el.className = "tab" + (s.n === active ? " active" : "") + (done ? " done" : "");
    el.setAttribute("role", "tab");
    el.setAttribute("aria-selected", String(s.n === active));
    el.innerHTML = `<span class="tab-n">${done && s.n !== active ? "✓" : s.n}</span>${s.title}`;
    el.title = `${s.title} (${s.time})`;
    el.addEventListener("click", () => goToStage(s.n));
    nav.appendChild(el);
  }
  row.appendChild(nav);
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "btn text small stepper-reset";
  reset.title = "Clear everything entered for this deck and start again at Stage 1";
  reset.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 2.97-2.17 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93 0-4.42-3.58-8-8-8zm-6 8c0-1.65.67-3.15 1.76-4.24L6.34 7.34A8.014 8.014 0 0 0 4 13c0 4.08 3.05 7.44 7 7.93v-2.02c-2.83-.48-5-2.94-5-5.91z"/></svg>Reset`;
  reset.addEventListener("click", () => {
    if (!confirm("Clear everything entered for this deck and start again at Stage 1?")) return;
    store.reset();
    location.hash = "#wizard/1";
    render();
    refreshSaveNotes();
  });
  row.appendChild(reset);
  return row;
}

function render() {
  const r = route();
  root.innerHTML = "";
  document.body.dataset.screen = r.screen;
  document.querySelectorAll(".nav-item").forEach(a => { const on = a.dataset.screen === r.screen; a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  window.scrollTo(0, 0);
  if (r.screen === "find") { renderFind(root); return; }
  if (r.screen === "shortlist") { renderShortlist(root); return; }
  root.appendChild(renderStepper(r.stage));
  const stage = document.createElement("div");
  stage.className = "stage";
  root.appendChild(stage);
  STAGES.find(s => s.n === r.stage).render(stage, { goToStage });
}

/** "Saved in this browser · HH:MM" from the deck's last save, or "Nothing saved yet". */
export function saveNote() {
  const t = store.deck.savedAt ? new Date(store.deck.savedAt) : null;
  return t ? `Saved in this browser · ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}` : "Nothing saved yet";
}
// Only refresh spans that are showing the save note; a stage's own status message ("3 categories still over…") must not be clobbered.
const isSaveNote = t => !t || /^Saved in this browser|^Nothing saved yet/.test(t);
function refreshSaveNotes() { document.querySelectorAll("[data-save-note]").forEach(el => { if (isSaveNote(el.textContent)) el.textContent = saveNote(); }); }
export function markDirty() {
  clearTimeout(markDirty._t);
  markDirty._t = setTimeout(refreshSaveNotes, 300);
}

// --- theme: light by default, dark on request, remembered in this browser ---
const themeBtn = document.getElementById("theme-toggle");
function applyTheme(theme) {
  if (theme === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  themeBtn.setAttribute("aria-label", label); themeBtn.title = label;
  try { localStorage.setItem("cw:theme", theme); } catch {}
}
themeBtn.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

// --- shortlist count on its navigation destination ---
function refreshShortlistBadge() {
  const b = document.getElementById("nav-shortlist-count");
  if (!b) return;
  const n = shortlist.count(); b.textContent = n; b.hidden = !n;
}
shortlist.onChange(refreshShortlistBadge);
refreshShortlistBadge();

// --- boot ---
// Housekeeping: an earlier build cached whole search pages in localStorage; they crowd out the deck and shortlist.
purgeCache("/cards/search");
if (storageBytes() > 2.5 * 1024 * 1024) purgeCache();
store.init();
window.addEventListener("hashchange", render);
render();
armTinder();   // the hidden phone-only toy: five quick taps on the wordmark
refreshSaveNotes();
