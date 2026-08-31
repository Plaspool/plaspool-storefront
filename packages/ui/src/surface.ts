import { NEO_SURFACE } from "./neo";

/**
 * WHICH TREATMENT A CONTROL WEARS.
 *
 * ═══ THE POINT OF THIS FILE ═══
 * Before it, roughly twenty call sites pasted `NEO_SURFACE` into `cn(...)`.
 * Each of those was saying "be neobrutalist" — a VISUAL instruction — which is
 * exactly why the look could not be changed centrally: twenty files each
 * independently declared how they looked.
 *
 * This inverts it. A call site names WHAT KIND OF BUTTON IT IS (`tone`); one
 * resolver maps role → treatment; a flag picks which treatment table is live.
 * The consequences are the whole requirement:
 *
 *   · Flipping the flag reskins the storefront, BECAUSE NO CALL SITE NAMED A
 *     LOOK.
 *   · A component that must keep the old look PINS IT EXPLICITLY — a visible,
 *     greppable, comment-able exception instead of an accident.
 *   · A CALL SITE THAT DOES NOTHING FOLLOWS THE FLAG. `<Button>` derives its
 *     tone from `variant` (see `primitives/button.tsx`), so the common case is
 *     to write no surface code at all.
 *
 * ═══ TWO LEVELS OF PRECEDENCE, NOT THREE ═══
 * There is deliberately NO React context `<SurfaceProvider>`. It is the
 * obvious third level and it is a trap in the App Router: many of these
 * components are server components, and a context a server component silently
 * cannot read is worse than no context at all — it would appear to work in the
 * client-rendered dev kit and do nothing in production.
 *
 * If a subtree-level override is ever genuinely needed, the RSC-safe shape is
 * a wrapper element carrying `data-surface="neo"` with the CSS keyed off it:
 * no context, no `"use client"`, works on the server. Reach for that, not for
 * a provider.
 *
 * ═══ WHY A CONSTANT AND NOT AN ENVIRONMENT VARIABLE ═══
 * `NEXT_PUBLIC_*` values bake at build time, so an env var would need a deploy
 * to change — buying no operational flexibility over a constant while LOOKING
 * like it could be flipped live, which it could not. The constant is typed,
 * greppable, reviewable in a diff, and testable.
 */
export type ButtonSurface = "neo" | "machined";

/**
 * The ROLE a control plays, not the colour it is painted. Four and no more,
 * taken verbatim from the admin's `ButtonTone` so the two apps share one
 * vocabulary — it is already proven sufficient for a whole application, and it
 * makes a future "share one primitive across both repos" step nearly free.
 *
 *   primary  — the one real call to action on the screen
 *   default  — a normal button: white, machined
 *   plain    — no chrome at all until hovered
 *   critical — destructive
 */
export type ButtonTone = "default" | "primary" | "plain" | "critical";

/**
 * ═══ THE FLAG. ONE CONSTANT, ONE LINE, WHOLE-APP EFFECT. ═══
 *
 * Set this to "neo" and every button that has not pinned itself returns to the
 * neobrutalist look. Because the three product-purchase CTAs pin
 * `surface="neo"` explicitly, that flip is a TRUE full revert.
 *
 * Every exception in the codebase is one grep away:
 *
 *     grep -rn 'controlSurface(.*"neo"' packages
 */
export const DEFAULT_BUTTON_SURFACE: ButtonSurface = "machined";

/**
 * The machined key — three inset shadows, no border, a 1px instant press.
 * Defined in `packages/ui/src/styles/machined.css`, which every globals.css in
 * the monorepo `@import`s.
 *
 * `.mach` owns FILL, INK, BEVEL, PRESS, FOCUS, DISABLED — and nothing else.
 * Height, padding, width and type stay at the call site, exactly the division
 * `NEO_SURFACE` already used.
 */
const MACHINED: Record<ButtonTone, string> = {
  default: "mach mach--default",
  primary: "mach mach--primary",
  plain: "mach mach--plain",
  critical: "mach mach--critical",
};

/**
 * The neobrutalist treatment this replaced, kept whole so the flag has
 * somewhere to land.
 *
 * EVERY STRING BELOW IS WRITTEN OUT IN FULL AND MUST STAY THAT WAY. Tailwind
 * finds classes by scanning source text, so a name assembled at runtime — a
 * template literal, a `.map()` over tones, a concatenated prefix — produces no
 * CSS and fails silently at runtime rather than at build. A `Record` lookup is
 * fine; `` `mach--${tone}` `` is not.
 */
const NEO: Record<ButtonTone, string> = {
  default: NEO_SURFACE + " bg-background hover:bg-background",
  primary: NEO_SURFACE + " bg-brand text-brand-ink hover:bg-brand-hover",
  /**
   * NOT `NEO_SURFACE`, AND DELIBERATELY SO — this row is a correction to the
   * port brief, which specified the bare treatment here.
   *
   * `neo.ts` says the neobrutalist surface marks "one real call to action per
   * screen"; `announcement-bar.tsx` and `rewards-band.tsx` both carry comments
   * refusing it on exactly that ground. A `plain` control is by definition the
   * opposite — no chrome at all until hovered — so a 2px stroke and a 4px hard
   * shadow on one contradicts both the tone and the treatment's own doctrine.
   * Flipping the flag with `NEO_SURFACE` here put a heavy stroke and shadow
   * around every icon button in the shop nav, which no version of this app has
   * ever looked like.
   *
   * So `plain` reverts to the quiet ghost fill it has always had. The flip
   * still changes every button that was ever meant to be loud.
   */
  plain: "transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  critical: NEO_SURFACE + " bg-destructive text-destructive-foreground",
};

const TABLES: Record<ButtonSurface, Record<ButtonTone, string>> = {
  machined: MACHINED,
  neo: NEO,
};

/**
 * Resolve a control's classes from its role.
 *
 * Precedence is two levels and only two: an explicit `surface` argument beats
 * the flag, and nothing else gets a vote.
 *
 *     controlSurface("primary")          // follows the flag — the normal case
 *     controlSurface("primary", "neo")   // excused from the flag, on purpose
 */
export function controlSurface(
  tone: ButtonTone = "default",
  surface: ButtonSurface = DEFAULT_BUTTON_SURFACE,
): string {
  return TABLES[surface][tone];
}
