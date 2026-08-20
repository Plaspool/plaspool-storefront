import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  OrderDetail,
  OrderDetailSkeleton,
  orderContentsWords,
  orderPictureGroups,
  orderTrail,
} from "./order-detail";
import { CartProvider } from "../cart/cart-context";
import type { LineImage, LineImageIndex } from "../data/catalog";
import type { Order, OrderEvent, OrderLine } from "../data/orders-api";

/**
 * THE TRAIL'S GUEST BRANCH, AND THE CLAIMS THE PICTURE BLOCK IS ALLOWED TO MAKE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS CAN AND CANNOT PROVE — the same disclaimer `orders-list.test.tsx`
 * and `order-progress.test.tsx` carry. `renderToStaticMarkup` has no layout
 * engine: it cannot see that the picture block is a 64px row at every line
 * count, that its two lines of words truncate rather than wrap, that the
 * `<img>` inside a 64px square is 54px rather than the 0px a percentage inset
 * once collapsed it to, or that the skeleton and the resolved page put the
 * status panel at the same offset. All of that is measured on `/dev/orders` —
 * which carries `OrderDetailSkeleton` as its own case, directly above the eight
 * resolved ones — by `getBoundingClientRect` at 320, 375, 768 and 1280px, and
 * it is proved nowhere else. Nor can it see the measurement that decided WHERE
 * the block sits: the shop's cookie dialog is `position: fixed` over 325.25px
 * down on a 375×667 first landing, and the band this replaced put the status
 * headline behind it.
 *
 * What a test CAN pin is what would be wrong in the BYTES:
 *
 *   THE GUEST'S TRAIL. Half the visitors to this page arrived from an emailed
 *     link and have no account. A crumb pointing at `/account/orders` would
 *     bounce them to a sign-in wall — a real consequence, invisible in a
 *     screenshot taken while signed in, and one keystroke away at all times
 *     because the signed-in trail is right there in the same function.
 *
 *   THAT COLLAPSING THE SQUARES LOSES NOTHING. One square now stands for every
 *     line that resolved to the same photograph, which is every line in this
 *     shop. That is only honest while the words beside it describe the WHOLE
 *     order — every product, every colour, and the item count in units. Both
 *     halves are pinned: every line lands in exactly one group, and the words
 *     are built from all of them.
 *
 *   WHAT THE PICTURES ARE CALLED. Every thumbnail on this page is decorative,
 *     because the words are inches away. An `alt` is invisible in a screenshot,
 *     so a later "helpful" name here would be caught by nothing but this — and
 *     against this catalogue it would be a name for a colour the photograph is
 *     not of, which is the defect `LineImage.ofThisColour` exists to prevent.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const PLACED = 1_763_208_000_000; // 15 Nov 2025, a literal — never `Date.now()`.

/** In the catalogue, with the product cover standing in — which is what every
 *  live variant resolves to today, and why the squares collapse. */
const COVER: LineImage = {
  src: "/api/public/images/cover",
  ofThisColour: false,
  colourHex: "#111111",
  weightGrams: 1000,
};

function line(n: number, over: Partial<OrderLine> = {}): OrderLine {
  return {
    id: `ln_${n}`,
    lineNo: n,
    variantId: `var_${n}`,
    sku: `PLA-${n}`,
    title: "PLA Filament",
    optionValues: { Colour: COLOURS[n - 1] ?? "Black", Weight: "1 kg" },
    qty: 1,
    unitAmount: 2_300_000,
    lineTotal: 2_300_000,
    fulfilledQty: 0,
    ...over,
  };
}

const COLOURS = ["Black", "White", "Red", "Orange", "Yellow", "Green", "Blue"];

function lines(count: number): OrderLine[] {
  return Array.from({ length: count }, (_, i) => line(i + 1));
}

/** Every line in `ls` resolves to the product cover. A variant left out of this
 *  is exactly the discontinued case: nothing to draw, nothing to name. */
function images(ls: OrderLine[]): LineImageIndex {
  return Object.fromEntries(ls.map((l) => [l.variantId, COVER]));
}

function order(over: Partial<Order> = {}): Order {
  return {
    id: "ord_test",
    orderNumber: "2026-000007-F",
    customerId: "cus_test",
    email: "shopper@example.com",
    currency: "NGN",
    subtotal: 2_300_000,
    shippingTotal: 300_000,
    taxTotal: 0,
    grandTotal: 2_600_000,
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

const EVENTS: OrderEvent[] = [
  { id: "evt_1", type: "placed", message: "Order placed", occurredAt: PLACED, actorId: null },
  { id: "evt_2", type: "paid", message: "Payment received", occurredAt: PLACED, actorId: null },
];

/** `ReorderAction` calls `useCart()`, which throws outside a provider. The
 *  provider's only side effect is a `useEffect`, which `renderToStaticMarkup`
 *  never runs — so an empty catalogue is enough to render the page. */
function markup(node: React.ReactElement): string {
  return renderToStaticMarkup(<CartProvider catalog={[]}>{node}</CartProvider>);
}

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

function detail(ls: OrderLine[], opts: { isGuest?: boolean; images?: LineImageIndex } = {}) {
  return markup(
    <OrderDetail
      order={order()}
      lines={ls}
      events={EVENTS}
      isGuest={opts.isGuest ?? false}
      lineImages={opts.images ?? images(ls)}
    />,
  );
}

/** The `<nav>` the `Breadcrumb` renders, and nothing else — so the skeleton's
 *  trail and the resolved page's can be compared as strings. */
function trailMarkup(html: string): string {
  const match = html.match(/<nav aria-label="Breadcrumb".*?<\/nav>/s);
  return match ? match[0] : "";
}

describe("orderTrail", () => {
  it("takes a signed-in customer back to their orders list", () => {
    expect(orderTrail({ orderNumber: "2026-000007-F", isGuest: false })).toEqual([
      { label: "Home", href: "/" },
      { label: "Your orders", href: "/account/orders" },
      { label: "Order 2026-000007-F" },
    ]);
  });

  it("offers a guest nothing under /account — the page would bounce them to sign-in", () => {
    const trail = orderTrail({ orderNumber: "2026-000007-F", isGuest: true });
    expect(trail).toEqual([{ label: "Home", href: "/" }, { label: "Order 2026-000007-F" }]);
    expect(trail.some((crumb) => crumb.href?.startsWith("/account"))).toBe(false);
  });

  it("leaves the current page unlinked, whoever is looking", () => {
    for (const isGuest of [true, false]) {
      const trail = orderTrail({ orderNumber: "2026-000007-F", isGuest });
      expect(trail[trail.length - 1].href).toBeUndefined();
      expect(trail[trail.length - 1].label).toBe("Order 2026-000007-F");
      /* Every ANCESTOR is a link. A crumb with no href renders unlinked, so a
         dropped href is a dead trail rather than a visible error. */
      expect(trail.slice(0, -1).every((crumb) => !!crumb.href)).toBe(true);
    }
  });

  it("carries the order number the URL gave it, whatever shape it is", () => {
    expect(orderTrail({ orderNumber: "PS-10428", isGuest: false }).at(-1)?.label).toBe(
      "Order PS-10428",
    );
  });
});

describe("the trail, as rendered", () => {
  it("marks the order as the current page and does not link it", () => {
    const html = trailMarkup(detail(lines(1)));
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Order 2026-000007-F");
    /* The current crumb is a `<span>`; an `<a>` around the order number would
       mean the trail links to the page you are already on. */
    expect(html).not.toMatch(/<a[^>]*>Order 2026-000007-F/);
  });

  it("does not offer a guest the orders list", () => {
    expect(trailMarkup(detail(lines(1), { isGuest: true }))).not.toContain("/account/orders");
    expect(trailMarkup(detail(lines(1), { isGuest: false }))).toContain("/account/orders");
  });

  it("is byte-identical between the wait and the resolved page", () => {
    /* THE ONE THING THE SKELETON CANNOT GET WRONG. The order number and
       `?token=` are both in the URL, so the trail is answerable before the
       order arrives — and if these two ever diverge, the block above the title
       changes height on resolve and takes the whole page with it. No layout
       engine is needed to catch that: the markup itself has to match. */
    for (const isGuest of [true, false]) {
      const resolved = trailMarkup(detail(lines(2), { isGuest }));
      const waiting = trailMarkup(
        markup(<OrderDetailSkeleton orderNumber="2026-000007-F" isGuest={isGuest} />),
      );
      expect(waiting).toBe(resolved);
      expect(waiting).not.toBe("");
    }
  });
});

describe("orderPictureGroups", () => {
  it("collapses the lines that resolve to one photograph — which is all of them", () => {
    const ls = lines(5);
    const groups = orderPictureGroups(ls, images(ls));
    /* Five colours, five variant ids, one cover: one square. The five squares
       this replaced were five copies of the same bytes. */
    expect(groups).toHaveLength(1);
    expect(groups[0].lines).toHaveLength(5);
  });

  it("puts every line in exactly one group, whatever it resolved to", () => {
    /* The property the words depend on: they are built from `lines`, and the
       squares from the groups, so a line silently outside both would be an
       order the block under-reports. */
    const ls = lines(5);
    const partial: LineImageIndex = { [ls[0].variantId]: COVER, [ls[3].variantId]: COVER };
    for (const index of [images(ls), partial, {}]) {
      const seen = orderPictureGroups(ls, index).flatMap((g) => g.lines.map((l) => l.id));
      expect(seen.slice().sort()).toEqual(ls.map((l) => l.id).sort());
      expect(new Set(seen).size).toBe(ls.length);
    }
  });

  it("keeps a line the catalogue cannot describe in a group of its own", () => {
    const ls = lines(3);
    /* The middle variant is discontinued, deleted, or in a catalogue that could
       not be read. It draws the dashed "no picture" box, which is a different
       square from the photograph — so it must not collapse into it. */
    const partial: LineImageIndex = { [ls[0].variantId]: COVER, [ls[2].variantId]: COVER };
    const groups = orderPictureGroups(ls, partial);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.lines.length)).toEqual([2, 1]);
  });

  it("treats 'no entry at all' and 'an entry with nothing to draw' as one square", () => {
    /* `LineThumb`'s `drawable` sends both to the same dashed box, so grouping
       them apart would draw two identical squares and claim two pictures. */
    const ls = lines(2);
    const empty: LineImage = { src: null, ofThisColour: false, colourHex: null, weightGrams: 0 };
    const groups = orderPictureGroups(ls, { [ls[1].variantId]: empty });
    expect(groups).toHaveLength(1);
    expect(groups[0].lines).toHaveLength(2);
  });

  it("does not collapse two different pictures", () => {
    /* The day a per-colour photograph is uploaded, the same code draws two
       squares without this file changing. */
    const ls = lines(2);
    const own: LineImage = { ...COVER, src: "/api/public/images/red", ofThisColour: true };
    const groups = orderPictureGroups(ls, { [ls[0].variantId]: COVER, [ls[1].variantId]: own });
    expect(groups).toHaveLength(2);
  });

  it("does not collapse two spools of different colours", () => {
    /* No photograph anywhere, but the catalogue records the hex — `LineThumb`
       draws a spool tinted to it, so two hexes are two different pictures. */
    const ls = lines(2);
    const spool = (hex: string): LineImage => ({
      src: null,
      ofThisColour: false,
      colourHex: hex,
      weightGrams: 1000,
    });
    const groups = orderPictureGroups(ls, {
      [ls[0].variantId]: spool("#000000"),
      [ls[1].variantId]: spool("#ff0000"),
    });
    expect(groups).toHaveLength(2);
  });
});

describe("orderContentsWords", () => {
  it("counts ITEMS, in units, like the heading below it", () => {
    /* 2025-000042-F is ONE line of qty 2, and the heading under this block
       reads "2 items". A block saying "1 item" beside it would be the same
       disagreement the list row and this page already had once. */
    expect(orderContentsWords([line(1, { qty: 2 })]).contents).toBe("2 items · Black");
    expect(orderContentsWords([line(1)]).contents).toBe("1 item · Black");
  });

  it("names every colour in the order, distinct and in the order's own order", () => {
    expect(orderContentsWords(lines(5)).contents).toBe(
      "5 items · Black, White, Red, Orange, Yellow",
    );
  });

  it("says the colour of a line the catalogue has forgotten", () => {
    /* The words come from the ORDER, so a variant absent from the catalogue —
       no photograph, no hex, nothing that may be drawn — still gets its colour
       said out loud beside the dashed box. */
    const ls = [line(1, { optionValues: { Colour: "Violet", Weight: "1 kg" } })];
    expect(orderContentsWords(ls).contents).toBe("1 item · Violet");
  });

  it("degrades to the count alone when a line carries no colour", () => {
    expect(orderContentsWords([line(1, { optionValues: {} })]).contents).toBe("1 item");
  });

  it("names every distinct product, from the purchase-time title", () => {
    const ls = [line(1), line(2, { title: "PETG Filament" }), line(3)];
    expect(orderContentsWords(ls).products).toBe("PLA Filament, PETG Filament");
  });
});

describe("the picture block, as rendered", () => {
  it("states the whole order beside one square", () => {
    const html = detail(lines(5));
    /* One photograph, five items, five colours — the square cannot imply a
       smaller order than this sentence describes. */
    expect(html.match(/<img/g) ?? []).toHaveLength(6); // one here, five on the rows
    expect(html).toContain("5 items · Black, White, Red, Orange, Yellow");
  });

  it("reaches the accessibility tree, which the band it replaced could not", () => {
    const html = detail(lines(5));
    expect(html).toContain('<section aria-labelledby="order-contents-heading"');
    expect(html).not.toMatch(/aria-hidden="true"[^>]*class="flex items-center gap-3/);
  });

  it("names no picture on the page", () => {
    /* Every `<img>` is decorative: the words are inches away, and against this
       catalogue a name could only be the product's — every live variant
       resolves to the cover, with `ofThisColour: false`. */
    expect(detail(lines(5))).not.toMatch(/alt="[^"]+"/);
  });

  it("says nothing about a line the catalogue cannot describe, and still counts it", () => {
    const ls = [line(1, { optionValues: { Colour: "Violet", Weight: "1 kg" } })];
    const html = detail(ls, { images: {} });
    showsNoGoods(html);
    expect(html).not.toMatch(/alt="[^"]+"/);
    /* Two dashed boxes — one in the block, one on the row — and the colour is
       said in words rather than drawn. */
    expect(html.match(/border-dashed border-brand-line bg-brand-soft\/40/g) ?? []).toHaveLength(2);
    expect(html).toContain("1 item · Violet");
  });

  it("reserves the block in the wait, out of the same box the page uses", () => {
    /* A structural assertion, not a geometric one: the way this could regress
       is a second copy of the row's class string drifting from the first. That
       the row is 64px, and that the button below it does not move on resolve,
       is measured on `/dev/orders`. */
    const box = /class="flex items-center gap-3" style="height:64px"/;
    expect(markup(<OrderDetailSkeleton orderNumber="2026-000007-F" isGuest={false} />)).toMatch(box);
    expect(detail(lines(2))).toMatch(box);
  });

  it("draws no block at all for an order with no lines", () => {
    /* 64px of blank would be the page reserving space for goods it is not
       showing. The same order also loses the reorder button; it is degenerate
       either way. */
    expect(detail([])).not.toMatch(/style="height:64px"/);
  });
});
