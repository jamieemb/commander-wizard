// The card rows the cutting stages share: name, mana value, the marks that make a card a cut candidate
// (Game Changer, Power, Upgrade, enters tapped), the extra jobs a two-job card does, and Cut / Put back.
import { esc } from "./colours.js";
import { decklist, CAT_LABEL, CAT_KEYS } from "../decklist.js";

const ICON_JOBS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;

/** Order to cut in: Game Changers, then Power, then Upgrade, then plain one-job cards by mana value; two-job cards last (they stay). */
const rank = e => e.tags.includes("GC") ? 0 : e.tags.includes("Power") ? 1 : e.tags.includes("Upgrade") ? 2 : e.cats.length > 1 ? 4 : 3;
export function cutOrder(facts) {
  return (a, b) => {
    if (a.cut !== b.cut) return a.cut ? 1 : -1;
    const r = rank(a) - rank(b); if (r) return r;
    const ma = (facts[a.key] || {}).mv ?? -1, mb = (facts[b.key] || {}).mv ?? -1;
    return mb - ma || a.name.localeCompare(b.name);
  };
}

export function rowHTML(e, facts, primary) {
  const f = facts[e.key] || {};
  const tags = e.tags.map(t => `<span class="tagchip ${t.toLowerCase()}" title="${t === "GC" ? "Game Changer" : `${t}-tagged`}">${t === "GC" ? "Game Changer" : t}</span>`).join("");
  const others = e.cats.filter(k => k !== primary).map(k => `<span class="tagchip two" title="Also does this job: two-job cards stay">${esc(CAT_LABEL[k])}</span>`).join("");
  const tapped = f.tapped ? `<span class="tagchip tapped">${f.tapped === "maybe" ? "may enter tapped" : "enters tapped"}</span>` : "";
  return `
    <div class="crow${e.cut ? " cut" : ""}${e.cats.length > 1 ? " twojob" : ""}" data-key="${esc(e.key)}">
      <span class="crow-name" data-large="${esc(f.large || "")}">${esc(e.name)}${e.qty > 1 ? ` <small>×${e.qty}</small>` : ""}</span>
      <span class="crow-mv" title="Mana value">${f.mv != null && !f.isLand ? f.mv : ""}</span>
      <span class="crow-tags">${tags}${others}${tapped}</span>
      <button type="button" class="icon-btn small crow-jobs" data-edit="${esc(e.key)}" title="Which jobs this card does" aria-label="Edit jobs">${ICON_JOBS}</button>
      <button type="button" class="btn ${e.cut ? "tonal" : "outlined"} small crow-cut" data-cut="${esc(e.key)}">${e.cut ? "Put back" : "Cut"}</button>
    </div>`;
}

/** Wire the Cut / Put back buttons and the jobs editor inside `host`. onChange() runs after every change. */
export function bindRows(host, onChange) {
  host.querySelectorAll("[data-cut]").forEach(b => b.addEventListener("click", () => {
    const e = decklist.get(b.dataset.cut); if (!e) return;
    decklist.setCut(e.key, !e.cut); onChange();
  }));
  host.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
    const row = b.closest(".crow"), open = row.nextElementSibling;
    if (open && open.classList.contains("crow-editor")) { open.remove(); return; }
    host.querySelectorAll(".crow-editor").forEach(x => x.remove());
    const e = decklist.get(b.dataset.edit); if (!e) return;
    const ed = document.createElement("div"); ed.className = "crow-editor";
    ed.innerHTML = `<span class="helper">Jobs:</span>` + CAT_KEYS.map(k => `<button type="button" class="chip small ${e.cats.includes(k) ? "on" : ""}" data-cat="${k}" aria-pressed="${e.cats.includes(k)}">${esc(CAT_LABEL[k])}</button>`).join("");
    row.after(ed);
    ed.querySelectorAll("[data-cat]").forEach(chip => chip.addEventListener("click", () => {
      const cur = decklist.get(e.key); if (!cur) return;
      const k = chip.dataset.cat, cats = cur.cats.includes(k) ? cur.cats.filter(x => x !== k) : [...cur.cats, k];
      if (!cats.length) return;   // a card always has at least one job
      decklist.setCats(e.key, cats); onChange();
    }));
  }));
}
