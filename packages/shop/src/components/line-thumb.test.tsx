import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { LineThumb, LineThumbSkeleton, lineImageAlt } from "./line-thumb";
import type { LineImage, LineImageIndex } from "../data/catalog";
import type { OrderLine } from "../data/orders-api";

/**
 * WHAT THE MARKUP CLAIMS, WHICH IS THE ONLY THING THAT REACHES A CUSTOMER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * `catalog.test.ts` next door pins the RESOLUTION — what the index answers for
 * a variant. This pins the RENDERING, because the bug this pair of surfaces
 * keeps growing does not live in the data: it lives in the sentence the page
 * puts next to a picture. An `alt` naming a colour the photograph is not of is
 * invisible in a screenshot and invisible in a resolution test; it is only
 * visible in the bytes.
 *
 * Rendered through `react-dom/server` rather than jsdom, the same way
 * `doc-renderer.test.tsx` does, and for the same reason: no jsdom, no
 * testing-library, no second React in the tree.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const line: OrderLine = {
  id: "ln_1",
  lineNo: 1,
  variantId: "var_live",
  sku: "PLA-BLACK-175MM-1KG",
  title: "PLA Filament",
  optionValues: { Colour: "Black", Weight: "1 kg", Diameter: "1.75 mm" },
  qty: 1,
  unitAmount: 2300000,
  lineTotal: 2300000,
  fulfilledQty: 0,
};

const COVER: LineImage = {
  src: "/images/shop/img_cover",
  ofThisColour: false,
  colourHex: "#111111",
  weightGrams: 1000,
};

const OWN: LineImage = { ...COVER, src: "/images/shop/img_black", ofThisColour: true };
const DRAWN: LineImage = { ...COVER, src: null, ofThisColour: false };
/** In the catalogue, but carrying neither a photograph nor a `colorHex`. */
const HEXLESS: LineImage = { ...COVER, src: null, ofThisColour: false, colourHex: null };

const index = (image?: LineImage): LineImageIndex => (image ? { var_live: image } : {});

const render = (image: LineImage | undefined, decorative = true) =>
  renderToStaticMarkup(
    <LineThumb line={line} images={index(image)} decorative={decorative} size={48} />,
  );

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

describe("a line whose variant is not in the catalogue", () => {
  /*
   * The discontinued-product case, and the one an unreachable catalogue
   * produces for every line at once. Nothing about the goods is known, so
   * nothing about the goods may be drawn or said.
   */
  it("renders no photograph and no drawn spool", () => {
    showsNoGoods(render(undefined));
  });

  it("stands the shop's own mark in, and only the mark", () => {
    /* The placeholder is not empty — an empty tinted square read as a page
       that had failed to load. What it holds has to be the one image in this
       app that says nothing about any product. */
    const html = render(undefined);
    expect(html).toContain("logomark");
    expect(html).toContain("grayscale");
    expect(html.match(/<img\b/g) ?? []).toHaveLength(1);
  });

  it("claims no colour anywhere in the markup", () => {
    const html = render(undefined);
    // The line's own colour is right there on the fixture; a fallback that read
    // it would put "Black" or "#111111" into a box that shows neither.
    expect(html).not.toContain("Black");
    expect(html).not.toContain("#111111");
  });

  it("asserts no product appearance, even when the caller asked for a named thumbnail", () => {
    const html = render(undefined, false);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-label");
    expect(html).not.toContain("PLA Filament");
  });

  it("is visibly not a picture — dashed, tinted, and not the resolved treatment", () => {
    const absent = render(undefined);
    const present = render(COVER);
    expect(absent).toContain("border-dashed");
    expect(present).not.toContain("border-dashed");
  });
});

describe("a line that resolves to the product's cover", () => {
  /*
   * EVERY LINE IN THE SHOP TODAY. No live variant has its own photograph, so
   * this is the case an `alt` built from the line's colour would be wrong on —
   * on every row, for every customer.
   */
  it("never names the colour, because the picture is not of it", () => {
    const html = render(COVER, false);
    expect(html).toContain('alt="PLA Filament"');
    expect(html).not.toContain("Black");
  });

  it("is decorative by default, because the row states the line in text", () => {
    expect(render(COVER)).toContain('alt=""');
  });

  it("points at the cacheable same-origin proxy", () => {
    expect(render(COVER)).toContain('src="/images/shop/img_cover"');
  });
});

describe("a line that resolves to the variant's own photograph", () => {
  it("may name the colour, because the photograph is of it", () => {
    expect(render(OWN, false)).toContain('alt="PLA Filament, Black"');
  });
});

describe("a line the catalogue knows but nobody photographed", () => {
  it("draws the spool in the catalogue's own hex rather than showing nothing", () => {
    const html = render(DRAWN);
    expect(html).not.toContain("<img");
    expect(html).toContain("#111111");
  });

  it("may name the colour, because the drawing IS tinted to it", () => {
    expect(lineImageAlt(line, DRAWN)).toBe("PLA Filament, Black");
  });

  it("is not rendered the same as a variant the catalogue cannot describe", () => {
    /* The distinction the bar turns on: "this has no photograph" still knows a
       colour and draws it; "we cannot describe this at all" draws nothing. */
    expect(render(DRAWN)).not.toBe(render(undefined));
  });
});

describe("a catalogue entry with no photograph AND no colour", () => {
  /*
   * THE CASE THAT SHIPPED BROKEN. `colourHex` defaulted to the module grey and
   * the renderer inferred "we know the colour" from `src === null`, so this
   * entry drew a `#8a8a94` spool and captioned it with the line's own colour:
   * `aria-label="PLA Filament, Red"` and `<title>PLA Filament, Red</title>`
   * over a picture of grey. Asserting the HEX alone did not catch it — the hex
   * was the intended value — so these assert the NAME.
   */
  it("is named nothing, even when the caller asked for a named thumbnail", () => {
    expect(lineImageAlt(line, HEXLESS)).toBe("");

    const html = render(HEXLESS, false);
    expect(html).not.toContain("aria-label");
    expect(html).not.toContain("<title>");
    expect(html).not.toContain("Black");
  });

  it("draws no spool, because there is no colour to draw it in", () => {
    const html = render(HEXLESS);
    expect(html).not.toContain('viewBox="0 0 200 200"');
    expect(html).not.toContain("#8a8a94");
    expect(html).toContain("border-dashed");
  });

  it("renders exactly what an absent entry renders — the same fact, reached twice", () => {
    expect(render(HEXLESS)).toBe(render(undefined));
  });

  it("is still a photograph when the product HAS a cover, since the hex is then unread", () => {
    /* A null hex must not suppress a picture that exists. Only the pair
       (no photograph AND no hex) means nothing can be shown. */
    const html = render({ ...HEXLESS, src: "/images/shop/img_cover" }, false);
    expect(html).toContain('src="/images/shop/img_cover"');
    expect(html).toContain('alt="PLA Filament"');
    expect(html).not.toContain("Black");
  });
});

describe("the name, given what actually resolved", () => {
  it("is empty for a line with no catalogue entry, and only for that", () => {
    expect(lineImageAlt(line, undefined)).toBe("");
    expect(lineImageAlt(line, COVER)).not.toBe("");
  });

  it("falls back to the product alone when the line records no colour", () => {
    const noColour = { ...line, optionValues: { Weight: "1 kg" } };
    expect(lineImageAlt(noColour, OWN)).toBe("PLA Filament");
  });
});

/** The first `style="…"` in the markup — always the outer box. */
function outerStyle(html: string): string {
  return /style="([^"]*)"/.exec(html)?.[1] ?? "";
}

/** One px length out of an inline style string, or null if it is not px. */
function pxLength(style: string, prop: string): number | null {
  const value = new RegExp(`(?:^|;)${prop}:(-?[\\d.]+)px(?:;|$)`).exec(style)?.[1];
  return value === undefined ? null : Number(value);
}

/** The `border` utility. Not inline, so this number is an assumption of the
 *  test rather than something it can read; the browser measurement below is
 *  what confirms it. */
const BORDER_PX = 1;

describe("the box the picture actually gets", () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════
   * WHAT THIS TEST CANNOT SEE, AND WHERE THE PIXEL PROOF LIVES.
   *
   * `renderToStaticMarkup` produces a string. It has no layout, no cascade and
   * no containing block, so it cannot tell a length that resolves against the
   * ELEMENT from one that resolves against its PARENT — which is exactly the
   * distinction that broke this component. The inset was `p-[6%]`, and a
   * percentage padding resolves against the containing block's width: a 48px
   * thumbnail inside a 480px order row took 28.8px of padding a side, more than
   * the box is wide, and the picture rendered 0×0 inside a solid bordered
   * square. The suite was 246 tests green while that shipped, because the one
   * assertion here checked the OUTER box — which was correct throughout.
   *
   * So this asserts the two things about the emitted markup that DETERMINE the
   * inner box: that every length on the outer box is absolute (a `%` here is
   * the bug, whatever its value), and that what is left after the inset and the
   * border is a real fraction of `size`. It cannot prove the pixels.
   *
   * THE PIXELS WERE MEASURED IN CHROME against the running dev server, cloning
   * the rendered node into containers of 343 / 480 / 672 / 720px — the widths
   * `/account/orders` and `/account/orders/[orderNumber]` occupy from mobile to
   * a desktop `max-w-3xl` shell. Before: 4.8 / 0 / 0 / 0. After: 40 / 40 / 40 /
   * 40 at `size=48`, identical at every width, which is the property that
   * matters — the box must not know how wide the row is. Redo that measurement,
   * not just this file, if the inset changes.
   * ═══════════════════════════════════════════════════════════════════════
   */
  const sizes = [40, 48, 64, 96];

  it("expresses its inset with no percentage anywhere — inline style or class", () => {
    /* Both halves matter. The inline check bars a `%` written as a style; the
       class check bars the exact form this shipped as, `p-[6%]`, which is
       invisible to `outerStyle` because Tailwind puts it in the class list. */
    for (const size of sizes) {
      const html = renderToStaticMarkup(
        <LineThumb line={line} images={index(COVER)} size={size} />,
      );
      expect(outerStyle(html)).not.toContain("%");
      expect(html).not.toMatch(/\b[mp][trblxy]?-\[[^\]]*%[^\]]*\]/);
    }
  });

  it("leaves the picture most of the box rather than none of it", () => {
    for (const size of sizes) {
      const html = renderToStaticMarkup(
        <LineThumb line={line} images={index(COVER)} size={size} />,
      );
      const style = outerStyle(html);
      const inset = pxLength(style, "padding");

      expect(pxLength(style, "width")).toBe(size);
      expect(inset).not.toBeNull();
      // The whole failure was an inset big enough to swallow the box.
      const edge = size - 2 * (inset ?? 0) - 2 * BORDER_PX;
      expect(edge).toBeGreaterThanOrEqual(size * 0.7);
      expect(edge).toBeLessThan(size);
    }
  });

  it("scales the inset with `size`, so a 96px strip is not a 48px row with a hairline", () => {
    const at = (size: number) =>
      pxLength(
        outerStyle(renderToStaticMarkup(<LineThumb line={line} images={index(COVER)} size={size} />)),
        "padding",
      ) ?? 0;

    expect(at(96)).toBeGreaterThan(at(48));
  });

  it("hands the content box to the picture, photograph or drawing", () => {
    /* `w-full`/`h-full` is what turns the box above into the picture's box —
       `product-photo.tsx`'s own idiom. Without it the assertions above measure
       a box nothing fills. */
    const photo = render(COVER);
    expect(photo).toContain("w-full");
    expect(photo).toContain("h-full");
    expect(photo).toContain("object-contain");

    const drawing = render(DRAWN);
    expect(drawing).toContain("w-full");
  });
});

describe("the skeleton", () => {
  it("occupies the same box as the thumbnail it stands in for", () => {
    /* CLAUDE.md: a skeleton that reflows on resolve is worse than none. One
       `size` drives both, so this is a guard against someone giving the
       thumbnail padding or a width the placeholder does not have. */
    const box = /width:48px;height:48px/;
    expect(renderToStaticMarkup(<LineThumbSkeleton size={48} />)).toMatch(box);
    expect(render(COVER)).toMatch(box);
    expect(render(undefined)).toMatch(box);
  });
});
