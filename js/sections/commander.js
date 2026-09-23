// Section: the commander. Picked on Scryfall; here you type its name so the card can be fetched and its text read.
import { cardNamed, imageOf, largeImageOf, artOf, oracleOf, priceEUR } from "../scryfall.js";
import { bindPeek } from "../peek.js";
import { store } from "../store.js";
import { markDirty } from "../app.js";
import { pips, esc, identityFor } from "./colours.js";
import { analyse, JOB_LABEL } from "../reading.js";
import { traitIcon, traitTitles } from "../traits.js";
export { analyse, JOB_LABEL };   // stages 2–5 import these from here

function thumbOf(card) {
  const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]);
  return face && face.image_uris ? face.image_uris.small : null;
}
function compact(card) {
  const a = analyse(card);
  return {
    id: card.id, name: card.name, uri: card.scryfall_uri, image: imageOf(card), large: largeImageOf(card), thumb: thumbOf(card), art: artOf(card),
    manaCost: card.mana_cost || (card.card_faces && card.card_faces[0].mana_cost) || "",
    mv: card.cmc ?? 0, colors: (card.color_identity || []).join("") || "C",   // Scryfall already orders these WUBRG
    typeLine: card.type_line || "", oracle: oracleOf(card), eur: priceEUR(card),
    jobs: a.jobs, scales: a.scales, protects: a.protects, mean: a.mean, suggestedKeywords: a.keywords,
  };
}

export function rampAdvice(mv) {
  return mv <= 2 ? "Cast it on turn 2; run 3-mana ramp afterwards and fewer pieces."
    : mv === 3 ? "1-mana ramp (elves, Wild Growth, Utopia Sprawl), or a proactive 2-drop it pays off."
    : mv === 4 ? "2-mana rocks and land ramp (Arcane Signet, Talismans, Rampant Growth). Never 3-mana ramp."
    : mv === 5 ? "3-mana ramp (Cultivate, Worn Powerstone) plus plenty of 2-drops so turns 1-2 aren't empty."
    : "2-mana rocks that lead into 4-mana rocks (Thran Dynamo, Skyshroud Claim). Unfashionable 4-mana ramp is cheap.";
}

const ROLES = [["engine", "Engine"], ["amplifier", "Amplifier"], ["payoff", "Payoff"], ["helper", "Helper"]];
const TIMINGS = [["setup", "Cast as setup"], ["finisher", "Cast as finisher"]];
const MAX_CHIPS = 10;

/** The search bar (rendered above the stepper). Calls onChange() after a successful lookup. */
export function renderCommanderSearch(container, { onChange }) {
  const d = store.deck, cmd = d.commander;
  container.innerHTML = `
    <form class="search-bar" id="lookup" role="search">
      <span class="search-glyph" aria-hidden="true">⌕</span>
      <input type="search" id="cmd-name" placeholder="Commander name" aria-label="Commander name" value="${cmd.chosen ? esc(cmd.chosen.name) : ""}" autocomplete="off" enterkeyhint="search">
      <button class="btn filled" type="submit">Look up</button>
    </form>
    <p class="helper" id="lookup-status"></p>`;
  const f = id => container.querySelector("#" + id);
  const status = f("lookup-status");
  const idle = () => {
    status.className = "helper";
    status.innerHTML = `No commander in mind? <a href="#find">Browse colour identities</a> first.`;
  };
  idle();

  f("lookup").addEventListener("submit", async e => {
    e.preventDefault();
    const name = f("cmd-name").value.trim(); if (!name) return;
    status.className = "helper"; status.textContent = "Asking Scryfall…";
    try {
      const card = await cardNamed(name);
      if (!/Legendary/.test(card.type_line || "") && !/can be your commander/i.test(oracleOf(card))) {
        status.className = "helper error"; status.textContent = `${card.name} cannot lead a deck.`; return;
      }
      const c = compact(card);
      const same = cmd.chosen && cmd.chosen.id === c.id;
      cmd.chosen = c;
      if (!same) { cmd.keywords = c.suggestedKeywords.slice(0, MAX_CHIPS); cmd.checks.notMean = false; }
      if (!cmd.role) cmd.role = "engine";
      if (!cmd.timing) cmd.timing = "setup";
      const ident = identityFor(c.colors);
      d.colours.colors = c.colors; d.colours.colorId = ident ? ident.id : null; d.colours.colorName = ident ? ident.name : c.colors;
      f("cmd-name").value = c.name;
      store.save(); markDirty(); idle(); onChange && onChange();
    } catch {
      status.className = "helper error"; status.innerHTML = `Not found — try the full name, or <a href="#find">find a commander</a>.`;
    }
  });

  // Arriving from "Use in Deck Builder" on the Find screen: look the handed-over name up straight away.
  let pending = null;
  try { pending = sessionStorage.getItem("cw:pendingCommander"); if (pending) sessionStorage.removeItem("cw:pendingCommander"); } catch {}
  if (pending) { f("cmd-name").value = pending; f("lookup").requestSubmit(); }
}

/** "Scales against three opponents · protects itself", each part with its green-or-grey icon, as on the shortlist. */
function traitLine(c) {
  const scales = c.scales === "good", titles = traitTitles({ scales, protects: c.protects });
  return `<span class="trait-line">${traitIcon("scales", scales, titles.scales, "sm")}<span>${scales ? "Scales against three opponents" : "Does not scale against the table"}</span><span class="dot">·</span>${traitIcon("protects", c.protects, titles.protects, "sm")}<span>${c.protects ? "protects itself" : "does not protect itself"}.</span></span>`;
}

function readLines(c) {
  const does = c.jobs.map(j => JOB_LABEL[j]);
  return {
    read: does.length ? `Does by itself: ${does.join(", ")}.` : "Does nothing by itself — the deck must supply every job.",
    miss: `${c.scales === "good" ? "Scales against three opponents" : "Does not scale against the table"} · ${c.protects ? "protects itself" : "does not protect itself"}.`,
  };
}

/** Summary card, key-word chips, role/timing segments and the fairness check. Calls onChange() on every edit. */
export function renderCommanderSection(container, { onChange, onChangeCommander }) {
  const d = store.deck, cmd = d.commander, c = cmd.chosen;
  function persist() { store.save(); markDirty(); onChange && onChange(); }
  if (!c) { container.innerHTML = ""; return; }
  const ident = identityFor(c.colors);
  const lines = readLines(c);
  container.innerHTML = `
    <section class="summary">
      ${onChangeCommander ? `<button type="button" class="btn text small summary-change" id="change-cmd">Change commander</button>` : ""}
      <div class="thumb" title="Read the card">${(c.thumb || c.image) ? `<img src="${c.thumb || c.image}" alt="" loading="lazy">` : ""}</div>
      <div class="summary-body">
        <h2 class="summary-name">${esc(c.name)}</h2>
        <div class="summary-meta">${pips(c.colors)}<span class="meta">${esc(ident ? ident.name : c.colors)}</span><span class="meta">MV ${c.mv}</span><span class="meta">${esc(c.typeLine)}</span></div>
        <div class="summary-read">${esc(lines.read)}</div>
        <div class="summary-miss">${traitLine(c)}${c.mean ? ` <span class="error">Its text mentions stealing or locking.</span>` : ""}</div>
      </div>
    </section>

    <section class="block">
      <div class="label-row"><span class="label">Key words</span><span class="helper">Tap to drop one</span></div>
      <div class="chip-row wrap" id="kws"></div>
    </section>

    <section class="block">
      <span class="label">Role in the deck</span>
      <div class="seg-row">
        <div class="segmented" role="radiogroup" aria-label="Role" id="role">${ROLES.map(([k, l]) => `<button type="button" role="radio" aria-checked="${cmd.role === k}" class="${cmd.role === k ? "selected" : ""}" data-k="${k}">${l}</button>`).join("")}</div>
        <div class="segmented" role="radiogroup" aria-label="Timing" id="timing">${TIMINGS.map(([k, l]) => `<button type="button" role="radio" aria-checked="${cmd.timing === k}" class="${cmd.timing === k ? "selected" : ""}" data-k="${k}">${l}</button>`).join("")}</div>
      </div>
      <label class="checkrow"><input type="checkbox" id="notmean" ${cmd.checks.notMean ? "checked" : ""}>It doesn't steal, lock people out or form half of a two-card combo.</label>
    </section>`;
  // Hover the thumbnail (tap on a phone) to read the full card while writing the aim.
  bindPeek(container.querySelector(".thumb"), () => c.large || c.image, { tap: true });
  const f = id => container.querySelector("#" + id);

  function renderKws() {
    const box = f("kws");
    const all = Array.from(new Set([...c.suggestedKeywords.slice(0, MAX_CHIPS), ...cmd.keywords]));
    box.innerHTML = all.map(k => { const on = cmd.keywords.includes(k); return `<button type="button" class="chip ${on ? "selected" : ""}" aria-pressed="${on}" data-kw="${esc(k)}">${esc(k)}</button>`; }).join("");
    box.querySelectorAll("[data-kw]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.kw;
      cmd.keywords = cmd.keywords.includes(k) ? cmd.keywords.filter(x => x !== k) : [...cmd.keywords, k];
      persist(); renderKws();
    }));
  }
  function bindSeg(id, key) {
    f(id).querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => {
      cmd[key] = b.dataset.k;
      f(id).querySelectorAll("[data-k]").forEach(x => { const on = x.dataset.k === cmd[key]; x.classList.toggle("selected", on); x.setAttribute("aria-checked", String(on)); });
      persist();
    }));
  }
  bindSeg("role", "role"); bindSeg("timing", "timing");
  const change = f("change-cmd");
  if (change) change.addEventListener("click", () => onChangeCommander());
  f("notmean").addEventListener("change", e => { cmd.checks.notMean = e.target.checked; persist(); });
  renderKws();
}
