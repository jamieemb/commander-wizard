// Browse dialog: the commanders for one identity as a swipeable carousel.
// Desktop: ← → move through the cards; ↑ shortlists the card; ↓ skips it (or takes it back out).
// Phones: one card at a time, dating-app style. Swipe right = shortlist (Mountain flame), swipe left = skip (Swamp skull).
import { searchPage, imageOf, largeImageOf, priceEUR, webSearchURL } from "../scryfall.js";
import { pips, esc } from "../sections/colours.js";
import { shortlist, useInDeckBuilder } from "../shortlist.js";

const SWIPE = 70;            // px of drag before it counts as a swipe
const FLY_MS = 260;          // matches the CSS transition on .ccard
const POS = { "-2": "far-prev", "-1": "prev", "0": "cur", "1": "next", "2": "far-next" };
const SYM = { R: "https://svgs.scryfall.io/card-symbols/R.svg", B: "https://svgs.scryfall.io/card-symbols/B.svg" };   // Scryfall's mana symbols
const tinder = () => matchMedia("(max-width: 599px)").matches;   // the phone layout: sideways swipes decide, like a dating app

let dlg = null, state = null, snackTimer = null;
const $ = sel => dlg.querySelector(sel);
const frontName = c => (c.name || "").split(" //")[0];
const fmtEur = n => n == null ? "" : `€${n.toFixed(2)}`;
const typeOf = c => (c.type_line || (c.card_faces && c.card_faces[0].type_line) || "").split(" //")[0];
const textOf = c => (c.card_faces && c.card_faces.length ? c.card_faces : [c]).map(f => f.oracle_text || "").filter(Boolean).join("\n//\n");
const cur = () => (state && state.cards[state.index]) || null;

function ensureDialog() {
  if (dlg) return dlg;
  dlg = document.createElement("dialog");
  dlg.className = "browse";
  dlg.setAttribute("aria-label", "Commanders");
  dlg.innerHTML = `
    <header class="browse-head">
      <div class="browse-title"><div class="browse-ident" id="b-ident"></div><div class="helper" id="b-desc"></div></div>
      <a class="btn text small" id="b-scry" href="#" target="_blank" rel="noopener">Scryfall ↗</a>
      <button type="button" class="icon-btn" id="b-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
    </header>
    <div class="browse-body">
      <button type="button" class="icon-btn browse-arrow" id="b-prev" aria-label="Previous card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>
      <div class="carousel" id="b-carousel"></div>
      <button type="button" class="icon-btn browse-arrow" id="b-next" aria-label="Next card"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
    </div>
    <div class="browse-info" id="b-info" aria-live="polite"></div>
    <div class="browse-actions">
      <button type="button" class="btn outlined small" id="b-remove" title="Skip this card, or take it out of the shortlist (↓ or swipe down; swipe left on a phone)"><img class="sym" src="${SYM.B}" alt=""><span class="lbl">▼ Skip</span></button>
      <span class="helper" id="b-pos"></span>
      <button type="button" class="btn tonal small" id="b-add" title="Add to the shortlist and move on (↑ or swipe up; swipe right on a phone)"><img class="sym" src="${SYM.R}" alt=""><span class="lbl">▲ Shortlist</span></button>
      <button type="button" class="btn filled small" id="b-use">Use in Deck Builder</button>
    </div>
    <p class="helper browse-hint">← → browse · ↑ shortlist · ↓ skip (or remove) · Esc closes. On touch, swipe the card; either way moves on to the next.</p>
    <div class="snackbar" id="b-snack" hidden></div>`;
  document.body.appendChild(dlg);
  $("#b-close").addEventListener("click", () => dlg.close());
  $("#b-prev").addEventListener("click", () => step(-1));
  $("#b-next").addEventListener("click", () => step(1));
  $("#b-add").addEventListener("click", addCurrent);
  $("#b-remove").addEventListener("click", removeCurrent);
  $("#b-use").addEventListener("click", () => { const c = cur(); if (c) useInDeckBuilder(frontName(c)); });
  dlg.addEventListener("keydown", onKey);
  dlg.addEventListener("close", () => { state = null; $("#b-carousel").innerHTML = ""; });
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });   // click on the scrim
  window.addEventListener("hashchange", () => { if (dlg.open) dlg.close(); });
  bindPointer($("#b-carousel"));
  return dlg;
}

/** Open the dialog for one identity's search. */
export async function openBrowse({ identity, query, order, dir, describe }) {
  ensureDialog();
  const seq = (state ? state.seq : 0) + 1;
  state = { identity, query, order, dir, describe, cards: [], total: 0, nextPage: null, index: 0, seq, loadingMore: false, dragged: false };
  $("#b-ident").innerHTML = `${pips(identity.colors)}<span>${esc(identity.name)}</span><span class="count-badge" id="b-count" hidden></span>`;
  $("#b-desc").textContent = describe;
  $("#b-scry").href = webSearchURL(query, order, dir);
  $("#b-carousel").innerHTML = `<p class="helper browse-status">Asking Scryfall…</p>`;
  $("#b-info").innerHTML = ""; $("#b-pos").textContent = "";
  for (const id of ["b-prev", "b-next", "b-add", "b-remove", "b-use"]) $("#" + id).disabled = true;
  if (!dlg.open) dlg.showModal();
  try {
    const page = await searchPage(query, { order, dir: dir || "asc" });
    if (!state || state.seq !== seq) return;
    state.cards = page.cards; state.total = page.total; state.nextPage = page.nextPage;
    $("#b-count").textContent = page.total; $("#b-count").hidden = false;
    if (!page.cards.length) { $("#b-carousel").innerHTML = `<p class="helper browse-status">No commanders match. Drop a filter or two.</p>`; return; }
    $("#b-carousel").innerHTML = `<span class="carousel-price" id="b-price" hidden></span>`;   // phones: price above the card's corner
    $("#b-use").disabled = false;
    render();
  } catch (err) {
    console.warn("Commander Wizard: browse failed for", query, err);
    if (!state || state.seq !== seq) return;
    const why = /429/.test(String(err)) ? "Scryfall is rate-limiting requests; wait a few seconds."
      : /Failed to fetch|NetworkError|Load failed/i.test(String(err)) ? "The request didn't reach Scryfall (network, or a blocked response)."
      : `Scryfall answered with an error: ${esc(String((err && err.message) || err))}.`;
    $("#b-carousel").innerHTML = `<div class="browse-status"><p class="helper error">${why}</p><div class="row" style="margin-top:.5714rem;justify-content:center"><button type="button" class="btn tonal small" id="b-retry">Try again</button></div></div>`;
    $("#b-retry").addEventListener("click", () => openBrowse({ identity, query, order, dir, describe }));
  }
}

function nodeFor(i) {
  const c = state.cards[i];
  const el = document.createElement("div");
  el.className = "ccard"; el.dataset.i = i;
  el.innerHTML = (imageOf(c) ? `<img src="${largeImageOf(c)}" alt="${esc(c.name)}" draggable="false" decoding="async">` : `<span class="ccard-name">${esc(c.name)}</span>`)
    + `<span class="ccard-badge" hidden>Shortlisted</span>`
    + `<span class="stamp yes" aria-hidden="true"><img src="${SYM.R}" alt=""><b>Shortlist</b></span><span class="stamp no" aria-hidden="true"><img src="${SYM.B}" alt=""><b>Skip</b></span>`;
  el.addEventListener("click", () => { if (!state || state.dragged) return; const d = Number(el.dataset.i) - state.index; if (d) step(d); });
  return el;
}

/** Lay out the five cards around the current index; existing nodes keep their identity so the CSS transitions animate. */
function render() {
  if (!state || !state.cards.length) return;
  const car = $("#b-carousel"), i = state.index, keep = new Set();
  for (let d = -2; d <= 2; d++) {
    const j = i + d; if (j < 0 || j >= state.cards.length) continue;
    keep.add(String(j));
    let el = car.querySelector(`.ccard[data-i="${j}"]`);
    if (!el) { el = nodeFor(j); el.classList.add(d < 0 ? "far-prev" : "far-next"); car.appendChild(el); void el.offsetWidth; }
    const on = shortlist.has(state.cards[j].id);
    el.className = `ccard ${POS[d]}${on ? " shortlisted" : ""}`;
    el.style.transform = ""; el.style.removeProperty("--yes"); el.style.removeProperty("--no");
    el.querySelector(".ccard-badge").hidden = !on;
    el.querySelector(".stamp.yes b").textContent = on ? "Keep" : "Shortlist";
    el.querySelector(".stamp.no b").textContent = on ? "Remove" : "Skip";
  }
  car.querySelectorAll(".ccard").forEach(el => { if (!keep.has(el.dataset.i)) el.remove(); });
  const c = state.cards[i], on = shortlist.has(c.id);
  $("#b-info").innerHTML = `
    <div class="browse-name">${esc(frontName(c))}${on ? ` <span class="chip small on">shortlisted</span>` : ""}</div>
    <div class="helper">${esc(typeOf(c))} · MV ${c.cmc ?? 0}${priceEUR(c) != null ? ` · ${fmtEur(priceEUR(c))}` : ""} · <a href="${esc(c.scryfall_uri)}" target="_blank" rel="noopener">Scryfall</a></div>
    <p class="browse-oracle">${esc(textOf(c)).replace(/\n/g, "<br>")}</p>`;
  $("#b-pos").textContent = `${i + 1} of ${state.total}`;
  const price = $("#b-price");
  if (price) { const eur = priceEUR(c); price.textContent = eur != null ? fmtEur(eur) : ""; price.hidden = eur == null; }
  $("#b-prev").disabled = i === 0;
  $("#b-next").disabled = i >= state.cards.length - 1 && !state.nextPage;
  $("#b-add").disabled = false; $("#b-remove").disabled = false;
  $("#b-add .lbl").textContent = on ? "▲ Keep" : "▲ Shortlist";
  $("#b-remove .lbl").textContent = on ? "▼ Remove" : "▼ Skip";
  $("#b-add").setAttribute("aria-label", on ? "Keep in the shortlist" : "Add to the shortlist");
  $("#b-remove").setAttribute("aria-label", on ? "Remove from the shortlist" : "Skip");
  if (i >= state.cards.length - 6) loadMore();
}

function step(d) {
  if (!state || !state.cards.length) return;
  const n = state.index + d;
  if (n < 0 || n >= state.cards.length) return;
  state.index = n; render();
}
async function loadMore() {
  if (!state || !state.nextPage || state.loadingMore) return;
  state.loadingMore = true;
  const seq = state.seq;
  try {
    const page = await searchPage(state.query, {}, state.nextPage);
    if (!state || state.seq !== seq) return;
    state.cards = state.cards.concat(page.cards); state.nextPage = page.nextPage;
    render();
  } catch (err) { console.warn("Commander Wizard: could not load more", err); }
  finally { if (state && state.seq === seq) state.loadingMore = false; }
}

/** Fly the current card off in a direction, do the thing, then move on. The flown card takes its new slot without animating back. */
function fly(cls, then) {
  const el = $(".ccard.cur");
  if (!el) { then(); return; }
  el.style.transform = ""; el.classList.add(cls);
  pulse(cls === "fly-up" || cls === "fly-right" ? "b-add" : "b-remove");
  setTimeout(() => {
    el.classList.remove(cls); el.classList.add("no-anim");
    then();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("no-anim")));
  }, FLY_MS);
}
/** Next card, or stay put on the last one. */
function advance() {
  if (!state) return;
  if (state.index < state.cards.length - 1) state.index++; else snack("That was the last one");
  render();
}
/** The action button bounces once, like a dating app's like button. */
function pulse(id) {
  const b = $("#" + id); if (!b) return;
  b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
}
/** ↑ / swipe up (phones: swipe right): shortlist the card (if it isn't already) and move on. */
function addCurrent() {
  const c = cur(); if (!c) return;
  const already = shortlist.has(c.id);
  fly(tinder() ? "fly-right" : "fly-up", () => {
    if (!already) { const r = shortlist.add(c); snack(r === "added" ? `${frontName(c)} added to your shortlist` : r === "full" ? "Couldn't save: this browser's storage is full" : `${frontName(c)} is already in your shortlist`); }
    advance();
  });
}
/** ↓ / swipe down (phones: swipe left): skip the card, taking it out of the shortlist if it was there, and move on. */
function removeCurrent() {
  const c = cur(); if (!c) return;
  const was = shortlist.has(c.id);
  fly(tinder() ? "fly-left" : "fly-down", () => { if (was) { shortlist.remove(c.id); snack(`${frontName(c)} removed from your shortlist`); } advance(); });
}
function snack(msg) {
  const el = $("#b-snack"); el.textContent = msg; el.hidden = false;
  clearTimeout(snackTimer); snackTimer = setTimeout(() => { el.hidden = true; }, 1600);
}

function onKey(e) {
  if (!state || e.target.matches("input, textarea")) return;
  const map = { ArrowLeft: () => step(-1), ArrowRight: () => step(1), ArrowUp: addCurrent, ArrowDown: removeCurrent };
  if (map[e.key]) { e.preventDefault(); map[e.key](); }
}

/** Drag the current card with a pointer. Desktop: sideways to move on, up to shortlist, down to remove.
 *  Phones: the card tilts as it goes, the stamp for the side you are heading to fades in, and past the threshold it flies off. */
function bindPointer(car) {
  let start = null, el = null;
  car.addEventListener("pointerdown", e => {
    if (!state) return;
    el = e.target.closest(".ccard.cur"); if (!el) return;
    start = { x: e.clientX, y: e.clientY };
    el.classList.add("dragging"); state.dragged = false;
    try { car.setPointerCapture(e.pointerId); } catch {}
  });
  car.addEventListener("pointermove", e => {
    if (!start || !el) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) state.dragged = true;
    if (tinder()) {
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy * 0.35}px)) rotate(${dx / 14}deg)`;
      el.style.setProperty("--yes", Math.max(0, Math.min(1, dx / SWIPE)));
      el.style.setProperty("--no", Math.max(0, Math.min(1, -dx / SWIPE)));
    } else {
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${dx / 25}deg)`;
    }
  });
  const end = e => {
    if (!start || !el) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    const phone = tinder(), decided = phone && Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy);
    el.classList.remove("dragging"); el.style.transform = "";
    if (!decided) { el.style.removeProperty("--yes"); el.style.removeProperty("--no"); }   // a decided swipe keeps its stamp while the card flies
    el = null; start = null;
    if (phone) { if (decided) (dx > 0 ? addCurrent : removeCurrent)(); }
    else if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (dy < -SWIPE) addCurrent();
    else if (dy > SWIPE) removeCurrent();
    setTimeout(() => { if (state) state.dragged = false; }, 0);
  };
  car.addEventListener("pointerup", end);
  car.addEventListener("pointercancel", end);
}
