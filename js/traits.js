// The two commander traits the wizard reads and shows everywhere: scales against three opponents, protects itself.
// One icon each, green when the card does it, grey when it doesn't. Shared by Stage 1 and the shortlist.
export const ICON_SCALES = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`;
export const ICON_SHIELD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>`;

export function traitTitles({ scales, protects, known = true }) {
  return {
    scales: scales ? "Scales against three opponents: its text hits each opponent or every player" : known ? "Does not scale against the table" : "Not read yet",
    protects: protects ? "Protects itself: hexproof, ward, indestructible or similar" : known ? "Does not protect itself" : "Not read yet",
  };
}

/** One round trait icon. `size` is "" (card corner) or "sm" (inline with text). */
export function traitIcon(kind, on, title, size = "") {
  return `<span class="trait ${size} ${on ? "on" : ""}" role="img" aria-label="${title}" title="${title}">${kind === "scales" ? ICON_SCALES : ICON_SHIELD}</span>`;
}

/** Both icons for a card. */
export function traitIcons(t, size = "") {
  const titles = traitTitles(t);
  return traitIcon("scales", !!t.scales, titles.scales, size) + traitIcon("protects", !!t.protects, titles.protects, size);
}
