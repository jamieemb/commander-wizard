"""Refresh data/packages/ from Archidekt.

Every card package on the jamie.emb account (32 Base Packages and 32 Land Packages, named
"<Identity> // Base Package" and "<Identity> // Land Package") is written to
data/packages/{base,lands}/<Identity>.txt in Archidekt export format, which the app reads in Stage 3.

    python scripts/sync_packages.py

Run it from anywhere after editing a package on Archidekt, then commit and push.
"""
import json, os, re, time, urllib.request

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "packages")
OWNER_ID = 1150256   # jamie.emb
UA = {"User-Agent": "CommanderWizard/dev (package sync)", "Accept": "application/json"}

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

# Archidekt package name -> the app's identity name
IDENT = {
    "mono-white": "White", "mono-blue": "Blue", "mono-black": "Black", "mono-red": "Red", "mono-green": "Green",
    "white": "White", "blue": "Blue", "black": "Black", "red": "Red", "green": "Green",
    "azorius": "Azorius", "dimir": "Dimir", "rakdos": "Rakdos", "gruul": "Gruul", "selesnya": "Selesnya",
    "orzhov": "Orzhov", "izzet": "Izzet", "golgari": "Golgari", "boros": "Boros", "simic": "Simic",
    "bant": "Bant", "esper": "Esper", "grixis": "Grixis", "jund": "Jund", "naya": "Naya",
    "abzan": "Abzan", "jeskai": "Jeskai", "sultai": "Sultai", "mardu": "Mardu", "temur": "Temur",
    "yore-tiller": "Yore-Tiller", "glint-eye": "Glint-Eye", "dune-brood": "Dune-Brood", "ink-treader": "Ink-Treader", "witch-maw": "Witch-Maw",
    "five colour": "Five colour", "five-colour": "Five colour", "five color": "Five colour", "five-color": "Five colour", "wubrg": "Five colour", "5 colour": "Five colour", "5-colour": "Five colour", "5 color": "Five colour", "5-color": "Five colour",
    "colourless": "Colourless", "colorless": "Colourless",
    # the four-colour packages are named by the colour they leave out
    "growth (no red)": "Witch-Maw", "altruism (no black)": "Ink-Treader", "aggression (no blue)": "Dune-Brood", "chaos (no white)": "Glint-Eye", "artifice (no green)": "Yore-Tiller",
}

def parse_name(name):
    m = re.match(r"^\s*(.+?)\s*//\s*(Base|Land)\s*Package\s*$", name, re.I)
    if not m: return None, None
    ident = IDENT.get(m.group(1).strip().lower())
    return ident, ("base" if m.group(2).lower() == "base" else "lands")

url, decks, total = f"https://archidekt.com/api/decks/v3/?packages=true&ownerId={OWNER_ID}&pageSize=100", [], None
while url:
    listing = get(url); total = listing["count"]; decks += listing["results"]; url = listing.get("next")
    if url: time.sleep(0.6)
print("packages listed:", total, "fetched:", len(decks))

todo, unknown = [], []
for r in decks:
    ident, kind = parse_name(r["name"])
    (todo if ident else unknown).append((r["id"], r["name"], ident, kind))
print("unmapped names:", [n for _, n, _, _ in unknown] or "none")

os.makedirs(os.path.join(OUT, "base"), exist_ok=True); os.makedirs(os.path.join(OUT, "lands"), exist_ok=True)
summary = []
for i, (did, name, ident, kind) in enumerate(sorted(todo, key=lambda t: (t[3], t[2]))):
    d = get(f"https://archidekt.com/api/decks/{did}/")
    excluded = {c["name"] for c in d.get("categories", []) if not c.get("includedInDeck", True)}
    lines, cats_seen = [], {}
    for c in d["cards"]:
        cats = [x for x in (c.get("categories") or []) if x]
        if cats and cats[0] in excluded: continue          # Maybeboard and the like
        cats = [x for x in cats if x not in excluded]
        cname = c["card"]["oracleCard"]["name"]
        lines.append(f"{c.get('quantity', 1)} {cname}" + (f" [{','.join(cats)}]" if cats else ""))
        for x in cats: cats_seen[x] = cats_seen.get(x, 0) + 1
    lines.sort(key=lambda s: s.lower())
    path = os.path.join(OUT, kind, f"{ident}.txt")
    with open(path, "w", encoding="utf-8", newline="\n") as f: f.write("\n".join(lines) + "\n")
    summary.append((kind, ident, len(lines), dict(sorted(cats_seen.items()))))
    print(f"{i+1:2}/{len(todo)} {kind:5} {ident:12} {len(lines):3} cards  <- {name} ({did})")
    time.sleep(0.6)

print("\ncategory names seen per file:")
for kind, ident, n, cats in summary: print(f"  {kind:5} {ident:12} {n:3}", cats)
