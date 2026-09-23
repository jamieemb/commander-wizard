// Screen: the shortlist. Every commander swiped up while browsing, with sorting, filters, grouping by identity,
// trait indicators (scales against three opponents, protects itself) and a way into the Deck Builder.
import { shortlist, useInDeckBuilder } from "../shortlist.js";
import { bindPeek } from "../peek.js";
import { pips, esc, identityFor } from "../sections/colours.js";
import { cardNamed, oracleOf } from "../scryfall.js";
import { traitIcons } from "../traits.js";

const VIEW_KEY = "cw:shortlistView";
const SORTS = [
  { key: "rank", label: "EDH rank", cmp: (a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) },
  { key: "eur", label: "Price", cmp: (a, b) => (a.eur ?? 1e9) - (b.eur ?? 1e9) || (a.rank ?? 1e9) - (b.rank ?? 1e9) },
  { key: "mv", label: "Mana value", cmp: (a, b) => a.mv - b.mv || (a.rank ?? 1e9) - (b.rank ?? 1e9) },
  { key: "added", label: "Added", cmp: (a, b) => b.addedAt - a.addedAt },
];

/** Large image for a shortlisted card; older entries only stored the normal size, whose URL differs by one path segment. */
const largeOf = c => c.large || (c.image ? c.image.replace("/normal/", "/large/") : null);
const identName = c => (identityFor(c.colors) || {}).name || c.colors;
const identKey = c => [...(c.colors || "C")].sort().join("");

/** Two small icons on the card's top-left corner: green when the card does the thing, grey when it doesn't. */
function traits(c) { return `<div class="traits">${traitIcons({ scales: c.scales, protects: c.protects, known: c.scales !== undefined })}</div>`; }

function cardHTML(c) {
  return `
    <article class="result" data-large="${esc(largeOf(c) || "")}">
      <a class="result-img" href="${esc(c.uri)}" target="_blank" rel="noopener" title="${esc(c.name)} on Scryfall">${c.image ? `<img src="${c.image}" alt="${esc(c.name)}" loading="lazy" decoding="async">` : `<span>${esc(c.name)}</span>`}</a>
      <button type="button" class="icon-btn small result-remove" data-remove="${c.id}" aria-label="Remove ${esc(c.front)} from the shortlist" title="Remove from shortlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
      ${traits(c)}
      <div class="result-name" title="${esc(c.name)}">${esc(c.front)}</div>
      <div class="result-meta">${pips(c.colors)}<span class="result-meta-text">${esc(identName(c))} · MV ${c.mv}${c.eur != null ? ` · €${c.eur.toFixed(2)}` : ""}${c.rank != null ? ` · #${c.rank}` : ""}</span></div>
      <button type="button" class="btn tonal small result-use" data-name="${esc(c.front)}">Use in Deck Builder</button>
    </article>`;
}

export function renderShortlist(root) {
  let view = { sort: "rank", group: false, scales: false, protects: false };
  try { view = { ...view, ...JSON.parse(localStorage.getItem(VIEW_KEY) || "{}") }; } catch {}
  if (!SORTS.some(s => s.key === view.sort)) view.sort = "rank";
  const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {} };

  // The shell (heading, add-by-name search) renders once; the list below it redraws whenever the shortlist changes.
  root.innerHTML = `
    <div class="shortlist">
      <h1 class="sr-only">Shortlist</h1>
      <div class="sl-top">
        <form class="search-bar sl-search" id="sl-search" role="search">
          <span class="search-glyph" aria-hidden="true">⌕</span>
          <input type="search" id="sl-name" placeholder="Add a commander by name" aria-label="Commander name" autocomplete="off" enterkeyhint="search">
          <button class="btn filled small" type="submit">Add</button>
        </form>
        <span class="sl-meta"><span class="count-badge" id="sl-count" title="Commanders in the shortlist">0</span><button type="button" class="btn text small danger" id="sl-clear" hidden>Clear all</button></span>
      </div>
      <p class="helper sl-status" id="sl-status"></p>
      <div id="sl-body"></div>
    </div>`;
  const status = root.querySelector("#sl-status"), nameInput = root.querySelector("#sl-name");
  root.querySelector("#sl-search").addEventListener("submit", async e => {
    e.preventDefault();
    const name = nameInput.value.trim(); if (!name) return;
    status.className = "helper sl-status"; status.textContent = "Asking Scryfall…";
    try {
      const card = await cardNamed(name);
      if (!/Legendary/.test(card.type_line || "") && !/can be your commander/i.test(oracleOf(card))) { status.className = "helper sl-status error"; status.textContent = `${card.name} cannot lead a deck.`; return; }
      const r = shortlist.add(card), front = card.name.split(" //")[0];
      if (r === "duplicate") { status.textContent = `${front} is already in your shortlist.`; return; }
      if (r === "full") { status.className = "helper sl-status error"; status.textContent = "Couldn't save: this browser's storage is full. Clear this site's data and try again."; return; }
      status.textContent = `Added ${front}.`; nameInput.value = "";
    } catch { status.className = "helper sl-status error"; status.textContent = "Not found. Try the full name as printed on the card."; }
  });
  root.querySelector("#sl-clear").addEventListener("click", () => { if (confirm("Remove every commander from the shortlist?")) shortlist.clear(); });

  function draw() {
    if (document.body.dataset.screen !== "shortlist") { off(); return; }   // left the screen: stop listening
    const all = shortlist.list();
    root.querySelector("#sl-count").textContent = all.length;
    root.querySelector("#sl-clear").hidden = !all.length;
    const body = root.querySelector("#sl-body");
    const identsPresent = [...new Map(all.map(c => [identKey(c), c])).values()]
      .map(c => ({ key: identKey(c), name: identName(c), colors: c.colors }))
      .sort((a, b) => a.colors.length - b.colors.length || a.name.localeCompare(b.name));
    const sort = SORTS.find(s => s.key === view.sort);
    let list = all.filter(c => (!view.scales || c.scales) && (!view.protects || c.protects));
    list = list.slice().sort(sort.cmp);

    const groups = view.group
      ? identsPresent.map(i => ({ ...i, cards: list.filter(c => identKey(c) === i.key) })).filter(g => g.cards.length)
      : [{ key: "all", cards: list }];

    body.innerHTML = `
        ${all.length ? `
        <div class="shortlist-tools" id="sl-tools">
          <span class="label">Sort</span>
          <div class="segmented" role="radiogroup" aria-label="Sort by">${SORTS.map(s => `<button type="button" role="radio" aria-checked="${view.sort === s.key}" class="${view.sort === s.key ? "selected" : ""}" data-sort="${s.key}">${s.label}</button>`).join("")}</div>
          <span class="chip-sep" aria-hidden="true"></span>
          <button type="button" class="chip ${view.group ? "selected" : ""}" aria-pressed="${view.group}" data-toggle="group">Group by identity</button>
          <button type="button" class="chip ${view.scales ? "selected" : ""}" aria-pressed="${view.scales}" data-toggle="scales" title="Only commanders whose text hits each opponent">Scales vs 3</button>
          <button type="button" class="chip ${view.protects ? "selected" : ""}" aria-pressed="${view.protects}" data-toggle="protects" title="Only commanders that protect themselves">Protects itself</button>
        </div>
        ${list.length ? groups.map(g => `
          ${view.group ? `<h2 class="group-head">${pips(g.colors)}<span>${esc(g.name)}</span><span class="count-badge">${g.cards.length}</span></h2>` : ""}
          <div class="results-grid">${g.cards.map(cardHTML).join("")}</div>`).join("")
        : `<p class="helper shortlist-empty-filter">Nothing matches those filters. <button type="button" class="linkish" id="sl-reset">Show everything</button></p>`}`
        : `<p class="helper shortlist-empty">Nothing shortlisted yet. Add a commander by name above, or browse an identity under <a href="#find">Find a Commander</a> and swipe up on a card you'd like to play.</p>`}`;

    const on = (sel, ev, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, () => fn(el)));
    on("[data-sort]", "click", el => { view.sort = el.dataset.sort; saveView(); draw(); });
    on("[data-toggle]", "click", el => { view[el.dataset.toggle] = !view[el.dataset.toggle]; saveView(); draw(); });
    on("#sl-reset", "click", () => { view.scales = false; view.protects = false; saveView(); draw(); });
    on(".result-use", "click", el => useInDeckBuilder(el.dataset.name));
    on("[data-remove]", "click", el => shortlist.remove(el.dataset.remove));
    bindPeek(body.querySelectorAll(".result"), card => card.dataset.large);
  }
  const off = shortlist.onChange(draw);
  draw();
  // Cards saved before rank / scaling / protection were recorded: read them now, then redraw (the change event does it).
  shortlist.backfill().catch(err => console.warn("Commander Wizard: shortlist backfill failed", err));
}
