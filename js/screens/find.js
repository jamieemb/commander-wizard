// Screen A: Find a commander. Tabs by colour count, sort + job chips, a compact card per identity.
// Clicking an identity opens the browse dialog: a carousel of that identity's commanders, swipeable into the shortlist.
import { IDENTITIES, TABS } from "../data/colors.js";
import { webSearchURL, collection, artOf } from "../scryfall.js";
import { pips, esc, SORTS, JOBS, commanderQuery } from "../sections/colours.js";
import { openBrowse } from "./browse.js";
import { startPractice } from "../practice.js";

const STATE_KEY = "cw:find";

// One batched Scryfall request for the 32 representative cards; cached in localStorage by the client.
let artPromise = null;
function identityArt() {
  if (!artPromise) {
    artPromise = collection(IDENTITIES.map(t => t.art)).then(({ byName }) => {
      const out = {};
      for (const t of IDENTITIES) { const card = byName[t.art.toLowerCase()]; const url = card && artOf(card); if (url) out[t.id] = url; }
      return out;
    }).catch(() => ({}));
  }
  return artPromise;
}

function joinPhrases(list) {
  if (list.length <= 1) return list.join("");
  return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
}

export function renderFind(root) {
  let state = { tab: "two", sort: "edhrec", jobs: [] };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(STATE_KEY) || "{}") }; } catch {}
  if (!TABS.some(t => t.key === state.tab)) state.tab = "two";
  if (!SORTS.some(s => s.key === state.sort)) state.sort = "edhrec";
  state.jobs = (state.jobs || []).filter(k => JOBS.some(j => j.key === k));
  const save = () => { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {} };
  let art = {};

  root.innerHTML = `
    <div class="find">
      <h1 class="sr-only">Find a commander</h1>
      <div class="stepper-row"><nav class="tabs" id="find-tabs" aria-label="Colour count"></nav><button type="button" class="btn text small stepper-reset find-practice" id="find-practice" title="Practice: a random commander in a fresh deck, then the wizard from Stage 1">🎲 Practice</button></div>
      <div class="chip-row scroll" id="find-filters"></div>
      <p class="helper" id="find-note"></p>
      <div class="ident-grid" id="find-cards"></div>
    </div>`;

  const tabsEl = root.querySelector("#find-tabs");
  const practiceBtn = root.querySelector("#find-practice");
  practiceBtn.addEventListener("click", async () => {
    practiceBtn.disabled = true; practiceBtn.textContent = "Rolling…";
    try { await startPractice(); }
    catch { practiceBtn.textContent = "Scryfall didn't answer"; setTimeout(() => { practiceBtn.textContent = "🎲 Practice"; practiceBtn.disabled = false; }, 1800); }
  });
  const filtersEl = root.querySelector("#find-filters");
  const cardsEl = root.querySelector("#find-cards");
  const noteEl = root.querySelector("#find-note");

  const sort = () => SORTS.find(s => s.key === state.sort);
  const jobs = () => JOBS.filter(j => state.jobs.includes(j.key));
  const describe = () => `${sort().phrase} commanders${jobs().length ? ` that ${joinPhrases(jobs().map(j => j.phrase))}` : ""}`;

  function renderTabs() {
    tabsEl.innerHTML = TABS.map(t => `<button class="tab ${t.key === state.tab ? "active" : ""}" role="tab" data-tab="${t.key}" aria-selected="${t.key === state.tab}">${esc(t.label)}</button>`).join("");
    tabsEl.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { state.tab = b.dataset.tab; save(); renderTabs(); renderCards(); }));
  }
  function renderFilters() {
    filtersEl.innerHTML =
      `<span role="radiogroup" aria-label="Order" class="chip-group">${SORTS.map(s => `<button class="chip ${s.key === state.sort ? "selected" : ""}" role="radio" aria-checked="${s.key === state.sort}" data-sort="${s.key}">${esc(s.label)}</button>`).join("")}</span>` +
      `<span class="chip-sep" aria-hidden="true"></span>` +
      `<span class="chip-group" aria-label="What the commander does">${JOBS.map(j => { const on = state.jobs.includes(j.key); return `<button class="chip ${on ? "selected" : ""}" aria-pressed="${on}" data-job="${j.key}">${esc(j.label)}</button>`; }).join("")}</span>`;
    filtersEl.querySelectorAll("[data-sort]").forEach(b => b.addEventListener("click", () => { state.sort = b.dataset.sort; save(); renderFilters(); renderCards(); }));
    filtersEl.querySelectorAll("[data-job]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.job;
      state.jobs = state.jobs.includes(k) ? state.jobs.filter(x => x !== k) : [...state.jobs, k];
      save(); renderFilters(); renderCards();
    }));
  }
  function applyArt() {
    cardsEl.querySelectorAll(".ident-art[data-id]").forEach(el => {
      const url = art[el.dataset.id];
      if (url && !el.querySelector("img")) el.innerHTML = `<img src="${url}" alt="" loading="lazy" decoding="async">`;
    });
  }
  function renderCards() {
    const t = TABS.find(x => x.key === state.tab);
    noteEl.innerHTML = `Tap an identity to flick through its ${esc(describe())}.` +
      (jobs().length ? ` <button type="button" class="linkish" id="find-clear">Clear filters</button>` : "");
    const clear = noteEl.querySelector("#find-clear");
    if (clear) clear.addEventListener("click", () => { state.jobs = []; save(); renderFilters(); renderCards(); });
    cardsEl.innerHTML = IDENTITIES.filter(i => t.groups.includes(i.group)).map(i => `
      <a class="ident-card" href="${webSearchURL(commanderQuery(i, state.jobs), sort().order, sort().dir)}" target="_blank" rel="noopener" data-id="${i.id}">
        <div class="ident-art" data-id="${i.id}"></div>
        <div class="ident-body">
          <div class="ident-head">${pips(i.colors)}<span class="ident-name">${esc(i.name)}</span><span class="ident-code">${esc(i.colors)}</span></div>
          <p class="ident-wants">${esc(i.wants)}</p>
          <p class="ident-plays">${esc(i.plays)}</p>
        </div>
      </a>`).join("");
    cardsEl.querySelectorAll(".ident-card").forEach(a => a.addEventListener("click", e => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;   // modified clicks still open Scryfall itself
      e.preventDefault();
      const identity = IDENTITIES.find(i => i.id === a.dataset.id);
      openBrowse({ identity, query: commanderQuery(identity, state.jobs), order: sort().order, dir: sort().dir, describe: describe() });
    }));
    applyArt();
  }

  renderTabs(); renderFilters(); renderCards();
  identityArt().then(map => { art = map; if (root.contains(cardsEl)) applyArt(); });
}
