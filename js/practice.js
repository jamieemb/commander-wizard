// Practice mode: a random commander, a fresh deck, and the whole wizard from Stage 1. Reps.
import { randomCard } from "./scryfall.js";
import { store } from "./store.js";
import { chooseCommander } from "./sections/commander.js";

const QUERY = "is:commander legal:commander -is:digital -is:funny -t:background";

/** Roll a commander, open a new practice deck with it chosen, and land on Stage 1. Throws if Scryfall doesn't answer. */
export async function startPractice() {
  const card = await randomCard(QUERY);
  store.create({ practice: true }, d => chooseCommander(d, card));
  location.hash = "#wizard/1";
  return card;
}
