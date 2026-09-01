import { describe, expect, it } from "vitest";

import { CART_GRID } from "./cart-page";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CART MUST NOT SCROLL SIDEWAYS ON A PHONE.
 *
 * The defect this pins: `lg:grid-cols-[1fr_320px]` on a bare `grid` left the
 * phone layout with an IMPLICIT `auto` column, and `auto` as a track minimum is
 * min-content. Every name on the cart row is `truncate` — `white-space:
 * nowrap` — so min-content is the product name at full length. Measured on the
 * live cart at 375px, one line, one ordinary name: an 80px photo, a 16px gap, a
 * 319px name, a 12px gap and a 64px price floored the single column at 491px
 * inside a 375px box. 132px of horizontal scroll, dragging the header, the
 * footer and the cookie banner off-screen with it.
 *
 * WHY THIS IS A STRING TEST AND NOT A RENDER. `CartPage` returns null until
 * `cart.hydrated`, and `useCart` throws outside a provider that does not run
 * under `react-dom/server` — so the class never reaches server-rendered markup
 * and cannot be read back out of the HTML the way `orders-list.test.tsx` reads
 * its row box. The class string is the only place the invariant is stated, so
 * the class string is what gets guarded.
 *
 * The assertions are STRUCTURAL rather than an equality check against the
 * current string: the layout is free to change, the floor is not.
 * ═══════════════════════════════════════════════════════════════════════════
 */

interface TrackList {
  /** The breakpoint the track list applies at; `base` for unprefixed. */
  at: string;
  tracks: string[];
}

/** Every `grid-cols-[…]` in a Tailwind class string, breakpoint prefix and all.
 *  Tailwind spells an arbitrary track list with `_` where CSS wants a space. */
function trackLists(classes: string): TrackList[] {
  return [...classes.matchAll(/(?:([a-z0-9]+):)?grid-cols-\[([^\]]+)\]/g)].map((m) => ({
    at: m[1] ?? "base",
    tracks: m[2].split("_"),
  }));
}

/**
 * Whether a track refuses to be squeezed narrower than its content.
 *
 * `1fr` is `minmax(auto, 1fr)` and `auto` is `minmax(auto, auto)` — both floor
 * at min-content, which is the whole bug. A track with an explicit `0` minimum
 * gives way, and so does one pinned to a length, which cannot grow at all.
 */
function floorsAtMinContent(track: string): boolean {
  if (/^minmax\(\s*0\s*,/.test(track)) return false;
  if (/^\d+(\.\d+)?(px|rem|em|ch|vw|%)$/.test(track)) return false;
  return true;
}

describe("the cart's layout grid", () => {
  it("declares the phone's column instead of leaving it implicit", () => {
    /* Without this the column is implicit, `auto`, and floored at the longest
       product name — the state the page shipped in. */
    const lists = trackLists(CART_GRID);
    expect(lists.map((l) => l.at)).toContain("base");
  });

  it("gives every flexible track a zero floor, at every breakpoint", () => {
    const lists = trackLists(CART_GRID);
    expect(lists.length).toBeGreaterThan(0);

    const offenders = lists.flatMap(({ at, tracks }) =>
      tracks.filter(floorsAtMinContent).map((track) => `${at}: ${track}`),
    );

    /* Named rather than counted, so a failure says which track and where. */
    expect(offenders).toEqual([]);
  });

  it("still reserves the summary's own column on a wide screen", () => {
    /* The fix is a floor, not a re-layout: the two-column shell stays. */
    const wide = trackLists(CART_GRID).find((l) => l.at === "lg");
    expect(wide?.tracks).toHaveLength(2);
    expect(wide?.tracks[1]).toMatch(/^\d+px$/);
  });
});
