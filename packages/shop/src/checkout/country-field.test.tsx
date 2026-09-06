import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DISTRICT_FALLBACK, type DeliveryConfig } from "../data/delivery-config";
import { CountryField, isCountryServed } from "./country-field";

/**
 * Rendered through `react-dom/server`, so these are the SERVER render — the
 * one before hydration, where the full list is deliberately absent (see the
 * component's header). The tests say so where it matters.
 */

const OPEN: DeliveryConfig = {
  ...DISTRICT_FALLBACK,
  country: { default: "NG", allowed: ["NG", "GB"], locked: false },
};

/** The markup, with the apostrophes React escapes (`&#x27;`) put back so the
 *  sentences can be asserted as written. */
function render(props: Partial<React.ComponentProps<typeof CountryField>> = {}) {
  return renderToStaticMarkup(
    <CountryField config={DISTRICT_FALLBACK} value="NG" onChange={() => {}} {...props} />,
  ).replace(/&#x27;/g, "'");
}

describe("the select", () => {
  it("is a real, required select even while the server locks the country", () => {
    const html = render();
    expect(html).toContain("<select");
    expect(html).toContain("required");
    expect(html).toContain('id="checkout-country"');
  });

  it("heads the list with the countries the shop delivers to, by name", () => {
    const html = render({ config: OPEN });
    expect(html).toContain('<optgroup label="We deliver to">');
    expect(html).toMatch(/<option[^>]*value="NG"[^>]*>Nigeria</);
    expect(html).toMatch(/<option[^>]*value="GB"[^>]*>United Kingdom</);
  });

  it("renders only the current choice before hydration, never the full list", () => {
    // 249 names from the server's ICU against the browser's is a hydration
    // mismatch waiting to happen; the rest of the list arrives client-side.
    const html = render();
    expect((html.match(/<option/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Everywhere else");
  });

  it("still shows an unserved current value so the control is never blank", () => {
    const html = render({ value: "GB" });
    expect(html).toMatch(/<option[^>]*value="GB"[^>]*>United Kingdom</);
    expect(html).toContain("Everywhere else");
  });
});

describe("the sentence under it", () => {
  it("says nothing when the shopper chose a served country themselves", () => {
    const html = render();
    expect(html).not.toContain("We set this");
    expect(html).not.toContain("don't deliver");
  });

  it("says where the preselection came from, and that it can be changed", () => {
    expect(render({ hint: "ip" })).toContain("We set this to Nigeria from your connection");
    expect(render({ hint: "gps" })).toContain("We set this to Nigeria from your location");
  });

  it("names the countries the shop does reach when an unserved one is chosen", () => {
    const html = render({ value: "GB", hint: "ip" });
    expect(html).toContain("We don't deliver to United Kingdom yet");
    expect(html).toContain("only to Nigeria");
    expect(html).toContain('aria-invalid="true"');
    // The hint is beside the point once the choice cannot be submitted.
    expect(html).not.toContain("We set this");
  });

  it("lists several served countries as a sentence", () => {
    const html = render({
      config: { ...OPEN, country: { ...OPEN.country, allowed: ["NG", "GB", "GH"] } },
      value: "US",
    });
    expect(html).toContain("only to Nigeria, United Kingdom and Ghana");
  });
});

describe("the gate the submit reads", () => {
  it("is the server's allowed list, case-insensitively", () => {
    expect(isCountryServed(DISTRICT_FALLBACK, "NG")).toBe(true);
    expect(isCountryServed(DISTRICT_FALLBACK, "ng")).toBe(true);
    expect(isCountryServed(DISTRICT_FALLBACK, "GB")).toBe(false);
    expect(isCountryServed(OPEN, "GB")).toBe(true);
  });

  it("reads an empty country as the config's default, as the payload does", () => {
    expect(isCountryServed(DISTRICT_FALLBACK, "")).toBe(true);
  });
});
