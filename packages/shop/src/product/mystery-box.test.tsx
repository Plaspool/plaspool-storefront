import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BoxCues,
  BoxHowItWorks,
  BoxItemCountLine,
  BoxSize,
  MysteryBoxLabel,
  placeBoxCues,
} from "./mystery-box";
import { FeatureList } from "./feature-list";
import { BulkTierTable } from "../components/bulk-tier-table";

/**
 * The product page's mystery-box pieces, through the markup a shopper gets.
 * No jsdom: the buy box is a client component, so these are the parts pulled
 * out of it to be assertable. See `return-intro.tsx` for the pattern.
 *
 * The words here are FIXTURES standing in for what the owner types in
 * Settings → Mystery box; the storefront writes none of them.
 */

const text = (html: string) =>
  html.replace(/&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("MysteryBoxLabel", () => {
  it("says what this is", () => {
    expect(text(render(<MysteryBoxLabel />))).toBe("Mystery box");
  });
});

describe("BoxItemCountLine", () => {
  it("states the count, singular and plural", () => {
    expect(text(render(<BoxItemCountLine size={{ boxItemCount: 3 }} />))).toBe("3 surprise items in every box.");
    expect(text(render(<BoxItemCountLine size={{ boxItemCount: 1 }} />))).toBe("1 surprise item in every box.");
  });

  it("renders nothing with no count, null or absent", () => {
    expect(render(<BoxItemCountLine size={{ boxItemCount: null }} />)).toBe("");
    expect(render(<BoxItemCountLine size={{}} />)).toBe("");
  });
});

describe("BoxSize", () => {
  it("shows the owner's size as one pill under a heading", () => {
    const html = render(<BoxSize size="Large" />);
    expect(text(html)).toBe("Size Large");
    expect(html).not.toContain("<button");
  });

  it("renders no section at all with no size", () => {
    expect(render(<BoxSize size={null} />)).toBe("");
  });
});

describe("BoxHowItWorks", () => {
  const STEPS = ["Every box is packed from what we have.", "It's a surprise until it arrives."];

  it("renders the heading and one line per step, in order, with no numbers", () => {
    const html = render(<BoxHowItWorks title="How it works" steps={STEPS} />);
    expect(text(html)).toBe("How it works Every box is packed from what we have. It's a surprise until it arrives.");
    expect(html).not.toContain("<ol");
  });

  it("uses a custom title", () => {
    expect(text(render(<BoxHowItWorks title="What to expect" steps={STEPS} />))).toMatch(/^What to expect /);
  });

  it("renders no section with no steps", () => {
    expect(render(<BoxHowItWorks title="How it works" steps={[]} />)).toBe("");
  });

  it("prints steps as text, never as HTML", () => {
    expect(render(<BoxHowItWorks title="How" steps={["<b>bold</b>"]} />)).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("has no hard-coded copy left in the component", () => {
    expect(render(<BoxHowItWorks title="T" steps={["One."]} />)).not.toContain("Pick a size");
  });
});

describe("BoxCues", () => {
  const ALL = [
    { kind: "just_dropped", text: "Just dropped 2 hours ago" },
    { kind: "low_stock", text: "Only 22 left" },
    { kind: "selling_fast", text: "4 bought in the last 24 hours" },
    { kind: "sold_out", text: "Sold out. New boxes are on the way." },
  ];

  it("prints every kind's text as sent, in order", () => {
    expect(text(render(<BoxCues cues={ALL} />))).toBe(
      "Just dropped 2 hours ago Only 22 left 4 bought in the last 24 hours Sold out. New boxes are on the way.",
    );
    for (const cue of ALL) expect(render(<BoxCues cues={ALL} />)).toContain(`data-cue="${cue.kind}"`);
  });

  it("renders nothing, and no empty container, with no cues", () => {
    expect(render(<BoxCues cues={[]} />)).toBe("");
  });

  it("renders an unknown kind as a plain line rather than dropping it", () => {
    expect(text(render(<BoxCues cues={[{ kind: "new_thing", text: "Back by demand" }]} />))).toBe("Back by demand");
  });

  it("places cues by kind, keeping order, with unknown kinds under the price", () => {
    const placed = placeBoxCues([...ALL, { kind: "new_thing", text: "x" }]);
    expect(placed.badge.map((c) => c.kind)).toEqual(["just_dropped"]);
    expect(placed.price.map((c) => c.kind)).toEqual(["low_stock", "selling_fast", "new_thing"]);
    expect(placed.soldOut.map((c) => c.kind)).toEqual(["sold_out"]);
  });
});

describe("the empty blocks between Quantity and How it works", () => {
  it("draws no bulk table and no divider for a product with no tiers", () => {
    expect(render(<BulkTierTable tiers={[]} basePrice={100} currency="NGN" quantity={1} />)).toBe("");
    expect(render(<FeatureList features={[]} />)).toBe("");
  });

  it("still draws both when there is something in them", () => {
    const table = render(
      <BulkTierTable tiers={[{ minQty: 5, percentBps: 1000 }]} basePrice={100000} currency="NGN" quantity={1} />,
    );
    expect(table).toContain("<table");
    const list = render(<FeatureList features={["Dried and sealed"]} />);
    expect(list).toContain("border-t");
    expect(text(list)).toBe("Dried and sealed");
  });
});
