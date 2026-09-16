import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { toProduct, type AdaptContext, type ApiProduct } from "../data/api";
import {
  boxCuesOf,
  boxSizeOptions,
  boxSizeSellable,
  boxStock,
  isMysteryBox,
  mysteryBoxOf,
  parseAvailability,
  showBoxSizePicker,
} from "../data/mystery-box";
import { maxQtyFor, stockOf } from "../cart/stock";
import { BoxCues, BoxHowItWorks, BoxItemCountLine, BoxSizePicker, placeBoxCues } from "./mystery-box";
import { FeatureList } from "./feature-list";
import { BulkTierTable } from "../components/bulk-tier-table";

/**
 * THE LIVE MYSTERY BOX, AS PRODUCTION SENT IT.
 *
 * Read off `admin.plaspool.com` on 2026-09-15 at 21:04 UTC, just after admin
 * PR #157, with the box switched ON. Trimmed to the fields this page reads, and
 * otherwise verbatim — including the curly apostrophes in the steps and the
 * box variant's `available: 0` with backorders on, which must be ignored.
 *
 * The storefront rendered from exactly these on the same evening: no size
 * section, ₦200,000, "1 surprise item in every box.", a "Just dropped an hour
 * ago" badge, "Only 11 left" under the price, "How it works" with three steps,
 * no empty dividers and an enabled button. These tests pin that the pieces
 * still say so for these inputs.
 */

const LIVE_PRODUCT = {
  id: "prd_mu321xtp05709b9b29c4405f",
  slug: "mystery-box",
  title: "Mystery box",
  description: null,
  status: "active",
  category: "Filament",
  tags: [],
  publishedAt: null,
  boxMode: "auto",
  overview: "🔮 What's Inside?",
  coverImageUrl: "/api/public/images/img_mu32m6ht5f5d209c2d9c464c",
  imageUrls: [],
  bulkTiers: [],
  mysteryBox: {
    sizes: [{ variantId: "var_mu321xuy8e1debaea68c4465", size: "Large", itemCount: 1 }],
    size: "Large",
    itemCount: 1,
    howItWorks: {
      title: "How it works",
      steps: [
        "Every box is made up of items we have in stock.",
        "You won’t know what’s inside until it arrives.",
        "Once it’s delivered, your order page lists everything that was in the box.",
      ],
    },
  },
  variants: [
    {
      id: "var_mu321xuy8e1debaea68c4465",
      sku: "MYSTERY-BOX",
      position: 0,
      weightGrams: null,
      status: "active",
      colorHex: null,
      optionValues: { Size: "Large" },
      boxItemCount: 1,
      price: { amount: 20000000, currency: "NGN" },
      available: 0,
      backorderable: true,
    },
  ],
} as unknown as ApiProduct;

const LIVE_AVAILABILITY = {
  variantId: "var_mu321xuy8e1debaea68c4465",
  available: 11,
  backorderable: true,
  canFill: 11,
  box: {
    onSaleSince: 1789500884977,
    cues: [
      { kind: "just_dropped", text: "Just dropped an hour ago" },
      { kind: "low_stock", text: "Only 11 left" },
    ],
  },
};

const ctx: AdaptContext = { categorySlugByName: new Map([["filament", "filament"]]), now: 1789505000000 };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("the live mystery box, 2026-09-15 21:04 UTC", () => {
  const product = toProduct(LIVE_PRODUCT, ctx)!;
  const availability = parseAvailability(LIVE_AVAILABILITY);
  const content = mysteryBoxOf(product)!;
  const [size] = product.sizes;

  it("is the box, with one size named Large at ₦200,000 and its overview as sent", () => {
    expect(isMysteryBox(product)).toBe(true);
    expect(product.sizes).toHaveLength(1);
    expect(size.label).toBe("Large");
    expect(size.priceMinor).toBe(20000000);
    expect(product.overview).toBe("🔮 What's Inside?");
  });

  it("offers that one named size, matched to its variant", () => {
    const offered = boxSizeOptions(product);
    expect(offered.map((entry) => [entry.box.size, entry.box.variantId, entry.option.id])).toEqual([
      ["Large", "var_mu321xuy8e1debaea68c4465", "large"],
    ]);
    expect(showBoxSizePicker(content.sizes)).toBe(true);
    expect(
      text(
        renderToStaticMarkup(
          <BoxSizePicker
            choices={[{ id: "large", label: "Large", sellable: true }]}
            selectedId="large"
            onSelect={() => {}}
          />,
        ),
      ),
    ).toBe("Size Large");
  });

  it("renders the singular count line", () => {
    expect(text(renderToStaticMarkup(<BoxItemCountLine size={{ itemCount: content.sizes[0].itemCount }} />))).toBe(
      "1 surprise item in every box.",
    );
  });

  it("renders How it works with the owner's three steps, apostrophes intact", () => {
    const html = renderToStaticMarkup(
      <BoxHowItWorks title={content.howItWorks.title} steps={content.howItWorks.steps} />,
    );
    expect(text(html)).toBe(
      "How it works Every box is made up of items we have in stock. You won’t know what’s inside until it arrives. Once it’s delivered, your order page lists everything that was in the box.",
    );
  });

  it("draws no bulk block and no empty divider", () => {
    expect(product.bulkTiers).toEqual([]);
    expect(renderToStaticMarkup(<BulkTierTable tiers={product.bulkTiers} basePrice={size.priceMinor} currency={size.currency} quantity={1} />)).toBe("");
    expect(renderToStaticMarkup(<FeatureList features={product.features} />)).toBe("");
  });

  it("places the badge beside the label and Only 11 left under the price", () => {
    const placed = placeBoxCues(boxCuesOf(availability));
    expect(text(renderToStaticMarkup(<BoxCues cues={placed.badge} />))).toBe("Just dropped an hour ago");
    expect(text(renderToStaticMarkup(<BoxCues cues={placed.price} />))).toBe("Only 11 left");
    expect(placed.soldOut).toEqual([]);
  });

  it("is buyable, capped at canFill, ignoring the variant's own 0 with backorders", () => {
    expect(stockOf(product, product.colours[0].id, size.id)).toEqual({ available: null, backorderable: false });
    expect(boxSizeSellable(size, availability)).toBe(true);
    expect(maxQtyFor(boxStock(availability))).toBe(11);
  });

  it("turns sold out on canFill 0 and shows the owner's sold-out words there", () => {
    const soldOut = parseAvailability({
      ...LIVE_AVAILABILITY,
      available: 0,
      canFill: 0,
      box: { onSaleSince: 1789500884977, cues: [{ kind: "sold_out", text: "Sold out. New boxes are on the way." }] },
    });
    expect(boxSizeSellable(size, soldOut)).toBe(false);
    const placed = placeBoxCues(boxCuesOf(soldOut));
    expect(text(renderToStaticMarkup(<BoxCues cues={placed.soldOut} />))).toBe("Sold out. New boxes are on the way.");
    expect(placed.price).toEqual([]);
  });

  it("shows no just-dropped badge once the admin stops sending it", () => {
    const later = parseAvailability({ ...LIVE_AVAILABILITY, box: { onSaleSince: 1789500884977, cues: [{ kind: "low_stock", text: "Only 9 left" }] } });
    expect(placeBoxCues(boxCuesOf(later)).badge).toEqual([]);
  });

  it("keeps the three ordinary products ordinary with mysteryBox null", () => {
    for (const slug of ["pla-basic", "pla-silk", "pla-1-75mm-3d-printer-filament-2"]) {
      const ordinary = toProduct(
        {
          ...LIVE_PRODUCT,
          slug,
          boxMode: null,
          mysteryBox: null,
          variants: [{ ...LIVE_PRODUCT.variants![0], optionValues: { Size: "1kg", Color: "Black" }, boxItemCount: null, available: 4, backorderable: false }],
        } as ApiProduct,
        ctx,
      )!;
      expect(isMysteryBox(ordinary)).toBe(false);
      expect(mysteryBoxOf(ordinary)).toBeNull();
    }
  });
});
