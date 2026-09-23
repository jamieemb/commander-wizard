// The deck sheet: one A4 page in the manner of a character sheet, with everything needed to carry on building
// the deck in Archidekt. Opens in its own window and calls print(), so "Save as PDF" or paper are both one click.
import { CATEGORIES, TOTAL_SLOTS, PLAN_TARGET, PLAN_GATHER, CURVE_TEMPLATE, derivedNumbers, statSub } from "./numbers.js";
import { aimSentence } from "./sections/aim.js";
import { identityFor, esc } from "./sections/colours.js";
import { COLOR_NAMES } from "./data/colors.js";

const PIP = { W: "#efe3b4", U: "#2f7fc4", B: "#4a4452", R: "#cf4a36", G: "#3c8a49", C: "#b5ada1" };
const SHORT = { lands: "Lands", ramp: "Ramp", explosive: "Explosive", draw: "Draw", removal: "Removal", mass: "Wipes", protection: "Protection" };
const JOB_WORDS = { mana: "makes mana", cards: "draws cards", tokens: "makes tokens", removal: "removes things", recursion: "brings things back" };
const ROLE_WORDS = { engine: "Engine — does the thing", amplifier: "Amplifier — makes it bigger", payoff: "Payoff — wins once it exists", helper: "Helper — ramps, draws or removes" };
const TIMING_WORDS = { setup: "Setup — cast as early as possible", finisher: "Finisher — cast once the board is built" };
const signed = n => (n > 0 ? `+${n}` : `${n}`);
const lines = n => Array.from({ length: n }, () => `<div class="line"></div>`).join("");
const pips = colors => `<span class="pips">${[...(colors || "C")].map(c => `<span class="pip" style="background:${PIP[c]}" title="${COLOR_NAMES[c]}"></span>`).join("")}</span>`;

/** The sheet as a complete HTML document. */
export function sheetHTML(deck) {
  const c = deck.commander.chosen, n = deck.numbers, cmd = deck.commander;
  const colors = c ? c.colors : (deck.colours.colors || "");
  const ident = identityFor(colors);
  const identName = ident ? ident.name : (colors || "—");
  const bracket = n.bracket || 2;
  const val = k => n.targets[k] ?? CATEGORIES.find(x => x.key === k).def;
  const dn = derivedNumbers(deck);   // the same values and captions as the Stage 2 sheet
  const aim = aimSentence(deck.aim);
  const reasons = CATEGORIES.filter(x => (val(x.key) - x.def) || (n.because[x.key] || "").trim());
  const prefix = `${colors && colors !== "C" ? `id<=${colors.toLowerCase()}` : "id=c"} legal:commander${c ? ` -!"${c.name.split(" // ")[0].replace(/"/g, "")}"` : ""}`;
  const traits = c ? [c.scales === "good" ? "Scales against three opponents" : "Does not scale against the table", c.protects ? "protects itself" : "does not protect itself"].join(" · ") : "";

  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><title>${c ? esc(c.name) : "Deck"} — deck sheet</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 11mm 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #1c1b1a; font: 9.5pt/1.35 "Roboto", system-ui, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { width: 186mm; margin: 0 auto; padding: 6mm 0 4mm; }
@media screen { body { padding: 10mm 0; } }
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 6mm; border-bottom: 1.2pt solid #1c1b1a; padding-bottom: 2mm; margin-bottom: 3.5mm; position: relative; }
.head::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1.6mm; border-bottom: 0.4pt solid #1c1b1a; }
.kicker { font: 500 7pt/1 "Cinzel", serif; letter-spacing: .18em; text-transform: uppercase; color: #4a4640; margin-bottom: 1.5mm; }
.title { font: 700 20pt/1.1 "Cinzel", serif; letter-spacing: .02em; }
.subtitle { margin-top: 1.5mm; font-size: 9pt; color: #4a4640; display: flex; align-items: center; gap: 2mm; flex-wrap: wrap; }
.badge { border: 0.6pt solid #1c1b1a; border-radius: 1.2mm; padding: 1.2mm 2.4mm; font: 500 8pt/1 "Cinzel", serif; letter-spacing: .1em; text-transform: uppercase; text-align: center; }
.badge b { display: block; font-size: 16pt; margin-top: 1mm; letter-spacing: 0; }
.pips { display: inline-flex; gap: 0.8mm; vertical-align: middle; }
.pip { width: 3.2mm; height: 3.2mm; border-radius: 50%; display: inline-block; box-shadow: inset 0 0 0 0.3mm rgba(0,0,0,.35); }
.grid { display: grid; gap: 3mm; }
.box { border: 0.6pt solid #1c1b1a; border-radius: 1.6mm; padding: 2.2mm 3mm 2.6mm; position: relative; background: #fff; }
.box.double { box-shadow: 0 0 0 0.35mm #fff, 0 0 0 0.6mm #1c1b1a; border-color: #1c1b1a; }
.label { font: 500 6.5pt/1 "Cinzel", serif; letter-spacing: .16em; text-transform: uppercase; color: #4a4640; margin-bottom: 1.6mm; }
.two { grid-template-columns: 44mm 1fr; }
.art { padding: 1.5mm; display: flex; align-items: center; justify-content: center; }
.art img { width: 100%; border-radius: 4.75% / 3.5%; display: block; }
.art .none { height: 56mm; display: flex; align-items: center; justify-content: center; color: #4a4640; font-size: 8pt; text-align: center; }
.kv { display: grid; grid-template-columns: 22mm 1fr; gap: 0.8mm 2mm; font-size: 9pt; }
.kv dt { color: #4a4640; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em; padding-top: 0.5mm; }
.kv dd { margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 1.2mm; }
.chip { border: 0.5pt solid #7a746c; border-radius: 1.2mm; padding: 0.6mm 1.8mm; font-size: 8pt; }
.stats { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2.4mm; }
.stat { text-align: center; padding: 2mm 1mm 5mm; border: 0.7pt solid #1c1b1a; border-radius: 1.6mm; position: relative; }
.stat .label { margin-bottom: 0.8mm; }
.stat .value { font: 700 22pt/1 "Cinzel", serif; }
.stat .mod { position: absolute; left: 50%; bottom: -4mm; transform: translateX(-50%); width: 9mm; height: 7mm; border: 0.7pt solid #1c1b1a; border-radius: 3.5mm; background: #fff; font: 500 8pt/6.4mm "Roboto", sans-serif; }
.stat.changed .mod { background: #1c1b1a; color: #fff; }
.stat .def { font-size: 6.5pt; color: #4a4640; margin-top: 0.6mm; }
.derived { grid-template-columns: repeat(5, 1fr); margin-top: 6mm; }
.derived .stat { padding-bottom: 2mm; border-style: dashed; border-color: #7a746c; }
.derived .value { font-size: 15pt; }
.turns { grid-template-columns: repeat(3, 1fr); }
.turn .text { min-height: 9mm; font-size: 9pt; white-space: pre-wrap; }
.line { border-bottom: 0.4pt solid #7a746c; height: 5mm; }
.aim .text { font-size: 10.5pt; line-height: 1.4; }
.reasons { font-size: 8.5pt; }
.reasons div { display: grid; grid-template-columns: 30mm 1fr; gap: 2mm; padding: 0.8mm 0; border-bottom: 0.3pt solid #d0cbc3; }
.reasons div:last-child { border-bottom: 0; }
.reasons b { font-weight: 500; }
.ref { font-size: 8.2pt; line-height: 1.4; }
.ref p { margin: 0 0 1mm; }
.ref code { font: 8pt Consolas, "Courier New", monospace; background: #f1efeb; padding: 0.2mm 1mm; border-radius: 0.6mm; }
.curve { display: inline-flex; gap: 1.5mm; margin-left: 1mm; }
.curve span { border: 0.4pt solid #7a746c; border-radius: 0.8mm; padding: 0.3mm 1.2mm; font-size: 7.5pt; }
.section { margin-top: 3mm; }
</style></head>
<body>
  <header class="head">
    <div>
      <div class="kicker">Commander Wizard · Deck sheet</div>
      <div class="title">${c ? esc(c.name) : "No commander chosen"}</div>
      <div class="subtitle">${pips(colors)}<span>${esc(identName)}</span>${c ? `<span>·</span><span>MV ${c.mv}</span><span>·</span><span>${esc(c.typeLine)}</span>` : ""}</div>
    </div>
    <div class="badge">Bracket<b>${bracket}</b></div>
  </header>

  <div class="grid two">
    <div class="box art">${c && c.image ? `<img src="${c.image}" alt="${esc(c.name)}">` : `<div class="none">Commander art appears here once a commander is chosen in Stage 1.</div>`}</div>
    <div class="grid" style="gap:3mm">
      <div class="box">
        <div class="label">Commander</div>
        <dl class="kv">
          <dt>Role</dt><dd>${cmd.role ? esc(ROLE_WORDS[cmd.role] || cmd.role) : lines(1)}</dd>
          <dt>Timing</dt><dd>${cmd.timing ? esc(TIMING_WORDS[cmd.timing] || cmd.timing) : lines(1)}</dd>
          <dt>By itself</dt><dd>${c ? (c.jobs.length ? esc(c.jobs.map(j => JOB_WORDS[j]).filter(Boolean).join(", ")) : "does no job by itself — the deck supplies every job") : lines(1)}</dd>
          <dt>Reads as</dt><dd>${c ? esc(traits) : lines(1)}</dd>
          <dt>Key words</dt><dd>${cmd.keywords.length ? `<div class="chips">${cmd.keywords.map(k => `<span class="chip">${esc(k)}</span>`).join("")}</div>` : lines(1)}</dd>
        </dl>
      </div>
      <div class="box aim">
        <div class="label">Aim</div>
        <div class="text">${aim ? esc(aim) : lines(2)}</div>
      </div>
    </div>
  </div>

  <div class="section box double">
    <div class="label">Cards of each kind</div>
    <div class="stats">
      ${CATEGORIES.map(x => { const v = val(x.key), d = v - x.def; return `<div class="stat ${d ? "changed" : ""}"><div class="label">${SHORT[x.key]}</div><div class="value">${v}</div><div class="def">${statSub(v, x.def)}</div><div class="mod">${d ? signed(d) : "—"}</div></div>`; }).join("")}
    </div>
    <div class="label" style="margin-top:6mm">What that leaves</div>
    <div class="grid derived" style="margin-top:0">
      ${dn.items.map(it => `<div class="stat"><div class="label">${esc(it.label)}</div><div class="value">${it.value}</div><div class="def">${esc(it.sub)}</div></div>`).join("")}
    </div>
  </div>

  <div class="section grid turns">
    ${["t2", "t3", "t4"].map((k, i) => `<div class="box turn"><div class="label">Turn ${i + 2}</div><div class="text">${(n.turnPlan[k] || "").trim() ? esc(n.turnPlan[k]) : lines(2)}</div></div>`).join("")}
  </div>

  <div class="section grid" style="grid-template-columns: 1fr 1fr">
    <div class="box">
      <div class="label">Why the numbers are what they are</div>
      <div class="reasons">${reasons.length ? reasons.map(x => { const d = val(x.key) - x.def; return `<div><b>${x.label}${d ? ` ${signed(d)}` : ""}</b><span>${esc(n.because[x.key] || "")}</span></div>`; }).join("") : `<div><span>Every number is at the template default.</span></div>`}</div>
      ${(n.notes || "").trim() ? `<div class="label" style="margin-top:2mm">Notes</div><div class="ref">${esc(n.notes).replace(/\n/g, "<br>")}</div>` : `<div class="label" style="margin-top:2mm">Notes</div>${lines(3)}`}
    </div>
    <div class="box ref">
      <div class="label">Building it in Archidekt</div>
      <p><b>Stage 3.</b> Add the packages <b>${esc(identName)} // Base Package</b> and <b>${esc(identName)} // Land Package</b>, make a <b>Plan</b> category, and gather about ${PLAN_GATHER} candidate plan cards that match <b>two or more</b> key words. Stage 5 cuts them to about ${PLAN_TARGET}: ${dn.planSlots} in slots of their own plus ${Math.max(0, dn.overlap)} that also do a vegetable job.</p>
      <p>Every search starts <code>${esc(prefix)}</code></p>
      <p><b>Stage 4.</b> Cut each package category to its number, one at a time. GC beyond the allowance first, then Power, then ramp that lands a turn late. Two-job cards stay. Land Package to ${dn.nb} non-basics.</p>
      <p><b>Stage 5.</b> Cut plan cards to reach ${TOTAL_SLOTS} after basics. Six-plus cards 8 to 10. Curve <span class="curve">${[1, 2, 3, 4, 5, 6].map(m => `<span>${m === 6 ? "6+" : m}: ${CURVE_TEMPLATE[m]}</span>`).join("")}</span></p>
      <p><b>Then</b> goldfish 20 hands to turn 7: keep 3 lands plus ramp or draw, and ask "could I win from here in two turns?"</p>
    </div>
  </div>

</body></html>`;
}

/** Open the sheet in its own window and offer the print dialog once the art has loaded. */
export function openPrintSheet(deck) {
  const win = window.open("", "cw-deck-sheet");
  if (!win) return false;
  win.document.open(); win.document.write(sheetHTML(deck)); win.document.close();
  const go = () => { try { win.focus(); win.print(); } catch {} };
  const img = win.document.querySelector("img");
  const ready = Promise.all([
    win.document.fonts ? win.document.fonts.ready : Promise.resolve(),
    img && !img.complete ? new Promise(r => { img.onload = img.onerror = r; }) : Promise.resolve(),
  ]);
  Promise.race([ready, new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(go, 150));
  return true;
}
