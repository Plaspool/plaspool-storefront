import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { OrdersList, OrdersListSkeleton, itemCount, orderRowPictures } from "./orders-list";
import type { LineImage, LineImageIndex } from "../data/catalog";
import type { Order, OrderLine, OrderListItem } from "../data/orders-api";

/**
 * THE RAIL'S RESERVED WIDTH, ITS ARITHMETIC, AND THE CLAIMS THE ROW MAY MAKE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THE FIRST CUT OF THIS FILE FAILED TO CONSTRAIN, because it is the
 * lesson: it asserted that the row and the wait were built from the same class
 * string, and that a pending row held "a thumbnail's worth of space". Both
 * passed while the wait's first column was 40px and a resolved row's was 158px
 * — a 113px sideways jump on every visit, and a 113px ragged left edge down the
 * resolved list. A test that pins the STRING while the BOX is free to vary is a
 * test of the wrong thing.
 *
 * So the assertions here are about widths that must be EQUAL ACROSS STATES,
 * never about markup being similar:
 *
 *   ONE RESERVED RAIL, everywhere. The same inline width on a one-line row, a
 *     five-line row and a pending row, in one rendered list — which is the only
 *     formulation that fails when the rail goes back to being sized by what is
 *     in it.
 *   A CEILING ON WHAT THE RAIL HOLDS, so the reserve cannot be quietly
 *     overrun by raising `MAX_THUMBS` without raising the slot.
 *   THE COUNT'S INVARIANT, in the units the row actually prints.
 *   THE LINK'S NAME, which is where an `alt` "for accessibility" would land.
 *
 * WHAT NO ASSERTION HERE CAN PROVE: that any of it renders at the pixel widths
 * intended. Row heights (74px from `sm`, 126px below), the 34px picture inside
 * the 40px square, and the left edge of the text column agreeing between the
 * wait and the resolved list are all measured on `/dev/orders`, where "The
 * list, waiting" and "The list, loading more" now sit directly above "The
 * list" so a rule can be held across them.
 *
 * Rendered through `react-dom/server`, like `line-thumb.test.tsx` next door.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const PLACED = 1_763_208_000_000; // 15 Nov 2025, a literal — never `Date.now()`.

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord_test",
    orderNumber: "2026-000007-F",
    customerId: "cus_test",
    email: "shopper@example.com",
    currency: "NGN",
    subtotal: 11_500_000,
    shippingTotal: 300_000,
    taxTotal: 0,
    grandTotal: 11_800_000,
    refundedTotal: 0,
    status: "paid",
    shippingAddress: {},
    billingAddress: {},
    placedAt: PLACED,
    paidAt: PLACED,
    fulfilledAt: null,
    cancelledAt: null,
    revision: 1,
    ...over,
  };
}

const COLOURS = ["Black", "White", "Red", "Orange", "Yellow", "Violet"];

function line(n: number, qty = 1, variantId = `var_${n}`): OrderLine {
  const colour = COLOURS[(n - 1) % COLOURS.length];
  return {
    id: `ln_${n}`,
    lineNo: n,
    variantId,
    sku: `PLA-${colour.toUpperCase()}-175MM-1KG`,
    title: "PLA Filament",
    optionValues: { Colour: colour, Weight: "1 kg", Diameter: "1.75 mm" },
    qty,
    unitAmount: 2_300_000,
    lineTotal: 2_300_000 * qty,
    fulfilledQty: 0,
  };
}

/** `n` lines of one item each — the ordinary shape. */
const lines = (n: number): OrderLine[] => Array.from({ length: n }, (_, i) => line(i + 1));

const COVER: LineImage = {
  src: "/api/public/images/img_cover",
  ofThisColour: false,
  colourHex: "#111111",
  weightGrams: 1000,
};

/** Every variant these lines name resolves to the product cover — which is
 *  what every line in the shop does today. */
const catalogued = (ls: OrderLine[]): LineImageIndex =>
  Object.fromEntries(ls.map((l) => [l.variantId, COVER]));

/** An unreachable catalogue, and a whole order of discontinued products, are
 *  the same empty index — see `getLineImages()`. */
const EMPTY: LineImageIndex = {};

function listOf(...orders: OrderLine[][]): OrderListItem[] {
  return orders.map((ls, i) => ({
    order: order({ orderNumber: `2026-00000${i + 1}-F` }),
    lines: ls,
  }));
}

function render(items: OrderListItem[], images: LineImageIndex, loading = false): string {
  return renderToStaticMarkup(
    <OrdersList
      items={items}
      cursor={loading ? "cur_next" : null}
      loading={loading}
      failed={false}
      onLoadMore={() => {}}
      lineImages={images}
    />,
  );
}

/** Every rail in a rendered list — the row's and the wait's alike, since both
 *  are built from `RAIL_BOX`. */
function railStyles(html: string): string[] {
  return [...html.matchAll(/<div class="col-span-2 flex items-center[^"]*" style="([^"]*)"/g)].map(
    (m) => m[1],
  );
}

/**
 * Every rail's declared WIDTH, and `null` where it declares none.
 *
 * THE DISTINCTION THIS EXISTS FOR: comparing the style STRINGS finds a rail
 * that reserves a different width, but it does not find a rail that reserves
 * none — drop the width and every rail reads `height:40px`, identical strings
 * over boxes that are 40px, 86px and 158px on screen. That is the exact shape
 * of the defect this file shipped, so the assertions below require a number
 * rather than agreement.
 */
function railWidths(html: string): (string | null)[] {
  return railStyles(html).map((s) => s.match(/(?:^|;)width:(\d+)px(?:;|$)/)?.[1] ?? null);
}

/** One reserved width, declared, across every rail in `html`. */
function expectOneReservedWidth(html: string, rails: number) {
  const widths = railWidths(html);
  expect(widths).toHaveLength(rails);
  expect(widths.filter((w) => w === null), "a rail reserved no width at all").toEqual([]);
  expect(new Set(widths).size, `rails differed: ${[...new Set(widths)].join(" | ")}`).toBe(1);
}

/** Thumbnail-sized boxes per rail: `LineThumb`'s three branches and
 *  `LineThumbSkeleton` all render one, at `size` px. */
/**
 * Does this markup show a picture of the GOODS?
 *
 * ═══ THIS REPLACED `expect(html).not.toContain("<img")` ═══
 * The invariant these tests exist for has never been "no image element". It is
 * that a line the catalogue cannot describe is not given an appearance — no
 * photograph, no tinted spool, no colour word. `not.toContain("<img")` was a
 * PROXY for that, and it stopped being one the moment the placeholder started
 * drawing the shop's own mark in greyscale: the assertion failed while the
 * invariant held, which is a test measuring the implementation instead of the
 * rule.
 *
 * So the rule is asserted directly. Every `<img>` must resolve to `/brand/`,
 * which the mark does and no product photograph ever can — catalogue images are
 * served from `/images/shop/<id>`. This is STRICTLY STRONGER than the old line:
 * it still fails if a product cover appears, and it now also fails if somebody
 * "helpfully" makes the fallback the product's cover image, which the old
 * assertion would have caught only by accident and the new one catches by
 * construction.
 */
function showsNoGoods(html: string): void {
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
    expect(tag).toMatch(/url=%2Fbrand%2F|src="\/brand\//);
    /* And it is never NAMED. An empty alt is the only alt a stand-in may
       carry; a named one would describe goods this box is not a picture of. */
    expect(tag).not.toMatch(/alt="[^"]+"/);
  }
  /* `SpoolImage`'s drawing, which is the other way to assert an appearance. */
  expect(html).not.toContain('<svg viewBox="0 0 200 200"');
}

function thumbsPerRail(html: string): number[] {
  return [...html.matchAll(/<div class="col-span-2 flex items-center[^>]*>(.*?)<\/div><\/(?:a|div)>/gs)]
    .map((m) => (m[1].match(/width:40px;height:40px/g) ?? []).length);
}

describe("the rail's reserved width", () => {
  /*
   * ═══ THE ASSERTION THE FIRST CUT NEEDED AND DID NOT HAVE ═══
   * `sm:grid-cols-[auto_…]` sizes the first column to its one item, so the
   * column is fixed if and only if that item's width is. One list, three line
   * counts, both states: every rail must be the same box.
   */
  const mixed = listOf(lines(1), lines(2), lines(5));

  it("is one declared number across every line count in a resolved list", () => {
    expectOneReservedWidth(render(mixed, catalogued(lines(5))), 3);
  });

  it("is the same number the wait reserves, in the same rendered list", () => {
    // `loading` puts pending rows in the same <ul> as resolved ones, so this
    // fails on any disagreement between the two rather than on a screenshot.
    expectOneReservedWidth(render(mixed, catalogued(lines(5)), true), 5); // 3 rows + 2 pending
  });

  it("is the same number the initial skeleton reserves", () => {
    const both = render(mixed, catalogued(lines(5))) + renderToStaticMarkup(<OrdersListSkeleton />);
    expectOneReservedWidth(both, 7); // 3 rows + the skeleton's 4
  });

  it("is 3 squares + 3 gaps + the count's room, and does not depend on content", () => {
    /*
     * The literal is here on purpose: `RAIL_PX` is 3 x 40 + 3 x 6 + 28, and if
     * `MAX_THUMBS` or the square grows without the slot following, this is what
     * says so. 166px also has to be WIDER than what a full rail holds — three
     * squares and two gaps is 132px — or the count would overrun the reserve.
     */
    const [style] = railStyles(render(listOf(lines(5)), catalogued(lines(5))));
    expect(style).toBe("width:166px;height:40px");
    expect(166).toBeGreaterThan(3 * 40 + 2 * 6);
  });

  it("never holds more squares than the reserve was sized for", () => {
    const ls = lines(20);
    const counts = thumbsPerRail(render(listOf(ls), catalogued(ls)));
    expect(counts).toEqual([3]);
  });

  it("holds exactly one square while it waits, and that cannot move the row", () => {
    /*
     * The wait's square count and a row's square count are ALLOWED to differ —
     * the wait cannot know how many lines are coming. What is not allowed is
     * for that difference to reach the layout, which is what the equal reserve
     * above guarantees and what this pairs with: one square, same box.
     */
    const html = renderToStaticMarkup(<OrdersListSkeleton />);
    expect(thumbsPerRail(html)).toEqual([1, 1, 1, 1]);
    expectOneReservedWidth(html, 4);
  });
});

describe("itemCount", () => {
  it("counts units, not lines — the bug the row shipped with", () => {
    /*
     * 2025-000042-F is one line of qty 2. The row said "1 item"; the order it
     * opened said "2 items", with the line under it reading "2 x N23,000".
     * `order-detail.tsx` fixed this on its own surface once and recorded why;
     * this is the same formula, and the row now prints the same number.
     */
    expect(itemCount([line(1, 2)])).toBe(2);
    expect(itemCount(lines(5))).toBe(5);
    expect(itemCount([line(1, 2), line(2, 3)])).toBe(5);
    expect(itemCount([])).toBe(0);
  });

  it("is what the row prints", () => {
    expect(render(listOf([line(1, 2)]), catalogued([line(1, 2)]))).toContain("2 items");
    /* ═══ THE SINGULAR IS ASSERTED WITHOUT LEANING ON WHAT FOLLOWS IT ═══
       This was `toContain("1 item ")` — with a trailing space, because the
       count used to be followed by " · Paid" on the same line. It was really
       testing "the noun is not pluralised", and it broke the moment the row's
       two lines swapped type and the count became the end of its line. A word
       boundary says the same thing and survives the row being rearranged
       again. */
    const one = render(listOf([line(1, 1)]), catalogued([line(1, 1)]));
    expect(one).toMatch(/\b1 item\b/);
    expect(one).not.toMatch(/\b1 items\b/);
    const many = [line(1, 2), line(2, 3)];
    expect(render(listOf(many), catalogued(many))).toContain("5 items");
  });
});

describe("orderRowPictures", () => {
  it("never loses an item: pictured + count is always the printed item count", () => {
    /*
     * THE PROPERTY THE "+N" DEPENDS ON, now anchored to units rather than to
     * lines. The row prints "N items" and then draws squares and a "+k"; a
     * customer reading the count has to be reading the same units.
     */
    const shapes: OrderLine[][] = [
      [],
      lines(1),
      lines(3),
      lines(5),
      lines(20),
      [line(1, 2)],
      [line(1, 2), line(2, 3)],
      [line(1, 2), line(2, 1), line(3, 4), line(4, 1), line(5, 1)],
    ];
    for (const ls of shapes) {
      const { shown, hidden } = orderRowPictures(ls);
      expect(itemCount(shown) + hidden, JSON.stringify(ls.map((l) => l.qty))).toBe(itemCount(ls));
      expect(hidden).toBeGreaterThanOrEqual(0);
    }
  });

  it("shows the first three lines and no more", () => {
    const { shown, hidden } = orderRowPictures(lines(5));
    expect(shown.map((l) => l.lineNo)).toEqual([1, 2, 3]);
    expect(hidden).toBe(2);
  });

  it("counts nothing extra for an order whose lines all fit, whatever their quantities", () => {
    // One line of qty 2 is ONE square beside "2 items" — the square stands for
    // a line, and every unit of that line is pictured by it.
    expect(orderRowPictures([line(1, 2)])).toEqual({ shown: [line(1, 2)], hidden: 0 });
    expect(orderRowPictures(lines(3)).hidden).toBe(0);
    expect(orderRowPictures([]).shown).toEqual([]);
  });

  it("gives one square per line, including two lines of the same variant", () => {
    /*
     * ═══ THE DEDUPLICATION THAT WAS REJECTED ═══
     * Collapsing lines that resolve to the same picture would, TODAY, turn
     * every multi-colour order into a single square — because every variant in
     * the catalogue currently resolves to the one product cover. That is our
     * missing photography editing the customer's order down to one item.
     */
    const sameVariant = [line(1, 1, "var_black"), line(2, 1, "var_black")];
    expect(orderRowPictures(sameVariant).shown).toHaveLength(2);
    expect(orderRowPictures(sameVariant).hidden).toBe(0);
  });

  it("counts items rather than pictures, so the catalogue cannot change it", () => {
    /*
     * The count never sees the image index, which is what stops "+2" from ever
     * meaning "two more pictures". Same order, a full catalogue and an empty
     * one, one answer.
     */
    const ls = lines(5);
    expect(orderRowPictures(ls).hidden).toBe(2);
    for (const images of [catalogued(ls), EMPTY]) {
      expect(render(listOf(ls), images)).toContain("+2");
    }
  });
});

describe("the rail, as rendered", () => {
  it("draws three squares and a count for a five-line order", () => {
    const ls = lines(5);
    const html = render(listOf(ls), catalogued(ls));
    expect(html.match(/<img /g) ?? []).toHaveLength(3);
    expect(html).toContain("5 items");
    expect(html).toContain("+2");
  });

  it("draws one square and no count for a one-line order", () => {
    const ls = lines(1);
    const html = render(listOf(ls), catalogued(ls));
    expect(html.match(/<img /g) ?? []).toHaveLength(1);
    expect(html).not.toContain("+");
  });

  it("claims no picture for a variant the catalogue does not have", () => {
    /*
     * THE HONESTY CASE — a discontinued product on an old order, and equally
     * a catalogue that could not be read. `LineThumb` owns what this looks
     * like; what is asserted here is that the ROW does not paper over it: no
     * photograph is emitted, the line is not dropped, and the square that
     * stands in its place is out of the accessibility tree entirely rather
     * than named after the product it is not a picture of.
     */
    const ls = lines(1);
    const html = render(listOf(ls), EMPTY);
    showsNoGoods(html);
    expect(html).toContain("border-dashed");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("PLA Filament");
    expect(thumbsPerRail(html)).toEqual([1]);
  });

  it("keeps the link's accessible name the order, not an inventory of it", () => {
    /*
     * Every `alt` in here is part of one link's name. The failure mode is a
     * later edit passing `alt={line.title}` "for accessibility" and turning
     * twenty links into twenty repetitions of the same product.
     */
    const ls = lines(5);
    const html = render(listOf(ls), catalogued(ls));
    for (const alt of html.match(/alt="[^"]*"/g) ?? []) expect(alt).toBe('alt=""');
    expect(html).not.toContain("PLA Filament");
    expect(html).not.toContain("title=");
    // The name is still the row's own text, and is not empty.
    expect(html).toContain("Order 2026-000001-F");
    expect(html).toContain("5 items");
  });

  it("hides the count from assistive tech, which already heard the item count", () => {
    const ls = lines(5);
    const html = render(listOf(ls), catalogued(ls));
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>\+2<\/span>/);
  });
});

describe("the wait", () => {
  it("is the row's box, from the same string", () => {
    /*
     * Necessary but nowhere near sufficient — the reserved-width suite above is
     * what actually constrains the layout. This stays because the row and the
     * wait being separate copies of the same markup is how they came to
     * disagree in the first place.
     */
    const ls = lines(2);
    const html = render(listOf(ls), catalogued(ls), true);
    const row = html.match(/<a class="([^"]+)" href="\/account\/orders\//)?.[1] ?? "";
    const pending = html.match(/<li aria-hidden="true"><div class="([^"]+)"/)?.[1];
    expect(row).not.toBe("");
    expect(pending).toBeDefined();
    // The row adds hover and focus styling on top; the BOX is the same string.
    expect(row.startsWith(pending as string)).toBe(true);
    expect(pending).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(pending).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto]");
  });

  it("draws four rows, which is what the list it stands in for is drawn as", () => {
    const html = renderToStaticMarkup(<OrdersListSkeleton />);
    expect(html.match(/<li>/g) ?? []).toHaveLength(4);
    expect(html).toContain('aria-busy="true"');
  });
});
