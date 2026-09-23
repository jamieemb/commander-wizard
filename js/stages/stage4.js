// Stage 4: Cut the Base Package and the Land Package down to the Stage 2 numbers.
// One sheet: paste the export, see each category against its number as a square, then the cutting order.
import { store } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc } from "../sections/colours.js";
import { CATEGORIES, GC_ALLOWED, targetsOf, nonBasicDefault } from "../numbers.js";
import { analyseDeck, categoryState } from "../deckcheck.js";

const SHORT = { ramp: "Ramp", explosive: "Explosive", draw: "Draw", removal: "Removal", mass: "Wipes", protection: "Protection" };

export function renderStage4(root, { goToStage }) {
  const d = store.deck, cut = d.cut, c = d.commander.chosen;
  const colors = d.colours.colors || "";
  const targets = targetsOf(d);
  const nonBasic = d.numbers.nonBasics ?? nonBasicDefault(targets.lands);
  const bracket = d.numbers.bracket || 2;
  const gcMax = GC_ALLOWED[bracket];
  const VEG = CATEGORIES.filter(x => x.key !== "lands");
  const rampMV = c ? Math.max(0, c.mv - 2) : null;

  root.innerHTML = `
    <div class="stage-body s4">
      <section class="sheet">
        <header class="sheet-head">
          <div class="sheet-who">
            ${c ? `<div class="sheet-name">${pips(colors)}<span>${esc(c.name)}</span></div>
            <div class="sheet-meta helper">Bracket ${bracket} · Game Changers allowed: ${gcMax === Infinity ? "any" : gcMax} · cut each package category to its Stage 2 number, one at a time. Plan cards are not touched yet.</div>`
            : `<div class="sheet-name">No commander yet</div><div class="helper"><a href="#wizard/1">Choose one in Stage 1</a> first.</div>`}
          </div>
        </header>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">1 · Paste the deck</span><span class="helper">Archidekt: deck menu → Export → text with categories. Paste as often as you like.</span></div>
          <div class="counter">
            <textarea id="paste" class="paste" placeholder="1 Arcane Signet [Ramp]&#10;1 Command Tower [Lands]&#10;…">${esc(cut.pasted4 || "")}</textarea>
            <button type="button" class="btn tonal small" id="analyse">Check</button>
          </div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">2 · What is left to cut</span><span class="helper" id="an-status"></span></div>
          <div class="stats report" id="report"><p class="helper">Paste and check to see each category against its number.</p></div>
          <div class="helper" id="extras"></div>
        </div>

        <div class="sheet-row">
          <span class="sheet-label">3 · How to choose what goes</span>
          <ol class="rules">
            <li><b>Game Changers first</b> beyond the allowance, then <b>Power</b>-tagged cards.</li>
            <li><b>Two-job cards stay.</b> Only one-job cards are held to the number.</li>
            <li><b>Ramp costs about ${rampMV != null ? rampMV : "MV − 2"}.</b> Cut ramp that lands a turn late.</li>
            <li><b>Keep answers to what your table plays.</b> Cut the narrow ones.</li>
            <li><b>Upgrade tags</b> only if you can say why the upgrade is better here.</li>
            <li><b>Lands to ${nonBasic} non-basics.</b> Untapped duals stay, at most four tapped; colourless utility lands go first in three colours. Basics come in Stage 5.</li>
            <li><b>Never cut below a number</b> for a plan card. Change the number in Stage 2 and say why.</li>
          </ol>
        </div>
      </section>
    </div>
    <div class="stage-footer">
      <span class="helper" id="c-progress" data-save-note></span>
      <button type="button" class="btn filled" id="c-done">Cut to 99 →</button>
    </div>`;

  const f = id => root.querySelector("#" + id);
  const persist = () => { store.save(); markDirty(); };
  let report = cut.report4 || null;

  f("paste").addEventListener("input", e => { cut.pasted4 = e.target.value; persist(); });
  f("analyse").addEventListener("click", async () => {
    f("an-status").textContent = "Reading…";
    report = await analyseDeck(f("paste").value);
    cut.report4 = report; persist();
    render();
  });

  const landState = () => report.nonbasics > nonBasic ? { state: "over", cut: report.nonbasics - nonBasic, short: 0, bonus: 0 }
    : report.nonbasics < nonBasic ? { state: "under", cut: 0, short: nonBasic - report.nonbasics, bonus: 0 } : { state: "ok", cut: 0, short: 0, bonus: 0 };
  const rowsOf = () => VEG.map(x => ({ key: x.key, label: SHORT[x.key], have: report.counts[x.key], target: targets[x.key], s: categoryState(report, x.key, targets[x.key]) }))
    .concat([{ key: "nonbasics", label: "Non-basic lands", have: report.nonbasics, target: nonBasic, s: landState() }]);
  function square(r) {
    const s = r.s, unit = r.key === "nonbasics" ? "land" : "one-job card";
    const sub = s.state === "over" ? `cut ${s.cut} ${unit}${s.cut === 1 ? "" : "s"}${s.bonus ? `, ${s.bonus} two-job stay` : ""}`
      : s.state === "under" ? `${s.short} short of ${r.target}` : s.bonus ? `done, +${s.bonus} two-job` : "done";
    return `<div class="stat derived ${s.state}"><span class="stat-label">${esc(r.label)}</span><span class="stat-value">${r.have}<small>/${r.target}</small></span><span class="stat-sub">${esc(sub)}</span></div>`;
  }
  function render() {
    if (!report || !report.total) { f("an-status").textContent = report ? "Nothing recognised. Paste an Archidekt text export." : ""; updateProgress(); return; }
    f("an-status").textContent = `${report.total} cards read${report.unknown.length ? `, ${report.unknown.length} not found on Scryfall` : ""}`;
    const gcOver = report.tags.GC > gcMax;
    f("report").innerHTML = rowsOf().map(square).join("") +
      `<div class="stat derived ${gcOver ? "over" : "ok"}"><span class="stat-label">Game Changers</span><span class="stat-value">${report.tags.GC}<small>/${gcMax === Infinity ? "any" : gcMax}</small></span><span class="stat-sub">${gcOver ? `cut ${report.tags.GC - gcMax}: ${esc(report.tagged.GC.slice(0, 3).join(", "))}${report.tagged.GC.length > 3 ? "…" : ""}` : "within the allowance"}</span></div>`;
    f("extras").innerHTML = `Power-tagged ${report.tags.Power} · Upgrade-tagged ${report.tags.Upgrade} · basics already in ${report.basics} · plan cards ${report.counts.plan}` +
      (report.uncategorised ? ` · <span class="error">${report.uncategorised} uncategorised: ${esc(report.uncategorisedNames.slice(0, 6).join(", "))}${report.uncategorisedNames.length > 6 ? "…" : ""}</span>` : "") +
      (report.unknown.length ? ` <details class="unknown"><summary>Not found on Scryfall</summary>${report.unknown.map(esc).join(", ")}</details>` : "");
    updateProgress();
  }
  function updateProgress() {
    const btn = f("c-done");
    if (!report || !report.total) { f("c-progress").textContent = "Paste the deck to check it"; btn.classList.add("disabled"); btn.setAttribute("aria-disabled", "true"); return; }
    const states = rowsOf().map(r => r.s.state);
    const over = states.filter(s => s === "over").length, under = states.filter(s => s === "under").length, gcOk = report.tags.GC <= gcMax;
    const ok = !!(c && !over && !under && gcOk);
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("c-progress").textContent = over ? `${over} categor${over === 1 ? "y" : "ies"} still over the number` : under ? `${under} categor${under === 1 ? "y" : "ies"} under the number` : !gcOk ? "Game Changers over the allowance" : saveNote();
  }
  f("c-done").addEventListener("click", () => { if (f("c-done").classList.contains("disabled")) return; d.completed[4] = true; persist(); goToStage(5); });
  render();
}
