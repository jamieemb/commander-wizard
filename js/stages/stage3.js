// Stage 3: Plan cards. The two packages cover the vegetables; this stage is only about finding the cards that do the thing.
// One sheet, three rows: set up in Archidekt, find plan cards (in the app's own search, copied over as a list), count what you have.
import { store } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc, identityFor } from "../sections/colours.js";
import { aimSentence } from "../sections/aim.js";
import { PLAN_TARGET, PLAN_GATHER } from "../numbers.js";
import { analyseDeck } from "../deckcheck.js";
import { mountPlanSearch } from "../screens/plan.js";

const ICON_COPY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;

export function identityName(colors) {
  if (!colors || colors === "C") return "Colourless";
  const t = identityFor(colors);
  return t ? t.name : colors;
}

export function renderStage3(root, { goToStage }) {
  const d = store.deck, g = d.gather, c = d.commander.chosen;
  const colors = d.colours.colors || "";
  const ident = identityName(colors);
  const aim = aimSentence(d.aim);

  root.innerHTML = `
    <div class="stage-body s3">
      <section class="sheet">
        <header class="sheet-head">
          <div class="sheet-who">
            ${c ? `<div class="sheet-name">${pips(colors)}<span>${esc(c.name)}</span></div>
            <div class="sheet-meta helper">${esc(ident)} · bracket ${d.numbers.bracket || 2}${aim ? ` · ${esc(aim)}` : ""}</div>`
            : `<div class="sheet-name">No commander yet</div><div class="helper"><a href="#wizard/1">Choose one in Stage 1</a> first.</div>`}
          </div>
        </header>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">1 · Set up the deck in Archidekt</span><span class="helper">Once, at the start. The packages are the vegetables; the plan cards come next.</span></div>
          <div class="setup">
            <div class="setup-step">New deck, format <b>Commander</b>, commander <b>${c ? esc(c.name) : "your commander"}</b>.</div>
            <div class="setup-step">Add both packages:
              <button type="button" class="chip copy" data-copy="${esc(ident)} // Base Package" title="Copy the package name">${esc(ident)} // Base Package${ICON_COPY}</button>
              <button type="button" class="chip copy" data-copy="${esc(ident)} // Land Package" title="Copy the package name">${esc(ident)} // Land Package${ICON_COPY}</button>
            </div>
            <div class="setup-step">Create a <b>Plan</b> category for everything you add from here. Cut nothing yet.</div>
            <label class="checkrow"><input type="checkbox" id="pkgs-added" ${g.packagesAdded ? "checked" : ""}>Done: both packages in, commander set, Plan category made</label>
          </div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">2 · Find plan cards</span><span class="helper">Click each search in turn, add what matches two or more key words, move on. Gather about ${PLAN_GATHER}, then copy the list into Archidekt.</span></div>
          <div id="plan-host"></div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">3 · Count what you have</span><span class="helper">Archidekt: deck menu → Export → text with categories. Paste it here.</span></div>
          <div class="counter">
            <textarea id="paste" class="paste" placeholder="1 Arcane Signet [Ramp]&#10;1 Impact Tremors [Plan]&#10;…">${esc(g.pasted || "")}</textarea>
            <button type="button" class="btn tonal small" id="analyse">Check</button>
          </div>
          <div class="stats report" id="report"></div>
          <div class="helper" id="an-status"></div>
        </div>
      </section>
    </div>
    <div class="stage-footer">
      <span class="helper" id="g-progress" data-save-note></span>
      <button type="button" class="btn filled" id="g-done">Cut packages →</button>
    </div>`;

  const f = id => root.querySelector("#" + id);
  const persist = () => { store.save(); markDirty(); };
  const copy = async (text, el, done = "Copied") => {
    try { await navigator.clipboard.writeText(text); el.classList.add("done"); const old = el.innerHTML; el.textContent = done; setTimeout(() => { el.classList.remove("done"); el.innerHTML = old; }, 1200); }
    catch { el.textContent = "Copy blocked"; }
  };

  f("pkgs-added").addEventListener("change", e => { g.packagesAdded = e.target.checked; persist(); updateProgress(); });
  root.querySelectorAll(".chip.copy").forEach(b => b.addEventListener("click", () => copy(b.dataset.copy, b)));

  // ----- the search, with the generated key-word searches and the plan list (js/screens/plan.js) -----
  mountPlanSearch(f("plan-host"));

  // ----- counter -----
  let report = g.lastReport || null;
  f("paste").addEventListener("input", e => { g.pasted = e.target.value; persist(); });
  f("analyse").addEventListener("click", async () => {
    f("an-status").textContent = "Reading…";
    report = await analyseDeck(f("paste").value);
    g.lastReport = report; persist();
    renderReport();
  });
  function renderReport() {
    if (!report || !report.total) { f("report").innerHTML = ""; f("an-status").textContent = report ? "Nothing recognised. Paste an Archidekt text export." : ""; updateProgress(); return; }
    const p = report.counts.plan;
    f("report").innerHTML = `
      <div class="stat derived ${p >= PLAN_TARGET ? "" : "warn"}"><span class="stat-label">Plan cards</span><span class="stat-value">${p}</span><span class="stat-sub">${p >= PLAN_GATHER ? "enough to cut from" : p >= PLAN_TARGET ? `keep going to ~${PLAN_GATHER}` : `need at least ${PLAN_TARGET}`}</span></div>
      <div class="stat derived"><span class="stat-label">Two-job cards</span><span class="stat-value">${report.twoJobs}</span><span class="stat-sub">aim for 8 or more</span></div>
      <div class="stat derived"><span class="stat-label">Cards read</span><span class="stat-value">${report.total}</span><span class="stat-sub">excluding the commander</span></div>
      <div class="stat derived ${report.uncategorised ? "warn" : ""}"><span class="stat-label">Uncategorised</span><span class="stat-value">${report.uncategorised}</span><span class="stat-sub">${report.uncategorised ? esc(report.uncategorisedNames.slice(0, 3).join(", ")) + (report.uncategorisedNames.length > 3 ? "…" : "") : "every card has a category"}</span></div>`;
    f("an-status").innerHTML = report.unknown.length ? `<details class="unknown"><summary>${report.unknown.length} name${report.unknown.length === 1 ? "" : "s"} not found on Scryfall</summary>${report.unknown.map(esc).join(", ")}</details>` : "";
    updateProgress();
  }
  function updateProgress() {
    const p = report && report.total ? report.counts.plan : null;
    const ok = !!(c && g.packagesAdded && p != null && p >= PLAN_TARGET);
    const btn = f("g-done");
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("g-progress").textContent = !c ? "Choose a commander in Stage 1"
      : !g.packagesAdded ? "Tick the set-up step when the packages are in"
      : p == null ? "Paste the export to count plan cards"
      : p < PLAN_TARGET ? `${PLAN_TARGET - p} more plan card${PLAN_TARGET - p === 1 ? "" : "s"} needed` : saveNote();
  }
  f("g-done").addEventListener("click", () => { if (f("g-done").classList.contains("disabled")) return; d.completed[3] = true; persist(); goToStage(4); });
  renderReport(); updateProgress();
}
