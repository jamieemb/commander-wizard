// The template and the rules that adjust it from the commander. Shared by stages 2 to 5.

export const CATEGORIES = [
  { key: "lands", label: "Lands", def: 38, what: "Only lands that always tap for mana. Double-faced land/spell cards count." },
  { key: "ramp", label: "Ramp", def: 10, what: "Mana beyond one land a turn: rocks, dorks, land ramp. Reliable and MV 3 or less. Rituals don't count." },
  { key: "explosive", label: "Explosive ramp", def: 2, what: "Roughly doubles your mana for a turn: rituals, treasure bursts, doublers. This is the bracket dial." },
  { key: "draw", label: "Card draw", def: 12, what: "Leaves you holding more cards than before. Cantrips, looting and Top don't count." },
  { key: "removal", label: "Removal", def: 12, what: "One card answers one thing: kill, counter, bounce, tap." },
  { key: "mass", label: "Mass removal", def: 6, what: "One card answers three or more: 2-4 true wipes, plus Propaganda, goad, edicts, graveyard exile." },
  { key: "protection", label: "Protection", def: 3, what: "Keeps your own things alive: Heroic Intervention, Boots." },
];
export const VEG_KEYS = CATEGORIES.map(x => x.key);
export const TOTAL_SLOTS = 99;
export const PLAN_TARGET = 26;
export const PLAN_GATHER = 40;
export const CURVE_TEMPLATE = { 1: 9, 2: 19, 3: 16, 4: 10, 5: 5, 6: 5 };
export const GC_ALLOWED = { 2: 0, 3: 3, 4: Infinity };

export function nonBasicDefault(lands) { return Math.ceil((Number(lands) || 38) / 2); }

/** The template adjusted from what was read off the commander's card. Returns { targets, why, read }. */
export function autoNumbers(deck) {
  const c = deck.commander.chosen;
  const colors = deck.colours.colors || "";
  const role = deck.commander.role, timing = deck.commander.timing;
  const bracket = deck.numbers.bracket || 2;
  const t = Object.fromEntries(CATEGORIES.map(x => [x.key, x.def]));
  const why = {};
  const read = []; // [what was read, what it changed]
  const add = (k, delta, reason, label) => {
    t[k] = Math.max(0, t[k] + delta);
    why[k] = (why[k] ? why[k] + " " : "") + reason;
    read.push({ label, effect: `${CATEGORIES.find(x => x.key === k).label} ${delta > 0 ? "+" : ""}${delta}` });
  };

  t.explosive = bracket === 4 ? 8 : bracket === 3 ? 4 : 2;
  why.explosive = `Bracket ${bracket}: ${bracket === 4 ? "about 8-9" : bracket === 3 ? "3-5" : "about 2"} pieces of explosive ramp.`;
  read.push({ label: `You chose bracket ${bracket}`, effect: `Explosive ramp = ${t.explosive}` });

  if (c) {
    const name = c.name.split(",")[0];
    if (c.jobs.includes("mana")) add("ramp", -3, `${name} makes mana by itself.`, "Its text makes mana");
    if (c.jobs.includes("cards")) add("draw", -3, `${name} draws cards by itself.`, "Its text draws cards");
    if (c.jobs.includes("removal")) add("removal", -3, `${name} removes things by itself.`, "Its text removes things");
    if (c.protects) add("protection", -1, `${name} protects itself.`, "Its text protects itself");
    if (c.mv >= 5) add("lands", +1, `A ${c.mv}-mana commander wants a 39th land so it lands on time.`, `Mana value ${c.mv}`);
    if (c.mv >= 6) add("ramp", +2, `At ${c.mv} mana you need more ramp, chaining 2-mana rocks into 4-mana rocks.`, `Mana value ${c.mv}`);
    if (c.mv <= 2) add("ramp", -2, `A ${c.mv}-mana commander is cast on turn 2 instead of a rock; run fewer, bigger ramp pieces.`, `Mana value ${c.mv}`);
    if (timing === "finisher") add("ramp", -1, `Cast as a finisher, so early turns go to engines and ramp can be lighter.`, "You cast it as a finisher");
    if (role === "helper" && !c.jobs.length) why.plan = `${name} is a helper: whichever category it covers, cut it by 3 or 4.`;
  }
  if (colors && !colors.includes("G") && colors !== "C") why.ramp = (why.ramp ? why.ramp + " " : "") + "No green: ramp is 2-mana rocks (Arcane Signet, Talismans, Fellwar Stone).";
  if (colors.includes("G")) why.mass = "Green has no good creature wipe: aim mass removal at artifacts and enchantments (Bane of Progress) and lean on protection.";
  if (colors === "RW" || colors === "R" || colors === "W") why.draw = (why.draw ? why.draw + " " : "") + "Red and white are weak at draw: do not go below the default; patch with Smothering Tithe-style effects, impulse draw and Monarch.";
  if (colors.length === 1) why.lands = (why.lands ? why.lands + " " : "") + "One colour: up to 10 colourless utility lands are fine.";
  if (colors.length >= 4) add("lands", +1, "Four or more colours: never below 38, and over-provide every colour with duals.", `${colors.length} colours`);
  return { targets: t, why, read };
}

export function turnPlanSuggestion(c, timing) {
  if (!c) return { t2: "", t3: "", t4: "" };
  const mv = c.mv, name = c.name.split(",")[0];
  if (timing === "finisher") return { t2: "A proactive 2-drop or a 2-mana rock", t3: "An engine or a 3-drop that does the thing", t4: `Develop; ${name} comes down once the board is built` };
  if (mv <= 2) return { t2: name, t3: "3-mana ramp or a 3-drop engine", t4: "A 4-drop, or two 2-drops" };
  if (mv === 3) return { t2: "1-mana ramp plus a 1-drop, or a proactive 2-drop", t3: name, t4: "A 4-drop that uses the commander, or two 2-drops" };
  if (mv === 4) return { t2: "2-mana rock or land ramp", t3: `${name} (2 + 2 = 4)`, t4: "Two plays: a 2-drop and a 2-drop, or a 4-drop" };
  if (mv === 5) return { t2: "A proactive 2-drop", t3: "3-mana ramp (Cultivate, Worn Powerstone)", t4: `${name} (3 + 2 = 5)` };
  return { t2: "2-mana rock", t3: "4-mana rock (Thran Dynamo, Skyshroud Claim)", t4: `${name} (2 + 4 = ${mv <= 7 ? mv : "7+"})` };
}

/** Current targets: what the user set, else the default. */
export function targetsOf(deck) {
  return Object.fromEntries(CATEGORIES.map(x => [x.key, deck.numbers.targets[x.key] ?? x.def]));
}

/** "default 38" when unchanged, "+2 vs 2" when changed. The same caption under a number everywhere it appears. */
export function statSub(val, def) {
  const d = val - def;
  return d ? `${d > 0 ? "+" : ""}${d} vs ${def}` : `default ${def}`;
}

/**
 * What the seven numbers leave: non-basic lands, basics, plan slots, two-job cards needed, Game Changers allowed.
 * Used by the Stage 2 sheet and the printed sheet so both show the same values and the same words.
 */
export function derivedNumbers(deck) {
  const t = targetsOf(deck), bracket = deck.numbers.bracket || 2;
  const veg = CATEGORIES.reduce((s, x) => s + (Number(t[x.key]) || 0), 0);
  const planSlots = TOTAL_SLOTS - veg, overlap = PLAN_TARGET - planSlots;
  const nbDef = nonBasicDefault(t.lands), nb = deck.numbers.nonBasics ?? nbDef, basics = Math.max(0, t.lands - nb);
  const gc = GC_ALLOWED[bracket];
  return {
    veg, planSlots, overlap, nb, nbDef, basics, gc,
    items: [
      { key: "nonbasics", label: "Non-basic lands", value: nb, sub: "cut the Land Package to this", editable: true },
      { key: "basics", label: "Basics", value: basics, sub: `of ${t.lands} lands, added last` },
      { key: "plan", label: "Plan cards", value: PLAN_TARGET, sub: overlap > 0 ? `${planSlots} slots of their own + ${overlap} two-job cards` : `${planSlots} slots, ${-overlap} to spare` },
      { key: "twoJob", label: "Two-job cards", value: Math.max(0, overlap), sub: overlap <= 0 ? "none needed" : overlap <= 16 ? "plan cards that also do a vegetable job" : "too many: trim a category", warn: overlap > 16 },
      { key: "gc", label: "Game Changers", value: gc === Infinity ? "any" : gc, sub: `bracket ${bracket} allowance` },
    ],
  };
}
