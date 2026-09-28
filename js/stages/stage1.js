// Stage 1: Commander. Deck picker on top; search until a commander is chosen; summary, key words, role, fairness and aim below.
import { renderCommanderSearch, renderCommanderSection } from "../sections/commander.js";
import { renderAimSection, aimComplete } from "../sections/aim.js";
import { store } from "../store.js";
import { saveNote, rerender } from "../app.js";
import { esc } from "../sections/colours.js";
import { startPractice } from "../practice.js";

export function renderStage1(root, { goToStage }) {
  root.innerHTML = `
    <div class="stage-body">
      <div class="deck-bar" id="deck-bar"></div>
      <div id="sec-search" class="search-wrap"></div>
      <div id="sec-commander"></div>
      <div id="sec-aim"></div>
    </div>
    <div class="stage-footer">
      <span class="helper" data-save-note>${saveNote()}</span>
      <button class="btn filled" id="stage1-done">Numbers →</button>
    </div>`;

  const searchEl = root.querySelector("#sec-search");
  const cmdEl = root.querySelector("#sec-commander");
  const aimEl = root.querySelector("#sec-aim");
  const done = root.querySelector("#stage1-done");
  // The search shows until a commander is chosen; "Change commander" on the summary brings it back.
  const showSearch = on => { searchEl.hidden = !on; if (on) { const i = searchEl.querySelector("input"); if (i) { i.focus(); i.select(); } } };

  function complete() {
    const { commander } = store.deck;
    return !!(commander.chosen && commander.checks.notMean && commander.role && commander.timing && aimComplete(store.deck));
  }
  function update() { done.classList.toggle("disabled", !complete()); done.setAttribute("aria-disabled", String(!complete())); }

  // ----- the deck picker: every deck in this browser, a new one, a practice rep, delete -----
  function drawDeckBar() {
    const bar = root.querySelector("#deck-bar"), decks = store.decks(), cur = store.deck;
    bar.innerHTML = `
      <label class="deck-pick">Deck
        <select id="deck-select" aria-label="Which deck">${decks.map(x => `<option value="${x.id}" ${x.current ? "selected" : ""}>${x.practice ? "🎲 " : ""}${esc(x.name)}</option>`).join("")}</select>
      </label>
      ${cur.practice ? `<span class="chip small on" title="A practice rep: a random commander, built for the repetitions">Practice rep</span>` : ""}
      <span class="deck-bar-actions">
        <button type="button" class="btn text small" id="deck-new">New deck</button>
        <button type="button" class="btn tonal small" id="deck-practice" title="A random commander in a fresh deck">🎲 Practice</button>
        <button type="button" class="btn text small danger" id="deck-delete">Delete</button>
      </span>`;
    bar.querySelector("#deck-select").addEventListener("change", e => { if (store.switchTo(e.target.value)) rerender(); });
    bar.querySelector("#deck-new").addEventListener("click", () => { store.create(); rerender(); });
    bar.querySelector("#deck-delete").addEventListener("click", () => {
      if (!confirm(`Delete "${decks.find(x => x.current)?.name || "this deck"}" from this browser?`)) return;
      store.remove(store.deckId); rerender();
    });
    const pb = bar.querySelector("#deck-practice");
    pb.addEventListener("click", async () => {
      pb.disabled = true; pb.textContent = "Rolling…";
      try { await startPractice(); rerender(); }
      catch { pb.textContent = "Scryfall didn't answer"; setTimeout(() => { pb.textContent = "🎲 Practice"; pb.disabled = false; }, 1800); }
    });
  }

  drawDeckBar();
  const drawCommander = () => renderCommanderSection(cmdEl, { onChange: update, onChangeCommander: () => showSearch(true) });
  renderCommanderSearch(searchEl, { onChange: () => { drawCommander(); drawDeckBar(); showSearch(false); update(); } });
  drawCommander();
  searchEl.hidden = !!store.deck.commander.chosen;
  renderAimSection(aimEl, { onChange: update });
  update();

  done.addEventListener("click", () => {
    if (!complete()) return;
    store.update(d => { d.completed[1] = true; });
    goToStage(2);
  });
}
