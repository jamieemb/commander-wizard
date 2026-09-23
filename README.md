# Commander Wizard

A five-stage deck-building companion that sits in a half-width window beside Archidekt. The deck lives in Archidekt; the wizard decides the numbers, generates the searches, and reads pasted exports back to tell you what is left to cut. No AI, no card management, nothing saved anywhere but your browser.

## Run it

No build step, no dependencies:

```bash
python serve.py 8080
```

Then open http://127.0.0.1:8080. (`serve.py` is `http.server` with caching turned off; any static server works.)

## The five stages

1. **Colour, commander, aim** — browse the 32 colour identities (what each represents, plays, is good and bad at), search commanders on Scryfall with filters (exact/within colours, does-a-job, MV, partner, sort), shortlist and compare, choose. The card's rules text is read for the jobs it does by itself, whether it scales against three opponents, whether it protects itself, and its key words. Then write the aim: one sentence in three parts, with the three checks.
2. **Numbers** — the template (38 lands · 10 ramp + 2 explosive · 12 draw · 12 removal · 6 mass · 3 protection · ~26 plan) adjusted from what was read: a commander that makes mana cuts ramp by 3, mana value moves lands and ramp, bracket sets explosive ramp. Every adjustment is shown as a line; every change you make needs a reason. Also sets how many lands are non-basic and scripts turns 2–4.
3. **Plan cards** — add the two Archidekt card packages for your colours (`<Identity> // Base Package`, `<Identity> // Land Package`), then find plan cards with searches generated from the commander's key words: pairs, singles, finishers, and two-job vegetables. Paste the export to count plan cards (gather ~40).
4. **Cut the packages** — paste the export; each vegetable category shows have / number / to-do. Two-job cards are the template's slack, so only one-job cards are held to the number. Game Changers are checked against the bracket. Plan cards are untouched.
5. **Cut to 99** — paste again; the wizard works out how many plan cards must go (size after basics − 99), checks the six-plus count and curve, and splits the basics across your colours by the pips in the finished spells.

## Layout

- `index.html`, `css/app.css` — shell and styles.
- `js/app.js` — stage router and save indicator. `js/store.js` — per-deck state in localStorage.
- `js/numbers.js` — the template, the adjustment rules (`autoNumbers`), curve template, bracket → Game Changer allowance.
- `js/deckcheck.js` — turns an Archidekt text export into counts, tags, curve, pips, basics needed; `categoryState` applies the two-job rule.
- `js/archidekt.js` — export parser (numbered lines with `[Category,Tags]` or header lines; alias map). `js/scryfall.js` — rate-limited, cached Scryfall client.
- `js/sections/` — colour browser, commander finder, aim; `js/stages/` — one module per stage. `js/data/colors.js` — the 32 identities.
- `archive/` — earlier versions (the nine-stage wizard, the single-page guide).
- `research/test-exports/` — sample Archidekt exports for trying stages 3–5.

## Base packages

`research/packages/` generates the vegetable packages: for each of the 32 colour identities, an over-full list of Lands, Ramp, Explosive Ramp, Card Draw, Removal, Mass Removal and Protection with tiers (Core / Upgrade / Power), Cardmarket prices and one-line reasons. `modules.json` is the source; `scripts/build_all.py` verifies every card against Scryfall and composes them into `out/`. `Archidekt Packages/` holds the result split as the app expects: `Base Packages/<Identity>.txt` (non-lands) and `Land Packages/<Identity>.txt`, in Archidekt import format so the categories and Upgrade / Power / GC tags travel with the cards.

## Research

`research/` holds the source material the system was distilled from: the full reference (`SYSTEM_v1.0.md`), the printable walkthrough, per-video notes for 54 videos, and the transcript scripts. Raw transcripts are git-ignored. Prices throughout are Cardmarket UK, near mint, cheapest printing.

Unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC.
