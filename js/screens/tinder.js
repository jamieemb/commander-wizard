// Commander Tinder: a hidden, phone-only toy. Tap the wordmark five times quickly and swipe legendary creatures
// from every set and every era until one of them swipes back. Pure luck. Nothing here touches the deck or the shortlist.
import { randomCard, artOf, imageOf } from "../scryfall.js";
import { esc } from "../sections/colours.js";
import { store } from "../store.js";

const TAPS = 5, TAP_WINDOW_MS = 1800;   // the secret knock: five taps on "Commander Wizard" inside 1.8 s
const SWIPE = 70, FLY_MS = 260, PREFETCH = 4;
const SYM = { R: "https://svgs.scryfall.io/card-symbols/R.svg", B: "https://svgs.scryfall.io/card-symbols/B.svg" };
const POOL = "t:legendary t:creature";
const PREFS = { men: { label: "Men", q: "art:male" }, women: { label: "Women", q: "art:female" }, everyone: { label: "Everyone", q: "(art:male or art:female)" } };
const isMobile = () => innerWidth < 900 && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1);

// A silhouette for the "you" side of a match when no commander has been chosen yet.
const YOU_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#3d5a80"/><path d="M48 10 30 48h13l-9 38 36-50H56l10-26z" fill="#f5f3f0"/></svg>`)}`;

const OPENERS = [
  [/vampire/i, "I hear you're a night person. Same."],
  [/dragon/i, "Skip the small talk. Want to hoard treasure together?"],
  [/zombie|skeleton|spirit|phyrexian/i, "You look like you've been around a while. I like that in a person."],
  [/wizard/i, "A wizard? Say no more. Someone wrote a whole app about you."],
  [/god|angel|demon|avatar/i, "A bit out of my league, but the flame said swipe right."],
  [/elf|druid|treefolk/i, "Do you come to this forest often?"],
  [/goblin|orc|ogre|devil/i, "Chaos energy. Respect."],
  [/knight|soldier|warrior|samurai/i, "Block together sometime?"],
  [/pirate|rogue|assassin/i, "You look like trouble. Good trouble."],
  [/artificer|golem|construct/i, "Is that a mana rock in your pocket?"],
  [/merfolk|kraken|leviathan|octopus/i, "I'd get my feet wet for you."],
];
const FALLBACKS = ["You had me at “{type}”.", "Is it hot on this plane, or is it just you?", "I'd untap for you any day.", "Do you believe in love at first draw?", "Cute. Do you scale against the table?", "Commander damage? Because you just hit me for 21."];
const REPLIES = ["Tap. Untap. Tap. (They seem nervous.)", "…", "Is that a line, or a triggered ability?", "Bold. I'll allow it.", "My deck says I should be suspicious of you. My heart says otherwise."];

let dlg = null, game = null, snackTimer = null, seqCounter = 0;   // seq: a stale fetch from an earlier game never lands in a new one
const $ = s => dlg.querySelector(s);
const pick = a => a[Math.floor(Math.random() * a.length)];
const faceOf = c => (c.image_uris ? c : (c.card_faces && c.card_faces[0])) || c;
const frontName = c => (c.name || "").split(" //")[0];
const typeOf = c => (faceOf(c).type_line || c.type_line || "").split(" //")[0];
const firstSentence = t => (t || "").split(/(?<=[.!?])\s/)[0].replace(/\([^)]*\)/g, "").trim();

/** Install the secret knock. Only phones and small tablets ever get in; on a desktop the title is just a link. */
export function armTinder() {
  const title = document.querySelector(".appbar-title"); if (!title) return;
  let taps = [];
  title.addEventListener("click", e => {
    if (!isMobile()) return;
    const now = Date.now();
    taps = taps.filter(t => now - t < TAP_WINDOW_MS); taps.push(now);
    if (taps.length > 1) e.preventDefault();   // the first tap is an ordinary tap on the title; the rest are the knock
    if (taps.length >= TAPS) { taps = []; openTinder(); }
  });
}

function ensureDialog() {
  if (dlg) return dlg;
  dlg = document.createElement("dialog");
  dlg.className = "tinder"; dlg.setAttribute("aria-label", "Commander Tinder");
  dlg.innerHTML = `
    <section class="tintro" id="t-intro">
      <button type="button" class="icon-btn tclose" data-close aria-label="Close">${X}</button>
      <img class="tlogo" src="${SYM.R}" alt="">
      <h1>Commander Tinder</h1>
      <p class="helper">Legends from every plane and every era, one at a time. Swipe right if you like them, left if you don't. The game ends when someone swipes back.</p>
      <p class="tq">Who are you here for?</p>
      <div class="tprefs">${Object.entries(PREFS).map(([k, p]) => `<button type="button" class="btn ${k === "everyone" ? "outlined" : "filled"}" data-pref="${k}">${p.label}</button>`).join("")}</div>
      <p class="helper tsmall">Card art via Scryfall's art tags. Nothing here touches your deck or your shortlist.</p>
    </section>
    <section class="tdeck" id="t-deck" hidden>
      <header class="thead"><div class="ttitle"><img src="${SYM.R}" alt="">Commander Tinder</div><button type="button" class="icon-btn" data-close aria-label="Close">${X}</button></header>
      <div class="tstack" id="t-stack"><p class="helper tstatus" id="t-status">Finding legends near you…</p></div>
      <div class="tactions">
        <button type="button" class="round nope" id="t-nope" aria-label="Nope"><img src="${SYM.B}" alt=""></button>
        <span class="helper tcount" id="t-count"></span>
        <button type="button" class="round like" id="t-like" aria-label="Like"><img src="${SYM.R}" alt=""></button>
      </div>
      <div class="snackbar" id="t-snack" hidden></div>
    </section>
    <section class="tmatch" id="t-match" hidden>
      <button type="button" class="icon-btn tclose" data-close aria-label="Close">${X}</button>
      <div class="tsparks" id="t-sparks"></div>
      <h2>It's a match!</h2>
      <div class="tpair"><img class="tavatar you" id="m-you" alt=""><img class="tflame" src="${SYM.R}" alt=""><img class="tavatar them" id="m-them" alt=""></div>
      <p id="m-text"></p>
      <div class="tchat" id="m-chat" hidden></div>
      <div class="tprefs">
        <button type="button" class="btn filled" id="m-hello">Say hello</button>
        <button type="button" class="btn tonal" id="m-again">Keep swiping</button>
        <button type="button" class="btn text" data-close>Back to deck building</button>
      </div>
    </section>`;
  document.body.appendChild(dlg);
  dlg.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeTinder));
  dlg.querySelectorAll("[data-pref]").forEach(b => b.addEventListener("click", () => start(b.dataset.pref)));
  $("#t-like").addEventListener("click", () => decide(1));
  $("#t-nope").addEventListener("click", () => decide(-1));
  $("#m-hello").addEventListener("click", sayHello);
  $("#m-again").addEventListener("click", keepSwiping);
  dlg.addEventListener("close", teardown); dlg.addEventListener("cancel", teardown);   // Esc closes too
  dlg.addEventListener("keydown", e => { if (!game || !game.started) return; if (e.key === "ArrowRight") decide(1); if (e.key === "ArrowLeft") decide(-1); });
  window.addEventListener("hashchange", closeTinder);
  bindPointer($("#t-stack"));
  return dlg;
}
const X = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

/** Forget the game and drop the profiles, so a later knock starts clean and nothing keeps fetching. */
function teardown() { game = null; if (dlg) dlg.querySelectorAll(".tcard").forEach(n => n.remove()); }
function closeTinder() { teardown(); if (dlg && dlg.open) dlg.close(); }
function show(id) { for (const s of ["t-intro", "t-deck", "t-match"]) $("#" + s).hidden = s !== id; }

export function openTinder() {
  ensureDialog();
  game = { seq: ++seqCounter, started: false, pref: null, q: "", queue: [], seen: new Set(), swipes: 0, fetching: 0, dragged: false, matched: null };
  show("t-intro");
  if (!dlg.open) dlg.showModal();
}

function start(prefKey) {
  const p = PREFS[prefKey]; if (!p) return;
  game.pref = prefKey; game.q = `${POOL} ${p.q}`; game.started = true;
  game.queue = []; game.swipes = 0; game.matched = null;
  show("t-deck");
  $("#t-status").hidden = false; $("#t-status").textContent = "Finding legends near you…";
  renderStack();
  fill();
}

/** Keep a few profiles ready so a swipe never waits on the network. Repeats (same oracle text) are thrown back. */
function fill() {
  if (!game || !game.started) return;
  const seq = game.seq;
  while (game.queue.length + game.fetching < PREFETCH) {
    game.fetching++;
    randomCard(game.q).then(c => {
      if (!game || game.seq !== seq) return;
      game.fetching--;
      if (!artOf(c) || game.seen.has(c.oracle_id)) { fill(); return; }
      game.seen.add(c.oracle_id); game.queue.push(c);
      renderStack();
    }).catch(err => {
      if (!game || game.seq !== seq) return;
      game.fetching--;
      console.warn("Commander Tinder: no card", err);
      if (!game.queue.length) { $("#t-status").hidden = false; $("#t-status").textContent = "Scryfall isn't answering. Try again in a moment."; }
    });
  }
}

function cardNode(c) {
  const f = faceOf(c), year = (c.released_at || "").slice(0, 4);
  const bio = f.flavor_text || c.flavor_text || firstSentence(f.oracle_text || c.oracle_text) || "Prefers to let the art do the talking.";
  const el = document.createElement("article");
  el.className = "tcard"; el.dataset.id = c.id;
  el.innerHTML = `
    <div class="tphoto"><img class="tart" src="${artOf(c)}" alt="" draggable="false" decoding="async"><img class="tfull" src="${imageOf(c)}" alt="" draggable="false" decoding="async" hidden></div>
    <div class="tinfo">
      <div class="tname">${esc(frontName(c))}<span class="tage">${c.cmc ?? 0}<small>mv</small></span></div>
      <div class="tline">${esc(typeOf(c))}</div>
      <div class="tline dim">${esc(c.set_name || "")}${year ? ` · ${year}` : ""}</div>
      <p class="tbio">${esc(bio)}</p>
    </div>
    <span class="stamp yes" aria-hidden="true"><img src="${SYM.R}" alt=""><b>Like</b></span>
    <span class="stamp no" aria-hidden="true"><img src="${SYM.B}" alt=""><b>Nope</b></span>`;
  // Tap the photo to see the whole card, tap again for the portrait.
  el.addEventListener("click", () => {
    if (!game || game.dragged || !el.classList.contains("cur")) return;
    const full = el.classList.toggle("full");
    el.querySelector(".tfull").hidden = !full; el.querySelector(".tart").hidden = full;
  });
  return el;
}

/** The top two profiles: the current one and the next peeking out from behind it. Nodes keep their identity so the promotion animates. */
function renderStack() {
  if (!game) return;
  const stack = $("#t-stack"), [a, b] = game.queue;
  const keep = new Set([a, b].filter(Boolean).map(c => c.id));
  stack.querySelectorAll(".tcard").forEach(n => { if (!keep.has(n.dataset.id)) n.remove(); });
  for (const [c, cls] of [[b, "next"], [a, "cur"]]) {
    if (!c) continue;
    let n = stack.querySelector(`.tcard[data-id="${c.id}"]`);
    if (!n) { n = cardNode(c); n.classList.add("far"); stack.appendChild(n); void n.offsetWidth; }
    n.className = `tcard ${cls}`; n.style.transform = ""; n.style.removeProperty("--yes"); n.style.removeProperty("--no");
  }
  $("#t-status").hidden = !!a;
  $("#t-like").disabled = $("#t-nope").disabled = !a;
  $("#t-count").textContent = game.swipes ? `${game.swipes} swipe${game.swipes === 1 ? "" : "s"} · no match yet` : "Swipe right if you like them";
}

/** +1 = like, -1 = nope. The card flies off, then luck decides. */
function decide(dir) {
  if (!game || !game.started) return;
  const el = $(".tcard.cur"), c = game.queue[0]; if (!el || !c) return;
  el.style.transform = ""; el.classList.add(dir > 0 ? "fly-right" : "fly-left");
  pulse(dir > 0 ? "t-like" : "t-nope");
  setTimeout(() => {
    if (!game || game.queue[0] !== c) return;
    game.swipes++;
    game.queue.shift();
    if (dir > 0 && Math.random() < matchOdds()) { match(c); return; }
    if (dir < 0 && Math.random() < 0.07) snack(`${frontName(c)} had already swiped right on you. Their loss.`);
    renderStack(); fill();
  }, FLY_MS);
}
/** Starts at roughly one in sixteen and creeps up, so the game rarely drags on past thirty swipes. */
function matchOdds() { return Math.min(0.35, 0.06 + 0.012 * game.swipes); }

function pulse(id) { const b = $("#" + id); b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse"); }
function snack(msg) {
  const el = $("#t-snack"); el.textContent = msg; el.hidden = false;
  clearTimeout(snackTimer); snackTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

function match(c) {
  game.matched = c;
  const you = store.deck && store.deck.commander && store.deck.commander.chosen;
  $("#m-you").src = (you && (you.art || you.image)) || YOU_SVG;
  $("#m-them").src = artOf(c);
  $("#m-text").textContent = `You and ${frontName(c)} liked each other. It only took ${game.swipes} swipe${game.swipes === 1 ? "" : "s"}.`;
  $("#m-chat").hidden = true; $("#m-chat").innerHTML = ""; $("#m-hello").hidden = false;
  $("#t-sparks").innerHTML = Array.from({ length: 10 }, (_, i) => `<img src="${SYM.R}" alt="" style="left:${6 + i * 9}%;animation-delay:${(i * 0.17).toFixed(2)}s;animation-duration:${(2.2 + (i % 3) * 0.5).toFixed(1)}s">`).join("");
  show("t-match");
}
function sayHello() {
  const c = game && game.matched; if (!c) return;
  const type = typeOf(c), hit = OPENERS.find(([re]) => re.test(type) || re.test(c.name));
  const line = hit ? hit[1] : pick(FALLBACKS).replace("{type}", type);
  const chat = $("#m-chat"); chat.hidden = false; $("#m-hello").hidden = true;
  chat.innerHTML = `<div class="bubble me">${esc(line)}</div><div class="bubble them typing"><span></span><span></span><span></span></div>`;
  setTimeout(() => { if (!game || game.matched !== c) return; chat.querySelector(".typing").outerHTML = `<div class="bubble them">${esc(pick(REPLIES))}</div>`; }, 1400);
}
function keepSwiping() {
  if (!game) return;
  game.matched = null; game.swipes = 0;
  show("t-deck"); renderStack(); fill();
}

/** Drag the top profile: it tilts as it goes, the stamp for that side fades in, and past the threshold it flies. */
function bindPointer(stack) {
  let start = null, el = null;
  stack.addEventListener("pointerdown", e => {
    if (!game) return;
    el = e.target.closest(".tcard.cur"); if (!el) return;
    start = { x: e.clientX, y: e.clientY }; game.dragged = false;
    el.classList.add("dragging");
    try { stack.setPointerCapture(e.pointerId); } catch {}
  });
  stack.addEventListener("pointermove", e => {
    if (!start || !el) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) game.dragged = true;
    el.style.transform = `translate(${dx}px, ${dy * 0.35}px) rotate(${dx / 14}deg)`;
    el.style.setProperty("--yes", Math.max(0, Math.min(1, dx / SWIPE)));
    el.style.setProperty("--no", Math.max(0, Math.min(1, -dx / SWIPE)));
  });
  const end = e => {
    if (!start || !el) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    const decided = Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy);
    el.classList.remove("dragging"); el.style.transform = "";
    if (!decided) { el.style.removeProperty("--yes"); el.style.removeProperty("--no"); }
    el = null; start = null;
    if (decided) decide(dx > 0 ? 1 : -1);
    setTimeout(() => { if (game) game.dragged = false; }, 0);
  };
  stack.addEventListener("pointerup", end);
  stack.addEventListener("pointercancel", end);
}
