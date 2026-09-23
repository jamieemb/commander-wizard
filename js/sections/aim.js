// Section: the deck's aim. One sentence in three parts, composed live, with three checks.
import { store } from "../store.js";
import { markDirty } from "../app.js";
import { esc } from "./colours.js";

const FIELDS = [
  ["f-does", "does", "Every turn the deck…", "what it does"],
  ["f-cap", "capitalises", "…so that…", "how that becomes an advantage"],
  ["f-wins", "wins", "…winning by…", "how it wins"],
];
const CHECKS = [["c-two", "twoPiece", "Needs only two kinds of card"], ["c-table", "table", "The table won't hate it"], ["c-pilot", "pilot", "I'd enjoy piloting it"]];

/** The composed aim sentence, or "" when nothing has been typed yet. */
export function aimSentence(aim) {
  const a = (aim.does || "").trim(), b = (aim.capitalises || "").trim(), w = (aim.wins || "").trim();
  return (a || b || w) ? `Every turn the deck ${a || "…"}, so that ${b || "…"}, winning by ${w || "…"}.` : "";
}

export function renderAimSection(container, { onChange }) {
  const { aim } = store.deck;
  container.innerHTML = `
    <section class="block aim">
      <div class="label-row"><h2 class="section-title">Aim</h2><span class="helper">One sentence, three parts</span></div>
      ${FIELDS.map(([id, key, label, ph]) => `<label class="tf"><span class="tf-label">${label}</span><input id="${id}" type="text" placeholder="${ph}" value="${esc(aim[key])}" autocomplete="off"></label>`).join("")}
      <p class="tonal-box" id="aim-preview" hidden></p>
      <div class="checks">
        ${CHECKS.map(([id, key, label]) => `<label class="checkrow"><input type="checkbox" id="${id}" ${aim.checks[key] ? "checked" : ""}>${label}</label>`).join("")}
      </div>
    </section>`;
  const f = id => container.querySelector("#" + id);
  const preview = f("aim-preview");
  function updatePreview() { const s = aimSentence(aim); preview.textContent = s; preview.hidden = !s; }
  function persist() { store.save(); markDirty(); onChange && onChange(); }
  for (const [id, key] of FIELDS) f(id).addEventListener("input", e => { aim[key] = e.target.value; updatePreview(); persist(); });
  for (const [id, key] of CHECKS) f(id).addEventListener("change", e => { aim.checks[key] = e.target.checked; persist(); });
  updatePreview();
}

export function aimComplete(deck) {
  const a = deck.aim;
  return [a.does, a.capitalises, a.wins].every(s => (s || "").trim()) && ["twoPiece", "table", "pilot"].every(k => a.checks[k]);
}
