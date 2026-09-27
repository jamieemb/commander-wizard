// The plan-card search: a Scryfall-style page (one query bar, sort and display controls, an image grid or a
// checklist, previous/next paging) with an "Add card" on every result and the plan list beside it, ready to copy
// into Archidekt in one go. The deck's colours and commander are added to every search unless switched off.
// Lives inside Stage 3 (mountPlanSearch); #plan still works as a screen of its own for a bookmarked search.
import { store } from "../store.js";
import { searchPage, imageOf, largeImageOf, priceEUR, webSearchURL } from "../scryfall.js";
import { pips, esc, identityFor } from "../sections/colours.js";
import { IDENTITIES } from "../data/colors.js";
import { planList } from "../planlist.js";
import { bindPeek } from "../peek.js";
import { PLAN_GATHER } from "../numbers.js";

const VIEW_KEY = "cw:planView";      // sort, direction, display, scope: remembered in this browser
const QUERY_KEY = "cw:planQuery";    // the last search, so coming back shows it again
const SORTS = [                      // Scryfall's own orderings
  { key: "edhrec", label: "EDHREC rank" }, { key: "name", label: "Name" }, { key: "cmc", label: "Mana value" },
  { key: "eur", label: "Price (EUR)" }, { key: "usd", label: "Price (USD)" }, { key: "released", label: "Release date" },
  { key: "rarity", label: "Rarity" }, { key: "color", label: "Colour" }, { key: "power", label: "Power" }, { key: "toughness", label: "Toughness" },
];
const ICON_COPY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

const frontName = c => (c.name || "").split(" //")[0];
const typeOf = c => (c.type_line || (c.card_faces && c.card_faces[0].type_line) || "").split(" //")[0];
const costOf = c => c.mana_cost || (c.card_faces && c.card_faces.map(f => f.mana_cost).filter(Boolean).join(" // ")) || "";
const fmtEur = n => n == null ? "—" : `€${n.toFixed(2)}`;
const fmtN = n => Number(n).toLocaleString("en-GB");

/** What every plan search starts with: the deck's colours (none chosen yet: every colour), Commander legality, not the commander itself. */
export function planPrefix(deck) {
  const colors = deck.colours.colors || "", c = deck.commander.chosen;
  const id = !colors ? "" : colors === "C" ? "id=c " : `id<=${colors.toLowerCase()} `;
  return `${id}legal:commander${c ? ` -!"${c.name.split(" // ")[0].replace(/"/g, "")}"` : ""}`;
}

/** The generated searches from the commander's key words: [{ title, rows: [{ label, q }] }]. */
export function searchKit(kws) {
  const top = kws.slice(0, 5), groups = [], pairs = [];
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) pairs.push({ label: `${esc(top[i])}<span class="dim">+</span>${esc(top[j])}`, q: `o:"${top[i]}" o:"${top[j]}"` });
  if (pairs.length) groups.push({ title: "Two key words", rows: pairs.slice(0, 8) });
  if (kws.length) groups.push({ title: "One key word", rows: kws.slice(0, 8).map(k => ({ label: esc(k), q: `o:"${k}"` })) });
  if (kws.length) groups.push({ title: "Finishers", rows: kws.slice(0, 3).map(k => ({ label: `${esc(k)}<span class="dim">·</span>each opponent`, q: `o:"${k}" o:"each opponent"` })).concat([{ label: "any finisher", q: "otag:win-condition" }]) });
  if (kws.length) groups.push({ title: "Two-job cards", rows: kws.slice(0, 3).flatMap(k => [{ label: `removal<span class="dim">·</span>${esc(k)}`, q: `otag:removal o:"${k}"` }, { label: `draw<span class="dim">·</span>${esc(k)}`, q: `otag:card-advantage o:"${k}"` }]) });
  return groups;
}

/** #plan?q=… → the query; the hash is the address of a search, as on Scryfall. */
export function planHashQuery() {
  const m = location.hash.match(/^#\/?plan\?(.*)$/);
  if (!m) return null;
  return new URLSearchParams(m[1]).get("q");
}

/** The screen of its own: the same search, addressed by #plan?q=…. */
export function renderPlan(root) { mountPlanSearch(root, { embedded: false }); }

/**
 * Render the search into `host`. Embedded (Stage 3) it leaves the hash alone and remembers the query in this
 * browser; as a screen it keeps the query in the hash, so a search can be bookmarked.
 */
export function mountPlanSearch(host, { embedded = true } = {}) {
  const deck = store.deck, c = deck.commander.chosen, colors = deck.colours.colors || "";
  const ident = colors ? (identityFor(colors) || {}).name || colors : "";
  const kws = deck.commander.keywords || [];
  let view = { sort: "edhrec", dir: "auto", display: "images", scope: true };
  try { view = { ...view, ...JSON.parse(localStorage.getItem(VIEW_KEY) || "{}") }; } catch {}
  if (!SORTS.some(s => s.key === view.sort)) view.sort = "edhrec";
  const saveView = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {} };
  let q = embedded ? null : planHashQuery();
  if (q == null) { try { q = localStorage.getItem(QUERY_KEY) || ""; } catch { q = ""; } }
  const prefix = planPrefix(deck);
  const fullQuery = () => (view.scope ? `${prefix} ${q}` : q).trim();
  const kit = searchKit(kws), kitRows = kit.flatMap(g => g.rows);
  const searched = () => new Set(deck.gather.searched || []);

  // pages[i] is the URL that fetched page i (null = the first page of the query); paging back is instant from the client's memory
  let state = { query: "", cards: [], total: 0, pages: [null], page: 0, nextPage: null, seq: 0, loading: false, error: "" };

  host.innerHTML = `
    <div class="plan">
      <div class="plan-main">
        ${embedded ? "" : `<h1 class="sr-only">Plan cards</h1>`}
        <form class="search-bar plan-search" id="p-form" role="search">
          <span class="search-glyph" aria-hidden="true">⌕</span>
          <input type="search" id="p-q" placeholder="Search cards, Scryfall syntax: o:&quot;landfall&quot; t:creature mv<=3" aria-label="Search" autocomplete="off" spellcheck="false" enterkeyhint="search" value="${esc(q)}">
          <button class="btn filled small" type="submit">Search</button>
        </form>
        <div class="plan-scope">
          <div class="plan-scope-row">
            ${colors ? `<button type="button" class="chip small ${view.scope ? "on" : ""}" id="p-scope" aria-pressed="${view.scope}" title="${esc(prefix)}">Within ${esc(ident)}${c ? ` · not ${esc(frontName(c))}` : ""} · Commander-legal</button>` : ""}
            ${c ? "" : `<label class="plan-ctl">${colors ? "Change identity" : "Search within"}<select id="p-ident"><option value="" ${colors ? "" : "selected"} disabled>Colour identity…</option>${IDENTITIES.map(i => `<option value="${i.id}" ${colors && identityFor(colors) && identityFor(colors).id === i.id ? "selected" : ""}>${esc(i.name)} (${i.colors})</option>`).join("")}</select></label>`}
            ${!colors ? `<span class="helper">Pick the deck's identity and every search stays within it (choosing a commander in Stage 1 sets it too).</span>` : ""}
          </div>
          ${kit.length ? `<div class="plan-kit" id="p-kit">${kit.map(g => `<span class="plan-kit-title">${esc(g.title)}</span>${g.rows.map(r => `<button type="button" class="chip small" data-q="${esc(r.q)}" title="${esc(r.q)}">${r.label}</button>`).join("")}`).join("")}<span class="plan-kit-progress" id="p-kit-done"></span></div>`
            : `<p class="helper">Add key words to the commander in <a href="#wizard/1">Stage 1</a> and the searches to click through appear here.</p>`}
        </div>
        <div class="plan-head">
          <div class="plan-count" id="p-count" aria-live="polite"></div>
          <div class="plan-controls">
            <label class="plan-ctl">Sort<select id="p-sort">${SORTS.map(s => `<option value="${s.key}" ${s.key === view.sort ? "selected" : ""}>${s.label}</option>`).join("")}</select></label>
            <label class="plan-ctl"><span class="sr-only">Direction</span><select id="p-dir"><option value="auto" ${view.dir === "auto" ? "selected" : ""}>Auto</option><option value="asc" ${view.dir === "asc" ? "selected" : ""}>Ascending</option><option value="desc" ${view.dir === "desc" ? "selected" : ""}>Descending</option></select></label>
            <div class="segmented plan-display" role="radiogroup" aria-label="Display as">
              <button type="button" role="radio" data-display="images" aria-checked="${view.display === "images"}" class="${view.display === "images" ? "selected" : ""}">Images</button>
              <button type="button" role="radio" data-display="checklist" aria-checked="${view.display === "checklist"}" class="${view.display === "checklist" ? "selected" : ""}">Checklist</button>
            </div>
            <a class="btn text small" id="p-scry" href="#" target="_blank" rel="noopener" hidden>Scryfall ↗</a>
          </div>
        </div>
        <div class="plan-results" id="p-results"></div>
        <div class="plan-pager" id="p-pager" hidden>
          <button type="button" class="btn outlined small" id="p-prev">← Previous</button>
          <span class="helper" id="p-page"></span>
          <button type="button" class="btn outlined small" id="p-next">Next →</button>
        </div>
      </div>
      <aside class="plan-side" id="p-side" aria-label="Plan list">
        <button type="button" class="plan-side-head" id="p-side-toggle" aria-expanded="false">
          <span class="plan-side-title">Plan list <span class="count-badge" id="p-n">0</span></span>
          <span class="helper" id="p-side-sub"></span>
        </button>
        <div class="plan-side-body">
          <div class="plan-side-actions">
            <button type="button" class="btn filled small" id="p-copy" title="Copy the list in Archidekt's import format">${ICON_COPY}Copy list</button>
            <button type="button" class="btn text small danger" id="p-clear" hidden>Clear</button>
          </div>
          <div class="plan-list" id="p-list"></div>
          <p class="helper plan-side-foot">Archidekt: deck menu → Import → paste. Every card lands in the <b>Plan</b> category.</p>
        </div>
      </aside>
    </div>`;

  const $ = sel => host.querySelector(sel);
  const input = $("#p-q"), results = $("#p-results"), count = $("#p-count"), pager = $("#p-pager");

  // ----- searching -----
  function remember(query) {
    if (!embedded) { const h = query ? `#plan?q=${encodeURIComponent(query)}` : "#plan"; if (location.hash !== h) history.replaceState(null, "", h); }   // replaceState: no hashchange, so no re-render
    try { localStorage.setItem(QUERY_KEY, query); } catch {}
  }
  const live = () => host.isConnected && host.contains(results);

  async function runSearch({ fromStart = true } = {}) {
    q = input.value.trim();
    remember(q); refreshKit();
    const full = fullQuery();
    if (!full) { state = { ...state, query: "", cards: [], total: 0, pages: [null], page: 0, nextPage: null, error: "" }; draw(); return; }
    const seq = ++state.seq;
    if (fromStart) state = { ...state, query: full, cards: [], total: 0, pages: [null], page: 0, nextPage: null };
    state.loading = true; state.error = ""; draw();
    try {
      const opts = { order: view.sort, dir: view.dir === "auto" ? (view.sort === "edhrec" || view.sort === "name" || view.sort === "cmc" ? "asc" : "desc") : view.dir };
      const page = await searchPage(full, opts, state.pages[state.page]);
      if (seq !== state.seq || !live()) return;
      state.cards = page.cards; state.total = page.total; state.nextPage = page.nextPage; state.loading = false;
      $("#p-scry").href = webSearchURL(full, view.sort, view.dir === "auto" ? null : view.dir); $("#p-scry").hidden = false;
    } catch (err) {
      if (seq !== state.seq || !live()) return;
      state.loading = false; state.cards = []; state.total = 0; state.nextPage = null;
      state.error = /400/.test(String(err.message)) ? "Scryfall didn't understand that search. Check the syntax and try again." : "Scryfall isn't answering. Try again in a moment.";
    }
    draw();
  }
  function goPage(d) {
    const n = state.page + d;
    if (n < 0) return;
    if (n >= state.pages.length) { if (!state.nextPage) return; state.pages.push(state.nextPage); }
    state.page = n;
    runSearch({ fromStart: false });
    host.querySelector(".plan-head").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#p-form").addEventListener("submit", e => { e.preventDefault(); runSearch(); });
  const scope = $("#p-scope");
  if (scope) scope.addEventListener("click", () => { view.scope = !view.scope; scope.classList.toggle("on", view.scope); scope.setAttribute("aria-pressed", String(view.scope)); saveView(); if (q) runSearch(); });
  // No commander yet: the identity is chosen here, and is the same one Stage 1 shows. The search redraws with the new prefix.
  const identSel = $("#p-ident");
  if (identSel) identSel.addEventListener("change", e => {
    const i = IDENTITIES.find(x => x.id === e.target.value); if (!i) return;
    view.scope = true; saveView();
    store.update(d => { d.colours.colors = i.colors; d.colours.colorId = i.id; d.colours.colorName = i.name; });
    remember(input.value.trim());
    mountPlanSearch(host, { embedded });
  });
  $("#p-sort").addEventListener("change", e => { view.sort = e.target.value; saveView(); if (state.query) runSearch(); });
  $("#p-dir").addEventListener("change", e => { view.dir = e.target.value; saveView(); if (state.query) runSearch(); });
  host.querySelectorAll("[data-display]").forEach(b => b.addEventListener("click", () => {
    view.display = b.dataset.display; saveView();
    host.querySelectorAll("[data-display]").forEach(x => { const on = x === b; x.classList.toggle("selected", on); x.setAttribute("aria-checked", String(on)); });
    draw();
  }));
  $("#p-prev").addEventListener("click", () => goPage(-1));
  $("#p-next").addEventListener("click", () => goPage(1));

  // ----- the generated searches: click each in turn; a tick shows the ones already looked through -----
  host.querySelectorAll("#p-kit [data-q]").forEach(b => b.addEventListener("click", () => {
    input.value = b.dataset.q;
    if (!searched().has(b.dataset.q)) store.update(d => { d.gather.searched = [...(d.gather.searched || []), b.dataset.q]; });
    runSearch();
  }));
  function refreshKit() {
    const done = searched(), now = input.value.trim();
    host.querySelectorAll("#p-kit [data-q]").forEach(b => { b.classList.toggle("on", done.has(b.dataset.q)); b.classList.toggle("active", b.dataset.q === now); });
    const n = kitRows.filter(r => done.has(r.q)).length, el = $("#p-kit-done");
    if (el) el.textContent = kitRows.length ? (n >= kitRows.length ? "every search looked through" : `${n} of ${kitRows.length} searches looked through`) : "";
  }

  // ----- results -----
  const addLabel = on => on ? "✓ Added" : "Add card";
  function cardHTML(card) {
    const on = planList.has(card.id), img = imageOf(card);
    return `
      <article class="pcard ${on ? "on" : ""}" data-id="${card.id}">
        <button type="button" class="pcard-img" data-toggle="${card.id}" title="${esc(card.name)} — ${on ? "remove from" : "add to"} the plan list" aria-pressed="${on}">${img ? `<img src="${img}" alt="${esc(card.name)}" loading="lazy" decoding="async">` : `<span>${esc(card.name)}</span>`}<span class="pcard-badge" ${on ? "" : "hidden"}>In the plan list</span></button>
        <button type="button" class="btn ${on ? "tonal" : "outlined"} small pcard-add" data-toggle="${card.id}">${addLabel(on)}</button>
      </article>`;
  }
  function rowHTML(card) {
    const on = planList.has(card.id), eur = priceEUR(card);
    return `
      <tr class="${on ? "on" : ""}" data-id="${card.id}">
        <td class="pt-name"><span class="pt-peek" data-large="${esc(largeImageOf(card) || "")}">${esc(frontName(card))}</span></td>
        <td class="pt-cost">${esc(costOf(card))}</td>
        <td class="pt-type">${esc(typeOf(card))}</td>
        <td class="pt-mv">${card.cmc ?? 0}</td>
        <td class="pt-eur">${fmtEur(eur)}</td>
        <td class="pt-add"><button type="button" class="btn ${on ? "tonal" : "outlined"} small pcard-add" data-toggle="${card.id}">${addLabel(on)}</button></td>
      </tr>`;
  }
  function draw() {
    const from = state.page * 175 + 1, to = state.page * 175 + state.cards.length;
    count.innerHTML = state.loading ? `Searching…`
      : state.error ? `<span class="error">${esc(state.error)}</span>`
      : !state.query ? `<span class="helper">${kit.length ? "Click a search above, add what fits, then the next one." : "Type a search above."} Gather about ${PLAN_GATHER} plan cards.</span>`
      : !state.total ? `No cards match <code>${esc(q)}</code>.`
      : `${fmtN(from)} – ${fmtN(to)} of ${fmtN(state.total)} card${state.total === 1 ? "" : "s"}`;
    if (!state.cards.length) { results.innerHTML = ""; pager.hidden = true; return; }
    results.innerHTML = view.display === "images"
      ? `<div class="plan-grid">${state.cards.map(cardHTML).join("")}</div>`
      : `<table class="plan-table"><thead><tr><th>Name</th><th>Cost</th><th>Type</th><th>MV</th><th>EUR</th><th></th></tr></thead><tbody>${state.cards.map(rowHTML).join("")}</tbody></table>`;
    results.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", () => {
      const card = state.cards.find(x => x.id === b.dataset.toggle); if (!card) return;
      planList.toggle(card);   // the store change redraws the result and the side panel
    }));
    if (view.display === "checklist") bindPeek(results.querySelectorAll(".pt-peek"), el => el.dataset.large || null, { tap: true });
    pager.hidden = !(state.page > 0 || state.nextPage);
    $("#p-prev").disabled = state.page === 0;
    $("#p-next").disabled = !state.nextPage;
    $("#p-page").textContent = `Page ${state.page + 1}${state.total ? ` of ${Math.ceil(state.total / 175)}` : ""}`;
  }
  /** After an add or remove: only the affected result changes, so the grid keeps its scroll position. */
  function refreshResults() {
    results.querySelectorAll("[data-id]").forEach(el => {
      const on = planList.has(el.dataset.id);
      el.classList.toggle("on", on);
      el.querySelectorAll(".pcard-add").forEach(b => { b.textContent = addLabel(on); b.classList.toggle("tonal", on); b.classList.toggle("outlined", !on); });
      const img = el.querySelector(".pcard-img"); if (img) { img.setAttribute("aria-pressed", String(on)); img.querySelector(".pcard-badge").hidden = !on; }
    });
  }

  // ----- the plan list -----
  const side = $("#p-side");
  $("#p-side-toggle").addEventListener("click", () => { const open = side.classList.toggle("open"); $("#p-side-toggle").setAttribute("aria-expanded", String(open)); });
  $("#p-copy").addEventListener("click", async () => {
    const btn = $("#p-copy"), text = planList.toText();
    if (!text) { flash(btn, "Nothing to copy"); return; }
    try { await navigator.clipboard.writeText(text); flash(btn, `Copied ${planList.count()}`); }
    catch { flash(btn, "Copy blocked"); }
  });
  $("#p-clear").addEventListener("click", () => { if (confirm("Remove every card from the plan list?")) planList.clear(); });
  function flash(btn, text) { const old = btn.innerHTML; btn.innerHTML = text; btn.classList.add("done"); setTimeout(() => { btn.innerHTML = old; btn.classList.remove("done"); }, 1200); }
  function drawSide() {
    const l = planList.list(), n = l.length;
    $("#p-n").textContent = n;
    $("#p-clear").hidden = !n;
    $("#p-side-sub").textContent = n ? `${fmtEur(planList.totalEUR())} · ${n >= PLAN_GATHER ? "enough to cut from" : `gather ~${PLAN_GATHER}`}` : "";
    $("#p-list").innerHTML = n ? l.map(x => `
      <div class="plan-item" data-large="${esc(x.large || "")}">
        ${pips(x.colors)}<span class="plan-item-name" title="${esc(x.name)}">${esc(x.front)}</span><span class="plan-item-meta">${x.mv}${x.eur != null ? ` · ${fmtEur(x.eur)}` : ""}</span>
        <button type="button" class="icon-btn small plan-item-x" data-remove="${x.id}" aria-label="Remove ${esc(x.front)}" title="Remove">${ICON_X}</button>
      </div>`).join("")
      : `<p class="helper plan-empty">Nothing here yet. Click a search, then <b>Add card</b> on anything that matches two or more of the commander's key words.</p>`;
    $("#p-list").querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => planList.remove(b.dataset.remove)));
    bindPeek($("#p-list").querySelectorAll(".plan-item"), el => el.dataset.large || null);
  }
  const off = planList.onChange(() => { if (!live()) { off(); return; } drawSide(); refreshResults(); });

  drawSide(); refreshKit();
  if (q) runSearch(); else draw();
}
