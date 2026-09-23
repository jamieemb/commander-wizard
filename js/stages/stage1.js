// Stage 1: Commander. Search bar above the stepper; summary, key words, role, fairness and aim below; footer with "Numbers →".
import { renderCommanderSearch, renderCommanderSection } from "../sections/commander.js";
import { renderAimSection, aimComplete } from "../sections/aim.js";
import { store } from "../store.js";
import { saveNote } from "../app.js";

export function renderStage1(root, { goToStage }) {
  root.innerHTML = `
    <div class="stage-body">
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

  const drawCommander = () => renderCommanderSection(cmdEl, { onChange: update, onChangeCommander: () => showSearch(true) });
  renderCommanderSearch(searchEl, { onChange: () => { drawCommander(); showSearch(false); update(); } });
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
