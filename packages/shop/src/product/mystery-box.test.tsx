import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BoxHowItWorks, BoxSizePicker, MysteryBoxLabel } from "./mystery-box";
import type { SizeOption } from "../data/types";

/**
 * The product page's mystery-box pieces, through the markup a shopper gets.
 * No jsdom: the buy box is a client component, so these are the parts pulled
 * out of it to be assertable. See `return-intro.tsx` for the pattern.
 */

const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const size = (over: Partial<SizeOption>): SizeOption => ({
  id: "pla-3-spools",
  label: "PLA · 3 spools",
  weightGrams: 0,
  priceMinor: 1500000,
  compareAtMinor: null,
  currency: "NGN",
  boxItemCount: 3,
  ...over,
});

const PLA = size({});
const PETG = size({ id: "petg-5-spools", label: "PETG · 5 spools", boxItemCount: 5 });
const UNSET = size({ id: "abs-box", label: "ABS · box", boxItemCount: null });

describe("MysteryBoxLabel", () => {
  it("says what this is", () => {
    expect(text(renderToStaticMarkup(<MysteryBoxLabel />))).toBe("Mystery box");
  });
});

describe("BoxHowItWorks", () => {
  it("renders three plain sentences with no numbered markers", () => {
    const html = renderToStaticMarkup(<BoxHowItWorks />);
    expect(text(html)).toBe(
      "How it works Pick a size. Every box is made up of items we have in stock. You won't know what's inside until it arrives. Once it's delivered, your order page lists everything that was in the box.",
    );
    expect(html).not.toContain("<ol");
    expect(html).not.toMatch(/>\s*1\./);
  });
});

describe("BoxSizePicker", () => {
  const render = (choices: { size: SizeOption; sellable: boolean }[], selectedId = PLA.id) =>
    renderToStaticMarkup(<BoxSizePicker choices={choices} selectedId={selectedId} onSelect={() => {}} />);

  it("renders the owner's labels as they come, and the selected size's count", () => {
    const html = render([{ size: PLA, sellable: true }, { size: PETG, sellable: true }]);
    expect(text(html)).toBe("Box size PLA · 3 spools PETG · 5 spools 3 surprise items in every box.");
    expect(html).not.toContain("disabled");
  });

  it("keeps a sold-out size's label, disables it and says so in words", () => {
    const html = render([{ size: PLA, sellable: true }, { size: PETG, sellable: false }]);
    expect(text(html)).toContain("PETG · 5 spools Sold out");
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });

  it("calls a size with no pool unavailable rather than sold out", () => {
    const html = render([{ size: PLA, sellable: true }, { size: UNSET, sellable: false }]);
    expect(text(html)).toContain("ABS · box Unavailable");
  });

  it("prints no count line when the selected size cannot be sold", () => {
    const html = render([{ size: PLA, sellable: false }], PLA.id);
    expect(text(html)).not.toContain("surprise items");
    expect(html).toContain('aria-pressed="false"');
  });
});
