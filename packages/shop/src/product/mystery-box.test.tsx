import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BoxHowItWorks, BoxItemCountLine, BoxSoldOutNotice, MysteryBoxLabel } from "./mystery-box";

/**
 * The product page's mystery-box pieces, through the markup a shopper gets.
 * No jsdom: the buy box is a client component, so these are the parts pulled
 * out of it to be assertable. See `return-intro.tsx` for the pattern.
 */

const text = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("MysteryBoxLabel", () => {
  it("says what this is", () => {
    expect(text(renderToStaticMarkup(<MysteryBoxLabel />))).toBe("Mystery box");
  });
});

describe("BoxItemCountLine", () => {
  it("states the count, singular and plural", () => {
    expect(text(renderToStaticMarkup(<BoxItemCountLine size={{ boxItemCount: 3 }} />))).toBe(
      "3 surprise items in every box.",
    );
    expect(text(renderToStaticMarkup(<BoxItemCountLine size={{ boxItemCount: 1 }} />))).toBe(
      "1 surprise item in every box.",
    );
  });

  it("renders nothing with no count, null or absent", () => {
    expect(renderToStaticMarkup(<BoxItemCountLine size={{ boxItemCount: null }} />)).toBe("");
    expect(renderToStaticMarkup(<BoxItemCountLine size={{}} />)).toBe("");
  });
});

describe("BoxHowItWorks", () => {
  it("renders three plain sentences with no numbered markers", () => {
    const html = renderToStaticMarkup(<BoxHowItWorks />);
    expect(text(html)).toBe(
      "How it works Every box is made up of items we have in stock. You won't know what's inside until it arrives. Once it's delivered, your order page lists everything that was in the box.",
    );
    expect(html).not.toContain("<ol");
    expect(html).not.toMatch(/>\s*1\./);
  });
});

describe("BoxSoldOutNotice", () => {
  it("says the box is sold out", () => {
    expect(text(renderToStaticMarkup(<BoxSoldOutNotice />))).toBe("The mystery box is sold out right now.");
  });
});
