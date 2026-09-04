import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ONE CLASS THAT STOPS EVERY DRAWER IN THE SHOP OVERFLOWING.
 *
 * Radix wraps a `ScrollArea.Viewport`'s children in a div of its own and sets
 * `display: table; min-width: 100%` on it INLINE. A table box shrink-wraps to
 * MAX-CONTENT, which is what lets over-wide content scroll horizontally — and
 * is exactly wrong for a narrow vertical drawer, because it defeats every
 * `min-w-0` and `truncate` beneath it.
 *
 * Measured on the cart drawer at a 768px viewport, one line, one ordinary
 * product name:
 *
 *     sheet 384 │ viewport 383 │ Radix table div 519 │ row 471
 *
 * The row was not too wide for its parent — it had 519px and used it. So
 * `truncate` never fired (`scrollWidth` equalled `clientWidth`, no ellipsis),
 * the product name was sliced off 36px past the sheet edge by the Root's
 * `overflow: hidden`, and the unit price — "₦26,500 each" — rendered ENTIRELY
 * outside the drawer. After the fix: table div 383, row 335, nothing clipped.
 *
 * ═══ WHY THIS IS A STRING TEST ═══
 * The defect is a COMPUTED STYLE on an element Radix owns and this repo never
 * writes. It needs a real layout engine to observe, and this suite is
 * `environment: "node"` with no jsdom, deliberately — the same reason
 * `cart-page.test.ts` guards `CART_GRID` as a string. The class is the only
 * place the invariant is stated, so the class is what gets guarded.
 *
 * `!` is load-bearing and is asserted separately: Radix sets `display` inline,
 * and an inline style beats a plain class. Dropping just the `!` would leave a
 * class that looks right, reads right in review, and does nothing at all.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const source = readFileSync(join(__dirname, "primitives", "scroll-area.tsx"), "utf8");

/** The Viewport's className, comments stripped so the prose above it — which
 *  quotes the class by name — cannot satisfy the assertions on its own. */
const viewportClasses = (() => {
  const withoutComments = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const match = withoutComments.match(/<ScrollAreaPrimitive\.Viewport[^>]*className="([^"]*)"/);
  if (!match) throw new Error("ScrollArea.Viewport has no className to check");
  return match[1];
})();

describe("the ScrollArea viewport", () => {
  it("forces Radix's content wrapper back to a block box", () => {
    expect(viewportClasses).toContain("[&>div]:!block");
  });

  /* Without the bang this is a no-op: Radix's `display: table` is an inline
     style, and inline styles win over classes. */
  it("keeps the important flag that lets it beat the inline style", () => {
    expect(viewportClasses).toMatch(/\[&>div\]:!block/);
    expect(viewportClasses).not.toMatch(/\[&>div\]:block(?!!)/);
  });

  /* Every consumer is a vertical scroll region in a narrow drawer — this cart,
     both mobile navs, the filter drawer. Fixing only the surface that was
     reported is "the instance fixed, the sibling left". */
  it("still fills its container", () => {
    expect(viewportClasses).toContain("h-full");
    expect(viewportClasses).toContain("w-full");
  });
});
