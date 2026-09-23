// One floating card preview shared by the whole app (shortlist cards, the Stage 1 commander thumbnail).
// Mouse users hover and the card follows the pointer; with { tap: true } touch users tap to toggle it centred.
let peek = null;
function ensurePeek() {
  if (peek) return peek;
  peek = document.createElement("div");
  peek.className = "card-peek"; peek.setAttribute("aria-hidden", "true");
  peek.innerHTML = `<img alt="">`;
  document.body.appendChild(peek);
  return peek;
}
const finePointer = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * @param {Element|Iterable<Element>} targets elements that show a preview
 * @param {(el: Element) => string|null} srcOf   image URL for a target (null: nothing to show)
 * @param {{ tap?: boolean }} [opts]             tap: also toggle the preview on touch screens
 */
export function bindPeek(targets, srcOf, { tap = false } = {}) {
  const list = targets instanceof Element ? [targets] : [...targets];
  if (!list.length) return;
  const el = ensurePeek(), img = el.querySelector("img");
  let timer = null;
  const hide = () => { clearTimeout(timer); el.classList.remove("show", "centre"); };
  const place = e => {
    const w = el.offsetWidth, h = el.offsetHeight, gap = 18;
    let x = e.clientX + gap, y = e.clientY - h / 2;
    if (x + w > innerWidth - 8) x = e.clientX - gap - w;
    y = Math.max(8, Math.min(innerHeight - h - 8, y));
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  };
  if (finePointer()) {
    for (const t of list) {
      t.addEventListener("pointerenter", e => {
        const src = srcOf(t); if (!src) return;
        clearTimeout(timer);
        el.classList.remove("centre");
        if (img.src !== src) { el.classList.remove("show"); img.src = src; }
        place(e);
        timer = setTimeout(() => el.classList.add("show"), 90);
      });
      t.addEventListener("pointermove", place);
      t.addEventListener("pointerleave", hide);
    }
    return;
  }
  if (!tap) return;
  for (const t of list) {
    t.addEventListener("click", e => {
      const src = srcOf(t); if (!src) return;
      e.preventDefault();
      if (el.classList.contains("show") && img.src === src) return hide();
      img.src = src; el.style.transform = "";
      el.classList.add("centre", "show");
      setTimeout(() => document.addEventListener("pointerdown", hide, { once: true }), 0);
    });
  }
}
