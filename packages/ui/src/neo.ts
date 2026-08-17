/**
 * The neobrutalist treatment, in one place.
 *
 * A hard offset shadow with no blur, a solid stroke, and a press that moves the
 * element into where its shadow was. Three surfaces use it — the blog card and
 * the two product CTAs — and issue #10 asked for it to be shared rather than
 * re-derived per component, because the numbers have to agree: the press
 * distance must equal the resting offset, or the shadow's outer edge visibly
 * jumps instead of the gap simply closing.
 *
 * COLOUR IS A VARIABLE, NOT A CHOICE MADE HERE. Every class below draws from
 * `--neo-shadow`, an HSL triple defaulting to the foreground (see globals.css).
 * Override per element with Tailwind's arbitrary-property syntax:
 *
 *     cn(NEO_SURFACE, NEO_BRAND_SHADOW)
 *
 * `--neo-shadow` and `--brand-accent` are both raw `H S% L%` triples, so one
 * substitutes for the other directly.
 *
 * The geometry: 4px at rest; 6px on hover/focus with the element pulled back
 * 2px, so the gap grows by 2 while the shadow's far edge stays put; 0px pressed
 * with the element moved forward 4px onto the shadow's own origin.
 *
 * EVERY CLASS IS WRITTEN OUT IN FULL AND MUST STAY THAT WAY. Tailwind finds
 * classes by scanning source text, so a name assembled at runtime — a template
 * literal, a `.map()` over variants, a concatenated prefix — produces no CSS
 * and fails silently at runtime rather than at build.
 */

/** Stroke and resting shadow. No motion of its own. */
const STILL = "border-2 border-foreground shadow-[4px_4px_0_0_hsl(var(--neo-shadow))]";

const TRANSITION =
  "transition-[transform,box-shadow] duration-100 ease-out motion-reduce:transition-none";

/** Raised, on hover. */
const HOVER =
  "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_hsl(var(--neo-shadow))]";

/**
 * Raised, on keyboard focus. The same depth change as hover: being focused is
 * information a keyboard user needs, and the ring alone reads as a browser
 * default rather than as part of this design.
 */
const FOCUS =
  "focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5 focus-visible:shadow-[6px_6px_0_0_hsl(var(--neo-shadow))]";

/**
 * Pressed. Pointer-only by design: `:active` is a press, and there is no
 * keyboard equivalent worth faking.
 */
const PRESS = "active:translate-x-1 active:translate-y-1 active:shadow-none";

const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Reduced motion keeps every depth change and drops the travel. */
const NO_TRAVEL =
  "motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-x-0 motion-reduce:focus-visible:translate-y-0 motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0";

/** The whole treatment: stroke, rest, hover, focus, press, reduced motion. */
export const NEO_SURFACE = [STILL, TRANSITION, HOVER, FOCUS, PRESS, RING, NO_TRAVEL].join(" ");

/** Draw the shadow in the brand accent instead of the foreground. */
export const NEO_BRAND_SHADOW = "[--neo-shadow:var(--brand-accent)]";
