import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BOX_SURPRISE_LINE, BoxContents, boxItemLabel } from "./box-contents";

/**
 * The mystery-box reveal on the order page. `boxes` is from the merged admin
 * code — no delivered box existed to read live when this was written — so every
 * absent and partial case is pinned rather than assumed.
 */

const text = (html: string) => html.replace(/&#x27;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const render = (props: Parameters<typeof BoxContents>[0]) => renderToStaticMarkup(<BoxContents {...props} />);

const BOX_1 = {
  items: [
    { title: "PLA Basic", optionValues: { Color: "Black", Size: "1kg" } },
    { title: "PLA Silk", optionValues: {} },
  ],
};
const BOX_2 = { items: [{ title: "PETG", optionValues: { Colour: "Clear" } }] };

describe("BoxContents", () => {
  it("renders nothing on an ordinary line", () => {
    expect(render({ isBox: false, qty: 1 })).toBe("");
    expect(render({ isBox: false, boxes: [], qty: 1 })).toBe("");
    expect(render({ isBox: false, boxes: null, qty: 1 })).toBe("");
  });

  it("says the contents are a surprise before delivery, with no empty Inside", () => {
    for (const boxes of [undefined, null, []]) {
      const html = render({ isBox: true, boxes, qty: 1 });
      expect(text(html)).toBe(BOX_SURPRISE_LINE);
      expect(html).not.toContain("Inside");
    }
  });

  it("lists one delivered box without a Box heading", () => {
    const html = render({ isBox: true, boxes: [BOX_1], qty: 1 });
    expect(text(html)).toBe("Inside PLA Basic · Black · 1kg PLA Silk");
    expect(html).not.toContain("<a");
  });

  it("reveals even when the catalogue no longer knows the line is a box", () => {
    expect(text(render({ isBox: false, boxes: [BOX_1], qty: 1 }))).toContain("Inside");
  });

  it("numbers two boxes by position", () => {
    expect(text(render({ isBox: true, boxes: [BOX_1, BOX_2], qty: 2 }))).toBe(
      "Inside Box 1 PLA Basic · Black · 1kg PLA Silk Box 2 PETG · Clear",
    );
  });

  it("keeps the surprise line for boxes still on their way", () => {
    expect(text(render({ isBox: true, boxes: [BOX_2], qty: 2 }))).toBe(
      `Inside Box 1 PETG · Clear ${BOX_SURPRISE_LINE}`,
    );
  });
});

describe("boxItemLabel", () => {
  it("joins the title and option values, tolerating missing values", () => {
    expect(boxItemLabel({ title: "PLA", optionValues: { a: "Red", b: " " } })).toBe("PLA · Red");
    expect(boxItemLabel({ title: "PLA", optionValues: null })).toBe("PLA");
  });
});
