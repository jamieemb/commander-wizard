// Stage 3: Plan cards. The packages come into the deck whole (the vegetables); this stage is about finding the cards that do the thing.
// One sheet, three rows: the packages, the search with the plan list, and the deck so far.
import { store } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc, identityFor } from "../sections/colours.js";
import { aimSentence } from "../sections/aim.js";
import { PLAN_TARGET, PLAN_GATHER } from "../numbers.js";
import { mountPlanSearch } from "../screens/plan.js";
import { decklist } from "../decklist.js";
import { planList } from "../planlist.js";
import { addPackages, addPastedPackages, packageFile } from "../packages.js";

export function identityName(colors) {
  if (!colors || colors === "C") return "Colourless";
  const t = identityFor(colors);
  return t ? t.name : colors;
}

export function renderStage3(root, { goToStage }) {
  const d = store.deck, c = d.commander.chosen;
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
          <div class="label-row"><span class="sheet-label">1 · The packages</span><span class="helper">Every ramp, draw, removal, wipe, protection and land the deck could want, for ${esc(ident)}. They come in whole; Stages 4 and 5 cut them down.</span></div>
          <div class="pkg" id="pkg"></div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">2 · Find plan cards</span><span class="helper">Click each search in turn, add what matches two or more key words, move on. Gather about ${PLAN_GATHER}.</span></div>
          <div id="plan-host"></div>
        </div>

        <div class="sheet-row">
          <div class="label-row"><span class="sheet-label">3 · The deck so far</span><span class="helper">Nothing is cut yet. Two-job cards get their extra jobs marked in Stage 4.</span></div>
          <div class="stats report" id="report"></div>
        </div>
      </section>
    </div>
    <div class="stage-footer">
      <span class="helper" id="g-progress" data-save-note></span>
      <button type="button" class="btn filled" id="g-done">Cut packages →</button>
    </div>`;

  const f = id => root.querySelector("#" + id);
  const persist = () => { store.save(); markDirty(); };
  const live = () => root.isConnected;

  // ----- the packages -----
  function drawPkg() {
    const host = f("pkg"), has = decklist.hasPackages();
    if (!colors) { host.innerHTML = `<span class="helper">Choose a commander in Stage 1 and the packages for its colours appear here.</span>`; return; }
    if (has) {
      host.innerHTML = `
        <span><b>Base Package</b> ${decklist.count("base")} cards · <b>Land Package</b> ${decklist.count("lands")} cards</span>
        <button type="button" class="btn text small danger" id="pkg-remove" title="Take both packages out of the deck (cuts and job marks on them are lost)">Remove packages</button>`;
      host.querySelector("#pkg-remove").addEventListener("click", () => {
        if (!confirm(`Take the ${ident} packages out of the deck?`)) return;
        decklist.removeSrc("base"); decklist.removeSrc("lands"); drawPkg(); drawReport();
      });
      return;
    }
    host.innerHTML = `
      <button type="button" class="btn filled small" id="pkg-add">Add the ${esc(ident)} packages</button>
      <button type="button" class="btn text small" id="pkg-paste-toggle">Paste them instead</button>
      <span class="helper" id="pkg-status"></span>
      <div class="pkg-paste" id="pkg-paste" hidden>
        <textarea class="paste" id="pkg-text" placeholder="Archidekt export of the Base Package and the Land Package:&#10;1 Arcane Signet [Ramp]&#10;1 Command Tower [Lands]&#10;…"></textarea>
        <button type="button" class="btn tonal small" id="pkg-paste-add">Add</button>
      </div>`;
    host.querySelector("#pkg-add").addEventListener("click", async () => {
      const btn = host.querySelector("#pkg-add"), status = host.querySelector("#pkg-status");
      btn.disabled = true; status.className = "helper"; status.textContent = "Fetching…";
      try { await addPackages(ident); drawPkg(); drawReport(); }
      catch (err) {
        btn.disabled = false; status.className = "helper error";
        status.textContent = `${err.message}. Add ${packageFile(err.kind || "base", ident)} to the site, or paste the export.`;
      }
    });
    host.querySelector("#pkg-paste-toggle").addEventListener("click", () => { const p = host.querySelector("#pkg-paste"); p.hidden = !p.hidden; if (!p.hidden) p.querySelector("textarea").focus(); });
    host.querySelector("#pkg-paste-add").addEventListener("click", () => {
      const n = addPastedPackages(host.querySelector("#pkg-text").value);
      if (!n.base && !n.lands) { const s = host.querySelector("#pkg-status"); s.className = "helper error"; s.textContent = "Nothing recognised. Paste an Archidekt text export with categories."; return; }
      drawPkg(); drawReport();
    });
  }

  // ----- the search, with the generated key-word searches and the plan list (js/screens/plan.js) -----
  mountPlanSearch(f("plan-host"));

  // ----- the deck so far -----
  function drawReport() {
    decklist.syncPlan();
    const plan = planList.count(), base = decklist.count("base"), lands = decklist.count("lands"), two = decklist.live().filter(e => e.cats.length > 1).length;
    f("report").innerHTML = `
      <div class="stat derived ${plan >= PLAN_TARGET ? "ok" : "warn"}"><span class="stat-label">Plan cards</span><span class="stat-value">${plan}</span><span class="stat-sub">${plan >= PLAN_GATHER ? "enough to cut from" : plan >= PLAN_TARGET ? `keep going to ~${PLAN_GATHER}` : `need at least ${PLAN_TARGET}`}</span></div>
      <div class="stat derived ${base && lands ? "ok" : "warn"}"><span class="stat-label">Package cards</span><span class="stat-value">${base + lands}</span><span class="stat-sub">${base || lands ? `base ${base} · lands ${lands}` : "not added yet"}</span></div>
      <div class="stat derived"><span class="stat-label">In the deck</span><span class="stat-value">${base + lands + plan}</span><span class="stat-sub">before any cut</span></div>
      <div class="stat derived"><span class="stat-label">Two-job cards</span><span class="stat-value">${two}</span><span class="stat-sub">aim for 8 or more</span></div>`;
    updateProgress();
  }
  function updateProgress() {
    const plan = planList.count(), pk = decklist.hasPackages();
    const ok = !!(c && pk && plan >= PLAN_TARGET);
    const btn = f("g-done");
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("g-progress").textContent = !c ? "Choose a commander in Stage 1"
      : !pk ? "Add the packages first"
      : plan < PLAN_TARGET ? `${PLAN_TARGET - plan} more plan card${PLAN_TARGET - plan === 1 ? "" : "s"} needed` : saveNote();
  }
  const off = planList.onChange(() => { if (!live()) { off(); return; } drawReport(); });

  f("g-done").addEventListener("click", () => { if (f("g-done").classList.contains("disabled")) return; d.completed[3] = true; persist(); goToStage(4); });
  drawPkg(); drawReport();
}
