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
3. **Plan cards** — add the two Archidekt card packages for your colours (`<Identity> // Base Package`, `<Identity> // Land Package`), then find plan cards in the stage's own search: a Scryfall-shaped page (query bar, sort, images or checklist, paging) scoped to the deck's colours, with the searches generated from the commander's key words (pairs, singles, finishers, two-job vegetables) as chips to click through in turn — each is ticked once looked at — and an *Add card* on every result. The plan list is copied to Archidekt in one go, in import format with every card in the Plan category. Paste the export to count plan cards (gather ~40).
4. **Cut the packages** — in the app: each vegetable category shows have / number / to-do, and every package card sits under its job in cutting order (Game Changers, Power, Upgrade, then mana value) with a Cut button. Two-job cards are the template's slack, so only one-job cards are held to the number; the pencil marks a card's second job. Plan cards are untouched.
5. **Cut to 99** — the wizard works out how many plan cards must go (size after basics − 99), lists them with Cut buttons, checks the six-plus count and curve, splits the basics across your colours by the pips in the finished spells and adds them, then exports the finished deck for Archidekt (categories and tags travel) or Moxfield (plain list) to goldfish.

The deck lives in the app from Stage 3 on: the two packages come in from `data/packages/`, the plan cards from the search, and the cuts happen on that list. Archidekt or Moxfield only see the finished 99. **Practice** (on the Find screen or the deck picker in Stage 1) rolls a random commander into a fresh deck for repetitions; the picker keeps every deck saved in the browser.

## Layout

- `index.html`, `css/app.css` — shell and styles.
- `js/app.js` — stage router and save indicator. `js/store.js` — per-deck state in localStorage.
- `js/numbers.js` — the template, the adjustment rules (`autoNumbers`), curve template, bracket → Game Changer allowance.
- `js/deckcheck.js` — turns a deck (the in-app list, or a pasted Archidekt export) into counts, tags, curve, pips, basics needed; `categoryState` applies the two-job rule.
- `js/decklist.js` — the deck itself: packages, plan cards and basics with their jobs, tags and cut flags; the export text. `js/packages.js` fetches the two packages from `data/packages/`. `js/practice.js` — the random-commander rep. `js/sections/cutlist.js` — the card rows Stages 4 and 5 share.
- `js/archidekt.js` — export parser (numbered lines with `[Category,Tags]` or header lines; alias map). `js/scryfall.js` — rate-limited, cached Scryfall client.
- `js/screens/` — the Find and Shortlist screens, and `plan.js`, the Scryfall-shaped plan-card search that Stage 3 mounts (`#plan?q=…` opens it on its own for a bookmarked search); `js/planlist.js` keeps the gathered plan cards with the deck.
- `js/sections/` — colour browser, commander finder, aim; `js/stages/` — one module per stage. `js/data/colors.js` — the 32 identities.
- `data/packages/base/<Identity>.txt`, `data/packages/lands/<Identity>.txt` — the two packages per colour identity, Archidekt export format (see `data/packages/README.md`).

## The packages

For each of the 32 colour identities there is an over-full Base Package (Ramp, Explosive Ramp, Card Draw, Removal, Mass Removal, Protection, with Upgrade / Power / GC tags) and a Land Package. The app reads them from `data/packages/` as Archidekt text exports, so the categories and tags travel with the cards. Archidekt itself can't be read from a browser on another site, which is why the files live here. Prices throughout are Cardmarket UK, near mint, cheapest printing.

Unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC.
