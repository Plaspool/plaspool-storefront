import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Colour } from "../data/types";
import { ColourSwatches } from "./colour-swatches";

const colours: Colour[] = [
  { id: "clear", name: "Clear", hex: "#eeeeee", inStock: false, imageUrl: null },
  { id: "grey", name: "Light Grey", hex: "#bbbbbb", inStock: false, imageUrl: null },
];

describe("ColourSwatches", () => {
  it("lets an out-of-stock disc be chosen so the picker is not a row of dead buttons", () => {
    const html = renderToStaticMarkup(
      <ColourSwatches colours={colours} selectedId="clear" onSelect={() => {}} />,
    );
    expect(html).toContain("Clear, out of stock");
    expect(html).toContain("Light Grey, out of stock");
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain("cursor-not-allowed");
  });

  it("still names a struck disc in the static card row", () => {
    const html = renderToStaticMarkup(<ColourSwatches colours={colours} />);
    expect(html).toContain("Clear, out of stock");
    expect(html).toContain("aria-disabled");
  });
});
