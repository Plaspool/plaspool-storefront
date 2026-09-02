import { cn } from "@plaspool/ui";

/**
 * The shop's progress indicator: a row of dots where the current one widens
 * into a pill.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO SURFACES DREW THIS INDEPENDENTLY AND DISAGREED ON EVERY VALUE.
 *
 * `hero-carousel.tsx` and `returns/return-steps.tsx` had arrived at visibly the
 * same idiom — `rounded-full`, `transition-all`, an inactive `bg-brand-line`,
 * an active state that widens rather than merely darkens — with three
 * differences that were nobody's decision: `h-2.5` vs `h-2`, a `w-8` pill vs a
 * `w-5` one, and `bg-brand` (the ramp's indigo) vs `bg-foreground` (near
 * black). The app's two progress indicators disagreed on size, travel and hue.
 *
 * The carousel's values win because they are the ones on the ramp: `bg-brand`
 * and `hover:bg-brand/40` are brand tokens, where `bg-foreground` and
 * `hover:bg-muted-foreground` were text colours borrowed for a control.
 *
 * ═══ CLASSES, NOT A COMPONENT, AND THAT IS DELIBERATE ═══
 * The two call sites are NOT the same control and must not be merged into one.
 * A carousel's dots are peers a reader may browse in any order, so
 * `hero-carousel.tsx` correctly pairs them with
 * `aria-roledescription="carousel"` and `aria-current="true"`. The return
 * dialog's are ordered steps ending in a form that submits, so
 * `return-steps.tsx` uses `aria-current="step"` and deliberately no
 * roledescription — see that file's header. Sharing the paint while keeping
 * the semantics apart is the whole point; a shared component would have to
 * take the semantics as props and would invite the next caller to pick the
 * wrong ones.
 *
 * Same reasoning as `CTA_BUTTON_CLASSES` in `chrome/announcement-bar.tsx`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Brand ring, `focus-visible` only. Lived in `hero-carousel.tsx` as
 *  `BUTTON_FOCUS`, where its sole use was these dots. */
const DOT_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * One dot. `current` widens it into the pill.
 *
 * The width is what carries the state — a shape difference reads at a glance,
 * where two 10px circles differing only in tone ask the eye to compare them.
 * `transition-all` rather than `transition-colors` because the width animates
 * too, and `motion-reduce` drops the movement for anyone who asked for less.
 */
export function progressDot(current: boolean): string {
  return cn(
    "h-2.5 rounded-full transition-all duration-200 motion-reduce:transition-none",
    DOT_FOCUS,
    current ? "w-8 bg-brand" : "w-2.5 bg-brand-line hover:bg-brand/40",
  );
}
