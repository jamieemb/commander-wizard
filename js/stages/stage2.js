// Stage 2: Numbers. Calculated from the commander's text, mana value, role and bracket; adjustable with a reason.
// Laid out as a character sheet: one bordered card with the commander, the bracket, the seven numbers as squares,
// a row of derived numbers, and the turn plan. Reasons and resets sit below it as working notes.
import { store } from "../store.js";
import { markDirty, saveNote } from "../app.js";
import { pips, esc } from "../sections/colours.js";
import { rampAdvice } from "../sections/commander.js";
import { traitIcons } from "../traits.js";
import { openPrintSheet } from "../sheet.js";
import { CATEGORIES, PLAN_TARGET, TOTAL_SLOTS, autoNumbers, turnPlanSuggestion, derivedNumbers, statSub } from "../numbers.js";

const BRACKETS = [
  { n: 2, label: "2 · casual", note: "Wins around turn 10 or later · no Game Changers" },
  { n: 3, label: "3 · upgraded", note: "Wins turns 7 to 9 · up to 3 Game Changers" },
  { n: 4, label: "4 · optimised", note: "Wins turns 5 to 6 · any Game Changers" },
];
const SHORT = { lands: "Lands", ramp: "Ramp", explosive: "Explosive", draw: "Draw", removal: "Removal", mass: "Wipes", protection: "Protection" };
const JOB_WORDS = { mana: "makes mana", cards: "draws cards", tokens: "makes tokens", removal: "removes things", recursion: "brings things back" };
const ICON_EDIT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const signed = n => (n > 0 ? `+${n}` : `${n}`);

export function renderStage2(root, { goToStage }) {
  const d = store.deck;
  const c = d.commander.chosen;
  const n = d.numbers;
  const auto = autoNumbers(d);
  const chosenId = c ? c.id : null;
  // First visit, or the commander changed since the numbers were calculated: take the calculated numbers.
  if (!Object.keys(n.targets).length || n.forCommander !== chosenId) {
    n.targets = { ...auto.targets }; n.because = { ...auto.why }; n.forCommander = chosenId;
    n.turnPlan = turnPlanSuggestion(c, d.commander.timing);
    n.nonBasics = null;
  }
  store.save();

  const bracket = n.bracket || 2;
  const editing = new Set();   // categories whose reason is being typed
  const defOf = k => CATEGORIES.find(x => x.key === k).def;
  const valOf = k => n.targets[k] ?? defOf(k);

  root.innerHTML = `
    <div class="stage-body s2">
      <section class="sheet" id="sheet">
        <header class="sheet-head">
          <div class="sheet-who">
            ${c ? `<div class="sheet-name">${pips(c.colors)}<span>${esc(c.name)}</span>${traitIcons({ scales: c.scales === "good", protects: c.protects }, "sm")}</div>
            <div class="sheet-meta helper">MV ${c.mv}${d.commander.role ? ` · ${esc(d.commander.role)}` : ""}${d.commander.timing ? ` · ${esc(d.commander.timing)}` : ""} · ${c.jobs.length ? esc(c.jobs.map(j => JOB_WORDS[j]).filter(Boolean).join(", ")) : "does no job by itself"}</div>`
            : `<div class="sheet-name">No commander yet</div><div class="helper"><a href="#wizard/1">Choose one in Stage 1</a> and the numbers adjust to its text.</div>`}
          </div>
          <div class="sheet-bracket">
            <div class="segmented" role="radiogroup" aria-label="Bracket" id="bracket">${BRACKETS.map(b => `<button type="button" role="radio" aria-checked="${bracket === b.n}" class="${bracket === b.n ? "selected" : ""}" data-b="${b.n}">${b.label}</button>`).join("")}</div>
            <div class="helper" id="bracket-note">${BRACKETS.find(b => b.n === bracket).note}</div>
          </div>
        </header>

        <div class="sheet-row">
          <span class="sheet-label">Cards of each kind</span>
          <div class="stats main" id="stats"></div>
        </div>
        <div class="sheet-row">
          <span class="sheet-label">What that leaves</span>
          <div class="stats secondary" id="derived"></div>
        </div>
        <div class="sheet-row">
          <div class="sheet-label">Your opening turns</div>
          <div class="helper turns-help">What you cast on turns 2 to 4; ramp should land the commander a turn early.${c ? ` <span class="turns-advice">${esc(rampAdvice(c.mv))}</span>` : ""}</div>
          <div class="turns">
            ${["t2", "t3", "t4"].map((k, i) => `<label class="turn"><span class="sheet-label">Turn ${i + 2}</span><textarea id="tp-${k}" rows="1" placeholder="what you cast">${esc(n.turnPlan[k])}</textarea></label>`).join("")}
          </div>
        </div>
        <div class="sheet-row sheet-notes">
          <div class="sheet-notes-main">
            <span class="sheet-label">Why the numbers are what they are</span>
            <div class="reasons" id="reasons"></div>
            <div class="sheet-links">
              <button type="button" class="btn text small" id="defs-toggle">What counts?</button>
              <button type="button" class="btn text small" id="btn-auto">Recalculate from the card</button>
              <button type="button" class="btn text small" id="btn-default">Plain template</button>
              <button type="button" class="btn text small" id="notes-toggle">${(n.notes || "").trim() ? "Notes" : "Add a note"}</button>
            </div>
            <div class="defs" id="defs">${CATEGORIES.map(x => `<div><b>${x.label}</b> ${esc(x.what)}</div>`).join("")}<div><b>Non-basic lands</b> The Land Package is cut to this in Stage 4; basics fill the rest in Stage 5. Colourless utility lands: up to 10 in one colour, 7 in two, 5 in three.</div></div>
            <label class="tf" id="notes-wrap" ${(n.notes || "").trim() ? "" : "hidden"}><span class="tf-label">Notes</span><textarea id="n-notes" placeholder="Anything to remember about these numbers">${esc(n.notes)}</textarea></label>
          </div>
          <div class="sheet-tools">
            <button type="button" class="btn tonal small" id="btn-print" title="Everything on this sheet, plus the aim and the Archidekt steps, on one A4 page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>Print or save as PDF</button>
          </div>
        </div>
      </section>
    </div>
    <div class="stage-footer">
      <span class="helper" id="n-progress" data-save-note></span>
      <button type="button" class="btn filled" id="n-done">Plan cards →</button>
    </div>`;

  const f = id => root.querySelector("#" + id);
  const persist = () => { store.save(); markDirty(); };
  const rerender = () => renderStage2(root, { goToStage });

  // ----- bracket -----
  f("bracket").querySelectorAll("[data-b]").forEach(b => b.addEventListener("click", () => {
    n.bracket = Number(b.dataset.b);
    const a = autoNumbers(d);
    n.targets.explosive = a.targets.explosive; n.because.explosive = a.why.explosive;
    persist(); rerender();
  }));

  // ----- the seven squares -----
  function statHTML(k, label, val, def, min, max, ariaLabel) {
    const delta = val - def;
    return `<div class="stat ${delta ? "changed" : ""}" data-k="${k}">
      <span class="stat-label" title="${esc(ariaLabel)}">${esc(label)}</span>
      <input type="number" class="stat-value" min="${min}" max="${max}" value="${val}" aria-label="${esc(ariaLabel)}">
      <span class="stat-sub">${statSub(val, def)}</span>
      <span class="stat-ctrl"><button type="button" data-step="-1" aria-label="${esc(ariaLabel)}: one fewer">−</button><button type="button" data-step="1" aria-label="${esc(ariaLabel)}: one more">+</button></span>
    </div>`;
  }
  function renderStats() {
    f("stats").innerHTML = CATEGORIES.map(x => statHTML(x.key, SHORT[x.key], valOf(x.key), x.def, 0, 60, x.label)).join("");
    f("stats").querySelectorAll(".stat").forEach(bindStat);
  }
  function bindStat(el) {
    const k = el.dataset.k, input = el.querySelector(".stat-value");
    const apply = v => {
      v = Math.max(Number(input.min), Math.min(Number(input.max), Number(v) || 0));
      input.value = v;
      if (k === "nonbasics") { n.nonBasics = v; persist(); renderDerived(); return; }
      n.targets[k] = v; persist();
      el.classList.toggle("changed", v !== defOf(k));
      el.querySelector(".stat-sub").textContent = statSub(v, defOf(k));
      renderDerived(); renderReasons(); updateProgress();
    };
    el.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => apply(Number(input.value) + Number(b.dataset.step))));
    input.addEventListener("change", () => apply(input.value));
  }

  // ----- derived squares: the same values and words as the printed sheet -----
  function renderDerived() {
    const dn = derivedNumbers(d);
    f("derived").innerHTML = dn.items.map(it => it.editable
      ? `<div class="stat derived-edit ${dn.nb !== dn.nbDef ? "changed" : ""}" data-k="nonbasics">
          <span class="stat-label" title="${esc(it.label)}">${esc(it.label)}</span>
          <input type="number" class="stat-value" min="0" max="45" value="${it.value}" aria-label="${esc(it.label)}">
          <span class="stat-sub">${esc(it.sub)}</span>
          <span class="stat-ctrl"><button type="button" data-step="-1" aria-label="${esc(it.label)}: one fewer">−</button><button type="button" data-step="1" aria-label="${esc(it.label)}: one more">+</button></span>
        </div>`
      : `<div class="stat derived ${it.warn ? "warn" : ""}"><span class="stat-label">${esc(it.label)}</span><span class="stat-value" aria-label="${esc(it.label)}">${it.value}</span><span class="stat-sub">${esc(it.sub)}</span></div>`).join("");
    bindStat(f("derived").querySelector('[data-k="nonbasics"]'));
  }

  // ----- reasons (below the sheet) -----
  function reasonHTML(k, delta) {
    const why = (n.because[k] || "").trim();
    if (editing.has(k) || (delta && !why)) return `<input type="text" class="reason-input" data-why="${k}" placeholder="${delta ? "Why did you change this?" : "Add a reason"}" value="${esc(n.because[k] || "")}" aria-label="Reason">`;
    return `<button type="button" class="reason" data-edit="${k}" title="Edit the reason"><span>${why ? esc(why) : "<span class='helper'>no reason yet</span>"}</span>${ICON_EDIT}</button>`;
  }
  function renderReasons() {
    const rows = CATEGORIES.filter(x => (valOf(x.key) - x.def) || (n.because[x.key] || "").trim() || editing.has(x.key));
    f("reasons").innerHTML = rows.length ? rows.map(x => {
      const delta = valOf(x.key) - x.def;
      return `<div class="reason-row" data-k="${x.key}"><span class="reason-key">${x.label}${delta ? `<span class="delta">${signed(delta)}</span>` : ""}</span><span class="reason-cell">${reasonHTML(x.key, delta)}</span></div>`;
    }).join("") : `<p class="helper">Every number is at its default. Change one on the sheet and its reason goes here.</p>`;
    f("reasons").querySelectorAll(".reason-row").forEach(bindReason);
  }
  function bindReason(row) {
    const k = row.dataset.k;
    const redraw = () => { row.querySelector(".reason-cell").innerHTML = reasonHTML(k, valOf(k) - defOf(k)); bindReason(row); };
    const edit = row.querySelector("[data-edit]");
    if (edit) edit.addEventListener("click", () => { editing.add(k); redraw(); row.querySelector(".reason-input").focus(); });
    const input = row.querySelector("[data-why]");
    if (input) {
      input.addEventListener("input", e => { n.because[k] = e.target.value; persist(); updateProgress(); });
      input.addEventListener("blur", () => { editing.delete(k); renderReasons(); });
      input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); });
    }
  }

  f("defs-toggle").addEventListener("click", () => { const on = f("defs").classList.toggle("show"); f("defs-toggle").textContent = on ? "Hide definitions" : "What counts?"; });
  f("btn-auto").addEventListener("click", () => { const a = autoNumbers(d); n.targets = { ...a.targets }; n.because = { ...a.why }; n.turnPlan = turnPlanSuggestion(c, d.commander.timing); n.nonBasics = null; persist(); rerender(); });
  f("btn-default").addEventListener("click", () => { n.targets = Object.fromEntries(CATEGORIES.map(x => [x.key, x.def])); n.because = {}; n.nonBasics = null; persist(); rerender(); });
  f("notes-toggle").addEventListener("click", () => { f("notes-wrap").hidden = false; f("n-notes").focus(); });
  f("n-notes").addEventListener("input", e => { n.notes = e.target.value; persist(); });

  // ----- turn plan, footer -----
  const grow = ta => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };   // the box fits its text
  for (const k of ["t2", "t3", "t4"]) { const ta = f("tp-" + k); grow(ta); ta.addEventListener("input", e => { n.turnPlan[k] = e.target.value; grow(ta); persist(); updateProgress(); }); }
  function updateProgress() {
    const missing = CATEGORIES.filter(x => valOf(x.key) !== x.def && !(n.because[x.key] || "").trim());
    const plan = ["t2", "t3", "t4"].every(k => (n.turnPlan[k] || "").trim());
    const overlap = derivedNumbers(d).overlap;
    const ok = c && !missing.length && plan && overlap <= 16;
    const btn = f("n-done");
    btn.classList.toggle("disabled", !ok); btn.setAttribute("aria-disabled", String(!ok));
    f("n-progress").textContent = !c ? "Choose a commander in Stage 1"
      : missing.length ? `Reason needed for ${missing.map(x => x.label.toLowerCase()).join(", ")}`
      : !plan ? "Fill in turns 2, 3 and 4"
      : overlap > 16 ? "Too many two-job cards needed" : saveNote();
  }
  f("btn-print").addEventListener("click", () => { if (!openPrintSheet(d)) alert("The browser blocked the sheet window. Allow pop-ups for this site and try again."); });
  f("n-done").addEventListener("click", () => { if (f("n-done").classList.contains("disabled")) return; d.completed[2] = true; persist(); goToStage(3); });

  renderStats(); renderDerived(); renderReasons(); updateProgress();
}
