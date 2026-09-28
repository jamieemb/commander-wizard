// The two card packages for a colour identity, fetched from this site's own data folder:
//   data/packages/base/<Identity>.txt   the Base Package (ramp, draw, removal, wipes, protection)
//   data/packages/lands/<Identity>.txt  the Land Package
// Archidekt text export format, one card a line: "1 Arcane Signet [Ramp]", "1 Mana Vault [Ramp,GC]".
// Archidekt itself cannot be read from a browser on another site, so the files travel with the app.
import { parseDeckText } from "./archidekt.js";
import { decklist } from "./decklist.js";

export const PACKAGE_KINDS = [{ key: "base", label: "Base Package" }, { key: "lands", label: "Land Package" }];
export const packageFile = (kind, ident) => `data/packages/${kind}/${encodeURIComponent(ident)}.txt`;

async function fetchPackage(kind, ident) {
  const res = await fetch(packageFile(kind, ident), { cache: "no-cache" });
  if (!res.ok) { const err = new Error(`No ${PACKAGE_KINDS.find(k => k.key === kind).label} file for ${ident} (${res.status})`); err.kind = kind; throw err; }
  const { entries } = parseDeckText(await res.text());
  if (!entries.length) { const err = new Error(`The ${kind} package file for ${ident} has no cards in it`); err.kind = kind; throw err; }
  return entries;
}

/** Both packages for an identity into the deck. Returns { base: n, lands: n } added; throws naming the file that is missing. */
export async function addPackages(ident) {
  const out = {};
  for (const { key } of PACKAGE_KINDS) out[key] = decklist.addEntries(await fetchPackage(key, ident), key);
  return out;
}

/** A pasted Archidekt export instead of the files: land cards become the Land Package, everything else the Base Package. */
export function addPastedPackages(text) {
  const { entries } = parseDeckText(text);
  const lands = entries.filter(e => e.cats.includes("lands")), rest = entries.filter(e => !e.cats.includes("lands"));
  return { base: decklist.addEntries(rest, "base"), lands: decklist.addEntries(lands, "lands") };
}
