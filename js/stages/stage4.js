// Stage 4: Cut the Base Package and the Land Package down to the Stage 2 numbers, in the app.
// One sheet: each category against its number as a square, then every package card listed under its job with a Cut button.
import { store } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc } from "../sections/colours.js";
import { CATEGORIES, GC_ALLOWED, targetsOf, nonBasicDefault } from "../numbers.js";
import { analyseEntries, categoryState } from "../deckcheck.js";
import { decklist, keyOf } from "../decklist.js";
import { rowHTML, bindRows, cutOrder } from "../sections/cutlist.js";
import { bindPeek } from "../peek.js";
import { eurToGBP, fmtGBP } from "../scryfall.js";

const SHORT = { ramp: "Ramp", explosive: "Explosive", draw: "Draw", removal: "Removal", mass: "Wipes", protection: "Protection" };

export function renderStage4(root, { goToStage }) {
  const d = store.deck, c = d.commander.chosen;
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
            <div class="sheet-meta helper">Bracket ${bracket} · Game Changers allowed: ${gcMax === Infinity ? "any" : gcMax} · cut each package category to its Stage 2 number. Plan cards wait for Stage 5.</div>`
            : `<div class="sheet-name">No commander yet</div><div class="helper"><a href="#wizard/1">Choose one in Stage 1</a> first.</div>`}
          </div>
        </header>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">1 · Where each category stands</span><span class="helper" id="an-status"></span></div>
          <div class="stats report" id="report"></div>
          <div class="helper" id="extras"></div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">2 · Cut the packages</span><span class="helper">Each list is in cutting order: Game Changers, then Power, then Upgrade, then the highest mana value. Two-job cards sit last and stay. Ramp should cost about ${rampMV != null ? rampMV : "the commander's mana value minus two"}; keep at most four lands that enter tapped.</span></div>
          <div class="cutlists" id="lists"></div>
        </div>

        <div class="sheet-row">
          <span class="sheet-label">3 · The rules</span>
          <ol class="rules">
            <li><b>Two-job cards stay.</b> Mark a card's second job with the pencil; only one-job cards are held to the number.</li>
            <li><b>Keep answers to what your table plays.</b> Cut the narrow ones.</li>
            <li><b>Upgrade tags</b> stay only if you can say why the upgrade is better here.</li>
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
  let report = null, facts = {};

  const landState = () => report.nonbasics > nonBasic ? { state: "over", cut: report.nonbasics - nonBasic, short: 0, bonus: 0 }
    : report.nonbasics < nonBasic ? { state: "under", cut: 0, short: nonBasic - report.nonbasics, bonus: 0 } : { state: "ok", cut: 0, short: 0, bonus: 0 };
  const groups = () => VEG.map(x => ({ key: x.key, label: x.label, short: SHORT[x.key], have: report.counts[x.key], target: targets[x.key], s: categoryState(report, x.key, targets[x.key]) }))
    .concat([{ key: "lands", label: "Non-basic lands", short: "Non-basic lands", have: report.nonbasics, target: nonBasic, s: landState() }]);
  const stateText = (g, unit) => g.s.state === "over" ? `cut ${g.s.cut} ${unit}${g.s.cut === 1 ? "" : "s"}${g.s.bonus ? `, ${g.s.bonus} two-job stay` : ""}`
    : g.s.state === "under" ? `${g.s.short} short of ${g.target}` : g.s.bonus ? `done, +${g.s.bonus} two-job` : "done";

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
      f("lists").innerHTML = ""; f("extras").textContent = ""; updateProgress(); return;
    }
    f("an-status").textContent = `${report.total} cards in the deck · ${fmtGBP(eurToGBP(report.price))} as it stands${report.unknown.length ? ` · ${report.unknown.length} not found on Scryfall` : ""}`;
    const gcOver = report.tags.GC > gcMax;
    f("report").innerHTML = groups().map(g => `<div class="stat derived ${g.s.state}"><span class="stat-label">${esc(g.short)}</span><span class="stat-value">${g.have}<small>/${g.target}</small></span><span class="stat-sub">${esc(stateText(g, g.key === "lands" ? "land" : "one-job card"))}</span></div>`).join("") +
      `<div class="stat derived ${gcOver ? "over" : "ok"}"><span class="stat-label">Game Changers</span><span class="stat-value">${report.tags.GC}<small>/${gcMax === Infinity ? "any" : gcMax}</small></span><span class="stat-sub">${gcOver ? `cut ${report.tags.GC - gcMax}` : "within the allowance"}</span></div>`;
    f("extras").innerHTML = `Power-tagged ${report.tags.Power} · Upgrade-tagged ${report.tags.Upgrade} · plan cards ${report.counts.plan} · cut so far ${decklist.all().filter(e => e.cut && e.src !== "plan").reduce((n, e) => n + e.qty, 0)}` +
      (report.uncategorised ? ` · <span class="error">${report.uncategorised} without a job: ${esc(report.uncategorisedNames.slice(0, 6).join(", "))}${report.uncategorisedNames.length > 6 ? "…" : ""}</span>` : "");
    const all = decklist.all();
    f("lists").innerHTML = groups().map(g => {
      const entries = all.filter(e => e.cats.includes(g.key) && e.src !== "basic" && e.src !== "plan").sort(cutOrder(facts));
      const cost = entries.filter(e => !e.cut).reduce((n, e) => n + ((facts[e.key] || {}).eur || 0) * e.qty, 0);
      return `<div class="cgroup"><div class="cgroup-head"><span>${esc(g.label)} <small>${g.have}/${g.target} · ${fmtGBP(eurToGBP(cost))}</small></span><span class="state ${g.s.state}">${esc(stateText(g, g.key === "lands" ? "land" : "one-job card"))}</span></div>${entries.map(e => rowHTML(e, facts, g.key)).join("") || `<p class="helper">Nothing in this category.</p>`}</div>`;
    }).join("");
    bindRows(f("lists"), () => load());
    bindPeek(f("lists").querySelectorAll(".crow-name"), el => el.dataset.large || null);
    updateProgress();
  }

  function updateProgress() {
    const btn = f("c-done");
    if (!report || !decklist.hasPackages()) { f("c-progress").textContent = "Add the packages in Stage 3"; btn.classList.add("disabled"); btn.setAttribute("aria-disabled", "true"); return; }
    const states = groups().map(g => g.s.state);
    const over = states.filter(s => s === "over").length, under = states.filter(s => s === "under").length, gcOk = report.tags.GC <= gcMax;
    const ok = !!(c && !over && !under && gcOk);
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("c-progress").textContent = over ? `${over} categor${over === 1 ? "y" : "ies"} still over the number` : under ? `${under} categor${under === 1 ? "y" : "ies"} under the number` : !gcOk ? "Game Changers over the allowance" : saveNote();
  }
  f("c-done").addEventListener("click", () => { if (f("c-done").classList.contains("disabled")) return; d.completed[4] = true; persist(); goToStage(5); });
  updateProgress();
  load(true);
}
