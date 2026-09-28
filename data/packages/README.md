# Card packages

Stage 3 adds the two packages for the deck's colour identity from this folder:

- `base/<Identity>.txt` — the Base Package: ramp, explosive ramp, card draw, removal, mass removal, protection
- `lands/<Identity>.txt` — the Land Package

`<Identity>` is the name the app uses for the colours: `White`, `Blue`, `Black`, `Red`, `Green`, `Azorius`, `Dimir`, `Rakdos`, `Gruul`, `Selesnya`, `Orzhov`, `Izzet`, `Golgari`, `Boros`, `Simic`, `Bant`, `Esper`, `Grixis`, `Jund`, `Naya`, `Abzan`, `Jeskai`, `Sultai`, `Mardu`, `Temur`, `Yore-Tiller`, `Glint-Eye`, `Dune-Brood`, `Ink-Treader`, `Witch-Maw`, `Five colour`, `Colourless`.

The files are Archidekt text exports, one card a line, with the category and any tags in square brackets:

```
1 Arcane Signet [Ramp]
1 Mana Vault [Ramp,GC]
1 Rhystic Study [Card Draw,Power]
1 Command Tower [Lands]
```

Categories are read by name (Ramp, Explosive Ramp, Card Draw, Removal, Mass Removal, Protection, Lands, and their usual aliases). `GC`, `Power` and `Upgrade` in the brackets are tags: they mark the card as a cut candidate in Stage 4.

Archidekt itself can't be read from the browser on another site, so the exports live here and travel with the app. `python scripts/sync_packages.py` refreshes every file from the packages on the jamie.emb Archidekt account (the four-colour ones are named there by the colour they leave out: Growth (no red) is Witch-Maw, Altruism (no black) Ink-Treader, Aggression (no blue) Dune-Brood, Chaos (no white) Glint-Eye, Artifice (no green) Yore-Tiller). Stage 3 also accepts the same export pasted in.
