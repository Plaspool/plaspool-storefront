import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AddOnOfferCard, AddOnOfferList, AddOnPendingSummary } from "./add-on-offer-card";
import { AddOnReviewControl, AddOnTotalRows } from "./add-on-review-control";
import { addOnRowsFor } from "./add-ons";
import type { AddOnOffer } from "../data/cart-api";

/**
 * The extras step's card, the stack, the phone's summary, and the review
 * step's control and rows — everything the add-on flow draws, rendered
 * through `renderToStaticMarkup` because the sheet that carries the card on a
 * phone is a portal this suite cannot reach.
 *
 * ═══ THE NOUNS ARE DELIBERATELY WRONG ═══
 * The live add-on will be called "Gift box". A component that hardcoded that
 * word — or lower-cased it into "Add gift box", or invented a noun of its own
 * — would pass against a realistic fixture and fail against the operator's
 * next add-on. So the fixture says "Velvet pouch", and every assertion on a
 * title expects it back exactly.
 */
function offer(over: Partial<AddOnOffer> = {}): AddOnOffer {
  return {
    id: "ado_pouch",
    title: "Velvet pouch",
    description: "A drawstring pouch, tied by hand.",
    imageUrl: null,
    price: { amount: 150000, currency: "NGN" },
    amount: { amount: 150000, currency: "NGN" },
    mode: "ask",
    choice: null,
    ...over,
  };
}

/** Does this markup show a product picture? Every `<img>` on a card with no
 *  picture must be the mark under `/brand/`, and nothing may be named. */
function showsOnlyThePlaceholder(html: string): void {
  const tags = html.match(/<img\b[^>]*>/g) ?? [];
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) {
    expect(tag).toMatch(/url=%2Fbrand%2F|src="\/brand\//);
    expect(tag).not.toMatch(/alt="[^"]+"/);
  }
}

describe("the offer card", () => {
  it("prints the operator's title and description verbatim", () => {
    const html = renderToStaticMarkup(<AddOnOfferCard offer={offer()} onChoose={() => {}} />);
    expect(html).toContain("Velvet pouch");
    expect(html).toContain("A drawstring pouch, tied by hand.");
  });

  it("prices it as an addition, in naira", () => {
    const html = renderToStaticMarkup(<AddOnOfferCard offer={offer()} onChoose={() => {}} />);
    expect(html).toContain("+ ₦1,500");
  });

  it("prices it from what the rule charges, never from the list price", () => {
    /* `price` is what it is worth; `amount` is what will be charged. A rule
       that makes it free leaves `price` at ₦1,500 and sets `amount` to zero,
       and the card must say Free. */
    const html = renderToStaticMarkup(
      <AddOnOfferCard
        offer={offer({ amount: { amount: 0, currency: "NGN" } })}
        onChoose={() => {}}
      />,
    );
    expect(html).toContain("Free");
    expect(html).not.toContain("1,500");
  });

  it("offers both answers as buttons of the same standing", () => {
    const html = renderToStaticMarkup(<AddOnOfferCard offer={offer()} onChoose={() => {}} />);
    expect(html).toMatch(/<button[^>]*>[^<]*Add it<\/button>/);
    expect(html).toMatch(/<button[^>]*>No thanks<\/button>/);
    /* Two buttons, no more: a third control on a yes/no card is a nag. */
    expect(html.match(/<button\b/g)).toHaveLength(2);
  });

  it("draws the shop's own no-picture box when the add-on has no image", () => {
    const html = renderToStaticMarkup(<AddOnOfferCard offer={offer()} onChoose={() => {}} />);
    showsOnlyThePlaceholder(html);
    expect(html).toContain("border-dashed");
  });

  it("fetches a real picture through the storefront's image proxy, unnamed", () => {
    const html = renderToStaticMarkup(
      <AddOnOfferCard
        offer={offer({ imageUrl: "/api/public/images/img_pouch" })}
        onChoose={() => {}}
      />,
    );
    expect(html).toMatch(/<img[^>]*src="\/images\/shop\/img_pouch"/);
    /* Decorative: the title is printed beside it. */
    expect(html).not.toMatch(/alt="[^"]+"/);
    expect(html).not.toContain("border-dashed");
  });

  it("says nothing where the operator wrote no description", () => {
    const html = renderToStaticMarkup(
      <AddOnOfferCard offer={offer({ description: null })} onChoose={() => {}} />,
    );
    expect(html).toContain("Velvet pouch");
    expect(html).not.toContain("null");
  });

  it("holds both buttons while an answer is in flight", () => {
    const html = renderToStaticMarkup(
      <AddOnOfferCard offer={offer()} disabled onChoose={() => {}} />,
    );
    expect(html.match(/<button[^>]*\bdisabled\b/g)).toHaveLength(2);
  });
});

describe("the stack of offers", () => {
  it("draws one card per pending offer, in the API's order", () => {
    const html = renderToStaticMarkup(
      <AddOnOfferList
        offers={[offer(), offer({ id: "ado_card", title: "Handwritten card" })]}
        onChoose={() => {}}
      />,
    );
    expect(html.indexOf("Velvet pouch")).toBeLessThan(html.indexOf("Handwritten card"));
    expect(html.match(/<article\b/g)).toHaveLength(2);
  });
});

describe("what a phone shows under the sheet", () => {
  it("names the offers, prices them, and offers one way back into the question", () => {
    const html = renderToStaticMarkup(
      <AddOnPendingSummary offers={[offer()]} onContinue={() => {}} />,
    );
    expect(html).toContain("Velvet pouch");
    expect(html).toContain("+ ₦1,500");
    expect(html).toMatch(/<button[^>]*>Continue<\/button>/);
    /* And it never answers for them — no Add it, no No thanks here. */
    expect(html).not.toContain("Add it");
    expect(html).not.toContain("No thanks");
  });

  it("counts the questions honestly", () => {
    expect(
      renderToStaticMarkup(<AddOnPendingSummary offers={[offer()]} onContinue={() => {}} />),
    ).toContain("One thing to decide");
    expect(
      renderToStaticMarkup(
        <AddOnPendingSummary
          offers={[offer(), offer({ id: "ado_2", title: "Card" })]}
          onContinue={() => {}}
        />,
      ),
    ).toContain("2 things to decide");
  });
});

describe("the review step's control", () => {
  it("offers to remove an accepted add-on, naming it and its price", () => {
    const html = renderToStaticMarkup(
      <AddOnReviewControl offer={offer({ choice: "accepted" })} onChange={() => {}} />,
    );
    expect(html).toContain("Velvet pouch");
    expect(html).toContain("₦1,500");
    expect(html).toMatch(/<button[^>]*>.*Remove<\/button>/);
    expect(html).not.toMatch(/>Add /);
  });

  it("offers to add a declined one, with the title verbatim — never lower-cased", () => {
    const html = renderToStaticMarkup(
      <AddOnReviewControl offer={offer({ choice: "declined" })} onChange={() => {}} />,
    );
    expect(html).toContain("Add Velvet pouch");
    expect(html).not.toContain("velvet pouch");
    expect(html).toContain("₦1,500");
    expect(html).not.toContain("Remove");
  });

  it("offers to add one that was never answered — the freeze prices it as declined", () => {
    /* An `ask` offer the rules raised after the extras step — off the
       delivery address, say — arrives on the review step unanswered. It is
       not on the order, so the control says so. */
    const html = renderToStaticMarkup(
      <AddOnReviewControl offer={offer({ choice: null })} onChange={() => {}} />,
    );
    expect(html).toContain("Add Velvet pouch");
    expect(html).not.toContain("Remove");
  });

  it("says Free where the rule charges nothing, in both states", () => {
    for (const choice of ["accepted", "declined"] as const) {
      const html = renderToStaticMarkup(
        <AddOnReviewControl
          offer={offer({ choice, amount: { amount: 0, currency: "NGN" } })}
          onChange={() => {}}
        />,
      );
      expect(html).toContain("Free");
      expect(html).not.toContain("₦0");
    }
  });

  it("holds while a repricing is in flight, in either state", () => {
    for (const choice of ["accepted", "declined"] as const) {
      const html = renderToStaticMarkup(
        <AddOnReviewControl offer={offer({ choice })} disabled onChange={() => {}} />,
      );
      expect(html).toMatch(/<button[^>]*\bdisabled\b/);
    }
  });
});

describe("the review step's rows", () => {
  it("draws the title beside the amount the API froze, and Included where it charged nothing", () => {
    const rows = addOnRowsFor(
      [
        { id: "ado_1", title: "Velvet pouch", mode: "chosen", amount: 150000 },
        { id: "ado_2", title: "Padded packing", mode: "included", amount: 0 },
      ],
      "NGN",
    );
    const html = renderToStaticMarkup(<AddOnTotalRows rows={rows} />);
    expect(html).toContain("Velvet pouch");
    expect(html).toContain("₦1,500");
    expect(html).toContain("Padded packing");
    expect(html).toContain("Included");
    expect(html).not.toContain("₦0");
  });

  it("draws nothing for an order with no add-ons", () => {
    expect(renderToStaticMarkup(<AddOnTotalRows rows={[]} />)).toBe("");
  });
});
