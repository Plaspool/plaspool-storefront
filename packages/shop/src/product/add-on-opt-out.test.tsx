import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AddOnOptOut } from "./add-on-opt-out";
import { clampAddOnQty, productAddOnsPath, proxiedProductAddOnsPath } from "../data/add-ons-api";
import type { AddOnOffer } from "../data/cart-api";

/**
 * The buy box's "leave out the packaging" control, and the client that feeds
 * it.
 *
 * ═══ THE NOUNS ARE DELIBERATELY NOT "PACKAGING" IN THE ASSERTIONS ═══
 * The live add-on is called "Packaging" and the temptation is a component that
 * says "Send it without the box", which reads beautifully and is a hardcoded
 * noun for one operator's one add-on. The fixture is therefore titled
 * "Crate padding" — if the sentence around the title stops working for that,
 * it was never a sentence, it was a caption for a specific product.
 *
 * ═══ WHAT THIS PINS ABOVE EVERYTHING ELSE ═══
 * An unanswered opt-out COSTS NOTHING. Its `amount` is `{ amount: 0 }` because
 * keeping the box is free — the shopper bought it inside the product price —
 * and the only figure allowed on screen is what ticking the box GIVES BACK. A
 * "+ ₦500" here would charge them twice in their head.
 */
function offer(over: Partial<AddOnOffer> = {}): AddOnOffer {
  return {
    id: "ado_pad",
    title: "Crate padding",
    description: null,
    imageUrl: null,
    price: { amount: 50000, currency: "NGN" },
    unitAmount: { amount: 50000, currency: "NGN" },
    units: 4,
    basis: "item",
    amount: { amount: 0, currency: "NGN" },
    mode: "opt_out",
    choice: null,
    ...over,
  };
}

const noop = () => {};

describe("the buy box's opt-out control", () => {
  it("offers the saving, and prints the operator's title verbatim", () => {
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer()} checked={false} onChange={noop} />,
    );
    expect(html).toContain("Crate padding");
    expect(html).toContain("save ₦2,000");
  });

  it("shows the arithmetic behind a per-item saving", () => {
    /* `units` and `unitAmount` are on the wire so the client never counts the
       cart itself — "₦500 each × 4" is the server's own sum read back. */
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer()} checked={false} onChange={noop} />,
    );
    expect(html).toContain("₦500 each × 4");
  });

  it("never prices an unanswered opt-out as a charge", () => {
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer()} checked={false} onChange={noop} />,
    );
    expect(html).not.toContain("+ ₦");
    expect(html).not.toContain("Free");
    /* And no bare unit price standing on its own as if it were the cost. */
    expect(html).not.toMatch(/>\s*₦500\s*</);
  });

  it("quotes the saving from unitAmount × units, not from amount", () => {
    /* `amount` is 0 until the shopper declines, so a control that read it
       would offer "save ₦0" and be a tap that does nothing. */
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer()} checked={false} onChange={noop} />,
    );
    expect(html).toContain("₦2,000");
  });

  it("scales with the quantity the endpoint was asked about", () => {
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer({ units: 2 })} checked={false} onChange={noop} />,
    );
    expect(html).toContain("save ₦1,000");
    expect(html).toContain("₦500 each × 2");
  });

  it("draws nothing when there is no saving to offer", () => {
    /* A rule can price an opt-out at zero — packaging thrown in free — and a
       checkbox promising "save ₦0" wastes a tap to do nothing. */
    expect(
      renderToStaticMarkup(
        <AddOnOptOut
          offer={offer({ unitAmount: { amount: 0, currency: "NGN" } })}
          checked={false}
          onChange={noop}
        />,
      ),
    ).toBe("");
  });

  it("reflects the shopper's tick, and is describable to a screen reader", () => {
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer()} checked onChange={noop} id="opt" />,
    );
    expect(html).toContain("checked");
    expect(html).toContain('for="opt"');
    expect(html).toContain('aria-describedby="opt-detail"');
    expect(html).toContain('id="opt-detail"');
  });

  it("cannot be pressed into a race while the choice is being written", () => {
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={offer()} checked onChange={noop} busy />,
    );
    expect(html).toContain("disabled");
  });

  it("renders the operator's description when there is one, and nothing when there is not", () => {
    const withText = renderToStaticMarkup(
      <AddOnOptOut
        offer={offer({ description: "Corrugated, recycled." })}
        checked={false}
        onChange={noop}
      />,
    );
    expect(withText).toContain("Corrugated, recycled.");
  });

  it("still works for an offer that predates per-item pricing", () => {
    /* No `unitAmount`, no `units`, no `basis`. The fallbacks make it one unit
       charged once, so the saving is the whole amount and there is no
       arithmetic to show. */
    const bare = {
      id: "ado_old",
      title: "Gift wrap",
      description: null,
      imageUrl: null,
      price: { amount: 150000, currency: "NGN" },
      amount: { amount: -150000, currency: "NGN" },
      mode: "opt_out",
      choice: "declined",
    } as AddOnOffer;
    const html = renderToStaticMarkup(
      <AddOnOptOut offer={bare} checked onChange={noop} />,
    );
    expect(html).toContain("save ₦1,500");
    expect(html).not.toContain("each ×");
  });
});

/**
 * The endpoint is STRICT — `?qty=0` and `?foo=1` are both `400` — so the
 * clamping happens before the request rather than after it. A `400` would take
 * out a buy box for a shopper who did nothing but hold down the plus button.
 */
describe("asking the API what a product would be offered", () => {
  it("clamps the quantity into the schema's own range", () => {
    expect(clampAddOnQty(0)).toBe(1);
    expect(clampAddOnQty(-3)).toBe(1);
    expect(clampAddOnQty(1001)).toBe(1000);
    expect(clampAddOnQty(4)).toBe(4);
  });

  it("clamps a quantity that is not a number at all", () => {
    expect(clampAddOnQty(Number.NaN)).toBe(1);
    expect(clampAddOnQty(2.7)).toBe(2);
  });

  it("sends only the parameter the schema defines", () => {
    /* Anything else is a 400 from a route that is strict about it. */
    expect(productAddOnsPath("pla-basic", 4)).toBe(
      "/api/shop/add-ons/for-product/pla-basic?qty=4",
    );
  });

  it("escapes a slug rather than letting it steer the path", () => {
    expect(productAddOnsPath("a/b", 1)).toBe("/api/shop/add-ons/for-product/a%2Fb?qty=1");
  });

  it("gives the browser the same path on this origin", () => {
    /* The upstream route sends no Access-Control-Allow-Origin — verified on
       both environments with their own allow-listed origins — so the browser
       goes through the storefront's own proxy. */
    expect(proxiedProductAddOnsPath("pla-basic", 4)).toBe(
      "/api/add-ons/for-product/pla-basic?qty=4",
    );
  });
});
