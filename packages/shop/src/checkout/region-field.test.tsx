import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { DISTRICT_FALLBACK, type DeliveryField } from "../data/delivery-config";
import { NIGERIAN_STATES } from "../data/nigerian-states";
import { REGION_PLACEHOLDER, RegionField } from "./region-field";

const FIELD = DISTRICT_FALLBACK.fields.find((f) => f.key === "region") as DeliveryField;

function render(props: Partial<React.ComponentProps<typeof RegionField>> = {}) {
  return renderToStaticMarkup(
    <RegionField
      id="co-region"
      field={FIELD}
      countryCode="NG"
      value=""
      servedRegions={null}
      onChange={() => {}}
      {...props}
    />,
  );
}

const optionCount = (html: string) => (html.match(/<option/g) ?? []).length;
const selectedValue = (html: string) => /<select[^>]*>/.exec(html)?.[0] ?? "";

describe("for a Nigerian address", () => {
  it("is a required select of the 36 states, the FCT and a placeholder", () => {
    const html = render();
    expect(html).toContain("<select");
    expect(html).toContain("required");
    expect(optionCount(html)).toBe(NIGERIAN_STATES.length + 1);
    expect(html).toContain(REGION_PLACEHOLDER);
  });

  it("carries the canonical name as each option's value, and says Abuja where it helps", () => {
    const html = render();
    expect(html).toContain('value="Federal Capital Territory"');
    expect(html).toContain("Federal Capital Territory (Abuja)");
    expect(html).toContain('value="Lagos"');
  });

  it("shows a saved address's state however it was spelled", () => {
    // `renderToStaticMarkup` marks the chosen option `selected`, after `value`.
    expect(render({ value: "lagos state" })).toMatch(/<option value="Lagos" selected/);
    expect(render({ value: "Abuja" })).toMatch(
      /<option value="Federal Capital Territory" selected/,
    );
  });

  it("falls back to the placeholder for a state it cannot place, never a guess", () => {
    const html = render({ value: "Port Harcourt" });
    expect(html).toMatch(/<option value="" selected/);
    expect(html).not.toMatch(/<option value="[A-Z][^"]*" selected/);
  });

  it("keeps the field's own id and autocomplete so browser autofill still finds it", () => {
    const html = render();
    expect(selectedValue(html)).toContain('id="co-region"');
    expect(selectedValue(html)).toMatch(/autocomplete="address-level1"/i);
  });

  it("lists but disables a state the shop does not serve, and says so", () => {
    const html = render({ servedRegions: ["Lagos", "federal capital territory"] });
    expect(html).toContain('<option value="Lagos">Lagos</option>');
    expect(html).toContain('<option value="Kano" disabled="">Kano (not yet)</option>');
    expect(html).toContain(
      '<option value="Federal Capital Territory">Federal Capital Territory (Abuja)</option>',
    );
  });
});

describe("for an address anywhere else", () => {
  it("is the free-text input it always was", () => {
    const html = render({ countryCode: "GB", value: "Greater London" });
    expect(html).toContain("<input");
    expect(html).not.toContain("<select");
    expect(html).toContain('value="Greater London"');
    expect(html).toMatch(/maxlength="120"/i);
  });
});
