import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CartRowSkeleton, CartSkeleton } from "./cart-drawer";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DRAWER USED TO OPEN ONTO NOTHING.
 *
 * Every block in `CartDrawer` is gated on `cart.hydrated`, and that flips only
 * once a real round trip to the commerce API comes back. Until then the sheet
 * was its own title and empty space — at the exact moment a shopper has just
 * clicked and is looking straight at it.
 *
 * The empty state could not fill the gap either: "Your cart is empty" is a
 * CLAIM, and before the read lands it is the one thing nobody knows. Drawing it
 * and then replacing it with three rows would be worse than the blank.
 *
 * Rendered through `react-dom/server` with no props, the way
 * `unsellable-notice.test.tsx` does — no jsdom, no testing-library. The drawer
 * around it is unreachable from this suite twice over (a provider that does not
 * server-render, and a Radix portal), which is exactly why this component was
 * split out.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const html = renderToStaticMarkup(<CartSkeleton />);

describe("the cart drawer's loading state", () => {
  /* CLAUDE.md, "Loading states": once a section's layout is known, its loading
     state renders that layout. `Loading your cart…` as body text is the thing
     that rule exists to forbid — the shape is known, so draw the shape. */
  it("draws the basket's shape rather than a sentence about it", () => {
    expect(html).toContain("animate-pulse");
    /* Three placeholder rows, matching `CartLineRow`'s `<li>`. */
    expect(html.match(/<li/g)).toHaveLength(3);
  });

  it("puts no prose where content is going to be", () => {
    /* The visible text is the screen-reader label and nothing else. Any other
       words here would be a sentence standing in for the rows. */
    const visible = html.replace(/<[^>]+>/g, "").trim();
    expect(visible).toBe("Loading your cart");
    expect(html).not.toContain("Please wait");
    expect(html).not.toContain("…");
  });

  /* A wall of empty boxes is noise to a screen reader, so the placeholders are
     hidden and the WAIT is announced once, on the region. */
  it("announces the wait once and hides every placeholder", () => {
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Loading your cart");
    const bars = html.match(/animate-pulse/g) ?? [];
    const hidden = html.match(/aria-hidden="true"/g) ?? [];
    expect(hidden.length).toBeGreaterThanOrEqual(bars.length);
  });

  /* Shoppers who asked for less motion get a static tint, not a shimmer. */
  it("drops the shimmer under prefers-reduced-motion", () => {
    const bars = html.match(/animate-pulse/g) ?? [];
    const guarded = html.match(/motion-reduce:animate-none/g) ?? [];
    expect(guarded).toHaveLength(bars.length);
  });

  /*
   * ═══ THE ONE THAT COSTS PIXELS IF IT REGRESSES ═══
   * A skeleton that does not match the real box reflows the moment the data
   * lands — moving the text under the shopper's eye exactly as they start
   * reading. These are the load-bearing classes copied from `CartLineRow`: the
   * row box, the photograph's square, and the divider between rows.
   */
  it("mirrors the real row's box so nothing shifts when the cart lands", () => {
    expect(html).toContain("divide-y divide-brand-line px-6");
    expect(html).toContain("flex gap-3 py-4");
    expect(html).toContain("aspect-square w-16 shrink-0");
    /* The stepper is a fixed 36px control, so its placeholder is a height
       rather than a line box — `h-9` is the same class the real one uses. */
    expect(html).toContain("h-9");
  });

  /*
   * A `Skeleton` holding a plain ASCII space collapses to ZERO height, because
   * CSS discards a lone collapsible space — the defect `house-rules.test.ts`
   * greps for. `TextSkeleton` owns the no-break character so no caller types
   * it; this asserts the bars that stand in for text actually arrived with one.
   */
  it("gives every text placeholder a line box that will not collapse", () => {
    /* A bar sized by TYPE (`text-sm`, `text-xs`) has no height of its own \u2014 it
       is as tall as the line it stands in for, and only because it holds a
       NO-BREAK space. A plain ASCII space collapses and the bar renders 0px
       tall, which is invisible in every diff and every editor. That is the
       defect `house-rules.test.ts` greps the whole package for; here it is
       checked bar by bar.

       NOT `/>\s</`: JavaScript's `\s` MATCHES `\u00a0`, so that pattern flags
       the correct spelling and the broken one alike. It has to be the literal
       ASCII space. */
    const bars = [...html.matchAll(/<div[^>]*class="([^"]*animate-pulse[^"]*)"[^>]*>(.*?)<\/div>/g)];
    const textBars = bars.filter(([, cls]) => /\btext-(?:xs|sm|base|lg)\b/.test(cls));
    expect(textBars.length).toBeGreaterThan(0);
    for (const [, cls, body] of textBars) {
      expect(body, `bar "${cls}" has no no-break space and will render 0px tall`).toBe("\u00a0");
    }
    /* And the bars that DO carry an explicit height are the two that should:
       the photograph's square and the stepper's 36px block, per row. */
    const sized = bars.filter(([, cls]) => /\b(?:h-9|aspect-square)\b/.test(cls));
    expect(sized).toHaveLength(6);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AND THE ROW THAT IS ON ITS WAY.
 *
 * "Add to cart" opens the drawer and posts in the same breath, so for the whole
 * round trip the sheet showed the basket as it was a moment ago: on a first add
 * "Your cart is empty" — already false as it rendered — and on a later one, the
 * existing rows, with the new row and its divider appearing afterwards out of
 * nowhere. The same row shape now stands in for it until it lands.
 * ═══════════════════════════════════════════════════════════════════════════
 */
describe("the row that is arriving", () => {
  const row = renderToStaticMarkup(<CartRowSkeleton />);

  it("is one row, not a list", () => {
    expect(row.match(/<li/g)).toHaveLength(1);
    expect(row).not.toContain("<ul");
    /* No region of its own: it is appended INSIDE the real list, whose own
       `aria-busy` and label already describe the wait. A second live region
       nested in the first would announce the same wait twice. */
    expect(row).not.toContain("aria-busy");
  });

  it("is the same box as the rows it stands among", () => {
    expect(row).toContain("flex gap-3 py-4");
    expect(row).toContain("aspect-square w-16 shrink-0");
  });

  /* One row, because `add()` adds one thing. Three would promise a basket that
     is not coming. */
  it("draws exactly the number of rows it is asked for", () => {
    const one = renderToStaticMarkup(<CartSkeleton rows={1} label="Adding to your cart" />);
    expect(one.match(/<li/g)).toHaveLength(1);
    expect(one).toContain("Adding to your cart");
  });

  /* The opening skeleton and the arriving row must not drift apart — they are
     the same component, and this is what says so. */
  it("is the very shape the opening skeleton repeats", () => {
    const three = renderToStaticMarkup(<CartSkeleton />);
    expect(three.split(row)).toHaveLength(4);
  });
});
