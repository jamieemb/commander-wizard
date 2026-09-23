// Stage 5: Cut the plan cards until the deck is 99, then add the basics.
// One sheet: paste the export, see where the deck stands as squares, the basics split and the curve, then the rules.
import { store } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc } from "../sections/colours.js";
import { aimSentence } from "../sections/aim.js";
import { TOTAL_SLOTS, CURVE_TEMPLATE, CATEGORIES, targetsOf, nonBasicDefault } from "../numbers.js";
import { analyseDeck, basicSplit, categoryState, BASIC_NAME } from "../deckcheck.js";

export function renderStage5(root, { goToStage }) {
  const d = store.deck, cut = d.cut, c = d.commander.chosen;
  const colors = d.colours.colors || "";
  const targets = targetsOf(d);
  const aim = aimSentence(d.aim);

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
          <div class="label-row"><span class="sheet-label">1 · Paste the deck</span><span class="helper">Cut in Archidekt, paste again, until the size square says 99.</span></div>
          <div class="counter">
            <textarea id="paste" class="paste" placeholder="1 Arcane Signet [Ramp]&#10;1 Impact Tremors [Plan]&#10;…">${esc(cut.pasted5 || "")}</textarea>
            <button type="button" class="btn tonal small" id="analyse">Check</button>
          </div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">2 · Where the deck stands</span><span class="helper" id="an-status"></span></div>
          <div class="stats report" id="report"><p class="helper">Paste and check.</p></div>
          <div id="verdict" class="helper"></div>
          <div id="detail"></div>
        </div>

        <div class="sheet-row">
          <span class="sheet-label">3 · Which plan cards go</span>
          <ol class="rules">
            <li><b>Anything that does not help the aim</b>, however good it is.</li>
            <li><b>At most four cards that do nothing alone</b>: doublers, "whenever you cast" payoffs.</li>
            <li><b>Mana-value test.</b> A 6+ must win or swing the game when it lands; a 5 must give a big advantage that turn; a 4 must be strongly synergistic; a 1 to 3 must give value every turn. Keep 6+ cards to 8 to 10.</li>
            <li><b>Two one-job cards → one card that does both.</b> Every swap frees a slot.</li>
            <li><b>Keep 1 to 2 finishers</b> and 2 to 3 payoffs that close from a big board.</li>
            <li><b>Tie-break</b> by synergy, then by the lower mana value.</li>
          </ol>
        </div>

        <div class="sheet-row" id="after" hidden>
          <span class="sheet-label">After 99</span>
          <p class="rules-text">Goldfish it in Archidekt: keep only hands with three lands and a ramp or draw card, play to turn 7 making every land drop, and ask "could I win a real game from here within two turns?" Twenty runs find most problems: missed land drops mean draw, a full hand means the curve is too high, a big board with no win means a finisher. Then change three to five cards at a time after real games, never the lands.</p>
        </div>
      </section>
    </div>
    <div class="stage-footer">
      <span class="helper" id="c-progress" data-save-note></span>
      <button type="button" class="btn filled" id="c-done">The deck is 99 ✓</button>
    </div>`;

  const f = id => root.querySelector("#" + id);
  const persist = () => { store.save(); markDirty(); };
  let report = cut.report5 || null;

  f("paste").addEventListener("input", e => { cut.pasted5 = e.target.value; persist(); });
  f("analyse").addEventListener("click", async () => {
    f("an-status").textContent = "Reading…";
    report = await analyseDeck(f("paste").value);
    cut.report5 = report; persist();
    render();
  });

  function math() {
    const basicsNeeded = Math.max(0, targets.lands - report.lands);
    const finalSize = report.total + basicsNeeded;
    const cutN = finalSize - TOTAL_SLOTS;
    const planAfter = report.counts.plan - Math.max(0, cutN);
    const nonBasic = d.numbers.nonBasics ?? nonBasicDefault(targets.lands);
    const vegOver = CATEGORIES.filter(x => x.key !== "lands" && categoryState(report, x.key, targets[x.key]).state === "over").map(x => x.label);
    if (report.nonbasics > nonBasic) vegOver.push("Non-basic lands");
    return { basicsNeeded, finalSize, cutN, planAfter, tooManyLands: report.lands > targets.lands, vegOver };
  }

  function render() {
    if (!report || !report.total) { f("an-status").textContent = report ? "Nothing recognised. Paste an Archidekt text export." : ""; updateProgress(); return; }
    const m = math();
    // No identity chosen yet: split by the colours the spells actually use rather than handing out Wastes.
    const splitColors = colors || ["W", "U", "B", "R", "G"].filter(k => report.pips[k] > 0).join("");
    const split = basicSplit(report.pips, m.basicsNeeded, splitColors);
    const scale = Math.max(1, ...Object.values(report.curve), ...Object.values(CURVE_TEMPLATE));
    f("an-status").textContent = `${report.total} cards read${report.unknown.length ? `, ${report.unknown.length} not found on Scryfall` : ""}`;
    f("report").innerHTML = `
      <div class="stat derived"><span class="stat-label">In the deck</span><span class="stat-value">${report.total}</span><span class="stat-sub">excluding the commander</span></div>
      <div class="stat derived"><span class="stat-label">Basics to add</span><span class="stat-value">${m.basicsNeeded}</span><span class="stat-sub">${report.lands} lands in, target ${targets.lands}</span></div>
      <div class="stat derived ${m.cutN === 0 ? "ok" : "over"}"><span class="stat-label">Size after basics</span><span class="stat-value">${m.finalSize}<small>/${TOTAL_SLOTS}</small></span><span class="stat-sub">${m.cutN > 0 ? `cut ${m.cutN} plan card${m.cutN === 1 ? "" : "s"}` : m.cutN < 0 ? `room for ${-m.cutN} more` : "exactly right"}</span></div>
      <div class="stat derived"><span class="stat-label">Plan cards</span><span class="stat-value">${report.counts.plan}</span><span class="stat-sub">${m.cutN > 0 ? `${m.planAfter} after the cut` : "as they stand"}</span></div>
      <div class="stat derived ${report.sixPlus <= 10 ? "ok" : "over"}"><span class="stat-label">Six-plus</span><span class="stat-value">${report.sixPlus}</span><span class="stat-sub">${report.sixPlus > 10 ? `cut ${report.sixPlus - 10} to reach 10` : "aim for 8 to 10"}</span></div>`;
    f("verdict").innerHTML = m.vegOver.length ? `<span class="error">Stage 4 is not finished: ${esc(m.vegOver.join(", "))} still over the number. Cut those before any plan card.</span>`
      : m.tooManyLands ? `<span class="error">${report.lands} lands against a target of ${targets.lands}: cut lands before plan cards.</span>`
      : m.cutN > 0 && m.planAfter < 20 ? `That would leave only ${m.planAfter} plan cards. If the deck feels thin, revisit a vegetable number in Stage 2 rather than cutting deeper.` : "";
    f("detail").innerHTML = `
      <div class="s5-detail">
        <div>
          <div class="sheet-label">Basics to add, by the colour symbols in your spells</div>
          ${m.basicsNeeded ? `<div class="stats basics-split">${Object.entries(split).filter(([, n]) => n > 0).map(([col, n]) => `<div class="stat derived"><span class="stat-label">${pips(col)} ${BASIC_NAME[col]}</span><span class="stat-value">${n}</span></div>`).join("")}</div>
          <div class="helper">Pips counted: ${["W", "U", "B", "R", "G"].filter(k => report.pips[k]).map(k => `${k} ${report.pips[k]}`).join(" · ") || "none"}. Nudge one toward your turn-1 and turn-2 colours if it is close.</div>` : `<div class="helper">None needed: the land count is already met.</div>`}
        </div>
        <div>
          <div class="sheet-label">Curve of the non-land cards · template 9 / 19 / 16 / 10 / 5 / 5</div>
          <div class="curve">${[1, 2, 3, 4, 5, 6].map(mv => `<div class="curve-col"><div class="curve-bars"><div class="curve-bar tmpl" style="height:${CURVE_TEMPLATE[mv] / scale * 100}%"></div><div class="curve-bar yours" style="height:${report.curve[mv] / scale * 100}%"></div></div><div class="curve-x">${mv === 6 ? "6+" : mv}</div><div class="curve-n">${report.curve[mv]}<small>/${CURVE_TEMPLATE[mv]}</small></div></div>`).join("")}</div>
          <div class="helper">Grey is the template, blue is yours. The 2-mana bar should be tallest.</div>
        </div>
      </div>
      ${report.uncategorised ? `<div class="helper error">${report.uncategorised} uncategorised: ${esc(report.uncategorisedNames.slice(0, 8).join(", "))}${report.uncategorisedNames.length > 8 ? "…" : ""}</div>` : ""}
      ${report.unknown.length ? `<details class="unknown helper"><summary>${report.unknown.length} names not found on Scryfall</summary>${report.unknown.map(esc).join(", ")}</details>` : ""}`;
    updateProgress();
  }
  function updateProgress() {
    const btn = f("c-done");
    f("after").hidden = !d.completed[5];
    if (!report || !report.total) { f("c-progress").textContent = "Paste the deck to check it"; btn.classList.add("disabled"); btn.setAttribute("aria-disabled", "true"); return; }
    const m = math();
    const sizeOk = m.cutN === 0, landsOk = !m.tooManyLands, sixOk = report.sixPlus <= 10;
    const ok = !!(c && sizeOk && landsOk && sixOk && !m.vegOver.length);
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("c-progress").textContent = m.vegOver.length ? "Finish Stage 4 first" : !sizeOk ? (m.cutN > 0 ? `${m.cutN} over: cut plan cards` : `${-m.cutN} under: add plan cards or basics`) : !landsOk ? "Too many lands" : !sixOk ? `${report.sixPlus} six-plus cards: cut to 10` : d.completed[5] ? "Done. The deck is 99." : saveNote();
  }
  f("c-done").addEventListener("click", () => { if (f("c-done").classList.contains("disabled")) return; d.completed[5] = true; persist(); updateProgress(); f("after").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  render();
}
