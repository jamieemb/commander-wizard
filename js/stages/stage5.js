// Stage 5: Cut the plan cards until the deck is 99, add the basics, export it for goldfishing.
// One sheet: where the deck stands as squares, the plan cards with Cut buttons, basics and curve, then the export.
import { store, deckName } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc } from "../sections/colours.js";
import { aimSentence } from "../sections/aim.js";
import { TOTAL_SLOTS, CURVE_TEMPLATE, CATEGORIES, targetsOf, nonBasicDefault } from "../numbers.js";
import { analyseEntries, basicSplit, categoryState, BASIC_NAME } from "../deckcheck.js";
import { decklist, keyOf } from "../decklist.js";
import { rowHTML, bindRows, cutOrder } from "../sections/cutlist.js";
import { bindPeek } from "../peek.js";
import { eurToGBP, fmtGBP } from "../scryfall.js";

const ICON_COPY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

export function renderStage5(root, { goToStage }) {
  const d = store.deck, c = d.commander.chosen;
  const colors = d.colours.colors || "";
  const targets = targetsOf(d);
  const aim = aimSentence(d.aim);
  let fmt = "archidekt";

  root.innerHTML = `
    <div class="stage-body s5">
      <section class="sheet">
        <header class="sheet-head">
          <div class="sheet-who">
            ${c ? `<div class="sheet-name">${pips(colors)}<span>${esc(c.name)}</span></div>
            <div class="sheet-meta helper">${targets.lands} lands · whatever is over ${TOTAL_SLOTS} comes out of the plan cards; basics go in last.${aim ? ` · ${esc(aim)}` : ""}</div>`
            : `<div class="sheet-name">No commander yet</div><div class="helper"><a href="#wizard/1">Choose one in Stage 1</a> first.</div>`}
          </div>
        </header>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">1 · Where the deck stands</span><span class="helper" id="an-status"></span></div>
          <div class="stats report" id="report"></div>
          <div id="verdict" class="helper"></div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">2 · Cut the plan cards</span><span class="helper">Cut what doesn't help the aim, then by the mana-value test: a 6+ must win or swing the game, a 5 a big advantage that turn, a 4 strong synergy, a 1 to 3 value every turn. Keep 1 to 2 finishers, at most four cards that do nothing alone, and 6+ cards to 8 to 10.</span></div>
          <div class="cutlists one" id="plan"></div>
        </div>

        <div class="sheet-row">
          <div id="detail"></div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">4 · Export for goldfishing</span><span class="helper">Into Archidekt (categories and tags travel with the cards) or Moxfield (plain list). Goldfish there, then change three to five cards at a time after real games, never the lands.</span></div>
          <div class="exportrow">
            <div class="segmented" role="radiogroup" aria-label="Format" id="fmt">
              <button type="button" role="radio" data-fmt="archidekt" aria-checked="true" class="selected">Archidekt</button>
              <button type="button" role="radio" data-fmt="moxfield" aria-checked="false">Moxfield</button>
            </div>
            <button type="button" class="btn filled small" id="x-copy">${ICON_COPY}Copy the deck</button>
            <button type="button" class="btn outlined small" id="x-download">Download .txt</button>
            <span class="helper" id="x-note"></span>
          </div>
        </div>

        <div class="sheet-row" id="after" hidden>
          <span class="sheet-label">After 99</span>
          <p class="rules-text">Goldfish it: keep only hands with three lands and a ramp or draw card, play to turn 7 making every land drop, and ask "could I win a real game from here within two turns?" Twenty runs find most problems: missed land drops mean draw, a full hand means the curve is too high, a big board with no win means a finisher.</p>
        </div>
      </section>
    </div>
    <div class="stage-footer">
      <span class="helper" id="c-progress" data-save-note></span>
      <button type="button" class="btn filled" id="c-done">The deck is 99 ✓</button>
    </div>`;

  const f = id => root.querySelector("#" + id);
  const persist = () => { store.save(); markDirty(); };
  let report = null, facts = {};

  function math() {
    const nonBasic = d.numbers.nonBasics ?? nonBasicDefault(targets.lands);
    const basicsNeeded = Math.max(0, targets.lands - report.lands);
    const finalSize = report.total + basicsNeeded;
    const cutN = finalSize - TOTAL_SLOTS;
    const planAfter = report.counts.plan - Math.max(0, cutN);
    const vegOver = CATEGORIES.filter(x => x.key !== "lands" && categoryState(report, x.key, targets[x.key]).state === "over").map(x => x.label);
    if (report.nonbasics > nonBasic) vegOver.push("Non-basic lands");
    return { basicsNeeded, finalSize, cutN, planAfter, tooManyLands: report.lands > targets.lands, vegOver, basicsWanted: Math.max(0, targets.lands - report.nonbasics) };
  }

  async function load(first = false) {
    decklist.syncPlan();
    if (first) f("an-status").textContent = "Reading the deck…";
    try {
      const full = await analyseEntries(decklist.entries(true));   // resolves every name once; the live count below is then served from the cache
      const live = await decklist.analyse();
      if (!root.isConnected) return;
      report = live; facts = Object.fromEntries(full.cards.map(x => [keyOf(x.name), x]));
    } catch { f("an-status").textContent = "Scryfall isn't answering; counts may be off."; if (!report) return; }
    draw();
  }

  function draw() {
    if (!decklist.hasPackages()) {
      f("an-status").textContent = ""; f("report").innerHTML = `<p class="helper">No packages in the deck yet. <a href="#wizard/3">Add them in Stage 3.</a></p>`;
      f("plan").innerHTML = ""; f("detail").innerHTML = ""; f("verdict").textContent = ""; updateProgress(); return;
    }
    const m = math();
    const splitColors = colors || ["W", "U", "B", "R", "G"].filter(k => report.pips[k] > 0).join("");
    const split = basicSplit(report.pips, m.basicsWanted, splitColors);
    const scale = Math.max(1, ...Object.values(report.curve), ...Object.values(CURVE_TEMPLATE));
    f("an-status").textContent = `${report.total} cards in the deck · ${fmtGBP(eurToGBP(report.price))} as it stands${report.unknown.length ? ` · ${report.unknown.length} not found on Scryfall` : ""}`;
    f("report").innerHTML = `
      <div class="stat derived"><span class="stat-label">In the deck</span><span class="stat-value">${report.total}</span><span class="stat-sub">excluding the commander</span></div>
      <div class="stat derived ${m.basicsNeeded ? "warn" : "ok"}"><span class="stat-label">Basics to add</span><span class="stat-value">${m.basicsNeeded}</span><span class="stat-sub">${report.lands} lands in, target ${targets.lands}</span></div>
      <div class="stat derived ${m.cutN === 0 ? "ok" : "over"}"><span class="stat-label">Size after basics</span><span class="stat-value">${m.finalSize}<small>/${TOTAL_SLOTS}</small></span><span class="stat-sub">${m.cutN > 0 ? `cut ${m.cutN} plan card${m.cutN === 1 ? "" : "s"}` : m.cutN < 0 ? `room for ${-m.cutN} more` : "exactly right"}</span></div>
      <div class="stat derived"><span class="stat-label">Plan cards</span><span class="stat-value">${report.counts.plan}</span><span class="stat-sub">${m.cutN > 0 ? `${m.planAfter} after the cut` : "as they stand"}</span></div>
      <div class="stat derived ${report.sixPlus <= 10 ? "ok" : "over"}"><span class="stat-label">Six-plus</span><span class="stat-value">${report.sixPlus}</span><span class="stat-sub">${report.sixPlus > 10 ? `cut ${report.sixPlus - 10} to reach 10` : "aim for 8 to 10"}</span></div>`;
    f("verdict").innerHTML = m.vegOver.length ? `<span class="error">Stage 4 is not finished: ${esc(m.vegOver.join(", "))} still over the number. <a href="#wizard/4">Cut those first.</a></span>`
      : m.tooManyLands ? `<span class="error">${report.lands} lands against a target of ${targets.lands}: cut lands before plan cards.</span>`
      : m.cutN > 0 && m.planAfter < 20 ? `That would leave only ${m.planAfter} plan cards. If the deck feels thin, revisit a vegetable number in Stage 2 rather than cutting deeper.` : "";

    // the plan cards, one list, cutting order
    const plan = decklist.all().filter(e => e.cats.includes("plan")).sort(cutOrder(facts));
    const cutSoFar = plan.filter(e => e.cut).length;
    const planCost = plan.filter(e => !e.cut).reduce((n, e) => n + ((facts[e.key] || {}).eur || 0) * e.qty, 0);
    f("plan").innerHTML = `<div class="cgroup"><div class="cgroup-head"><span>Plan cards <small>${report.counts.plan} · ${fmtGBP(eurToGBP(planCost))}</small></span><span class="state ${m.cutN > 0 ? "over" : "ok"}">${m.cutN > 0 ? `cut ${m.cutN} more` : "at 99"}${cutSoFar ? ` · ${cutSoFar} cut so far` : ""}</span></div>${plan.map(e => rowHTML(e, facts, "plan")).join("") || `<p class="helper">No plan cards. <a href="#wizard/3">Gather them in Stage 3.</a></p>`}</div>`;
    bindRows(f("plan"), () => load());
    bindPeek(f("plan").querySelectorAll(".crow-name"), el => el.dataset.large || null);

    // basics and the curve
    const inDeck = decklist.basics();
    f("detail").innerHTML = `
      <div class="s5-detail">
        <div>
          <div class="sheet-label">3 · Basics, by the colour symbols in your spells</div>
          ${m.basicsWanted ? `<div class="stats basics-split">${Object.entries(split).filter(([, n]) => n > 0).map(([col, n]) => `<div class="stat derived"><span class="stat-label">${pips(col)} ${BASIC_NAME[col]}</span><span class="stat-value">${n}</span></div>`).join("")}</div>` : ""}
          <div class="pkg">
            ${inDeck ? `<span>${inDeck} basics in the deck.</span><button type="button" class="btn text small" id="b-redo">Recalculate</button><button type="button" class="btn text small danger" id="b-remove">Remove basics</button>`
              : m.basicsWanted ? `<button type="button" class="btn tonal small" id="b-add">Add these ${m.basicsWanted} basics</button>` : `<span class="helper">None needed: the land count is already met.</span>`}
          </div>
          <div class="helper">Pips counted: ${["W", "U", "B", "R", "G"].filter(k => report.pips[k]).map(k => `${k} ${report.pips[k]}`).join(" · ") || "none"}. Nudge one toward your turn-1 and turn-2 colours if it is close.</div>
        </div>
        <div>
          <div class="sheet-label">Curve of the non-land cards · template 9 / 19 / 16 / 10 / 5 / 5</div>
          <div class="curve">${[1, 2, 3, 4, 5, 6].map(mv => `<div class="curve-col"><div class="curve-bars"><div class="curve-bar tmpl" style="height:${CURVE_TEMPLATE[mv] / scale * 100}%"></div><div class="curve-bar yours" style="height:${report.curve[mv] / scale * 100}%"></div></div><div class="curve-x">${mv === 6 ? "6+" : mv}</div><div class="curve-n">${report.curve[mv]}<small>/${CURVE_TEMPLATE[mv]}</small></div></div>`).join("")}</div>
          <div class="helper">Grey is the template, blue is yours. The 2-mana bar should be tallest.</div>
        </div>
      </div>`;
    const bAdd = f("detail").querySelector("#b-add"), bRedo = f("detail").querySelector("#b-redo"), bRemove = f("detail").querySelector("#b-remove");
    if (bAdd) bAdd.addEventListener("click", () => { decklist.setBasics(split); load(); });
    if (bRedo) bRedo.addEventListener("click", () => { decklist.setBasics(basicSplit(report.pips, m.basicsWanted, splitColors)); load(); });
    if (bRemove) bRemove.addEventListener("click", () => { decklist.setBasics({}); load(); });
    updateProgress();
  }

  // ----- export -----
  root.querySelectorAll("#fmt [data-fmt]").forEach(b => b.addEventListener("click", () => {
    fmt = b.dataset.fmt;
    root.querySelectorAll("#fmt [data-fmt]").forEach(x => { const on = x === b; x.classList.toggle("selected", on); x.setAttribute("aria-checked", String(on)); });
    f("x-note").textContent = fmt === "archidekt" ? "Archidekt: new deck → Import → paste." : "Moxfield: new deck → Import → paste, then set the commander.";
  }));
  const flash = (btn, text) => { const old = btn.innerHTML; btn.innerHTML = text; btn.classList.add("done"); setTimeout(() => { btn.innerHTML = old; btn.classList.remove("done"); }, 1400); };
  f("x-copy").addEventListener("click", async () => {
    const text = decklist.toText(fmt); if (!text) { flash(f("x-copy"), "Nothing to copy"); return; }
    try { await navigator.clipboard.writeText(text); flash(f("x-copy"), `Copied ${decklist.live().reduce((n, e) => n + e.qty, 0) + (c ? 1 : 0)} cards`); } catch { flash(f("x-copy"), "Copy blocked"); }
  });
  f("x-download").addEventListener("click", () => {
    const blob = new Blob([decklist.toText(fmt)], { type: "text/plain" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${deckName(d).replace(/[\\/:*?"<>|]+/g, "-")}${fmt === "moxfield" ? " (moxfield)" : ""}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function updateProgress() {
    const btn = f("c-done");
    f("after").hidden = !d.completed[5];
    if (!report || !decklist.hasPackages()) { f("c-progress").textContent = "Add the packages in Stage 3"; btn.classList.add("disabled"); btn.setAttribute("aria-disabled", "true"); return; }
    const m = math();
    const sizeOk = m.cutN === 0, landsOk = !m.tooManyLands, sixOk = report.sixPlus <= 10;
    const ok = !!(c && sizeOk && landsOk && sixOk && !m.vegOver.length && !m.basicsNeeded);
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("c-progress").textContent = m.vegOver.length ? "Finish Stage 4 first" : !sizeOk ? (m.cutN > 0 ? `${m.cutN} over: cut plan cards` : `${-m.cutN} under: add plan cards or basics`) : !landsOk ? "Too many lands" : !sixOk ? `${report.sixPlus} six-plus cards: cut to 10` : m.basicsNeeded ? `Add the ${m.basicsNeeded} basics` : d.completed[5] ? "Done. The deck is 99." : saveNote();
  }
  f("c-done").addEventListener("click", () => { if (f("c-done").classList.contains("disabled")) return; d.completed[5] = true; persist(); updateProgress(); f("after").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  updateProgress();
  load(true);
}
