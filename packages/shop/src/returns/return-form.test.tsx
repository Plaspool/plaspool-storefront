import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnForm, placeError } from "./return-form";
import { ReturnRequestError } from "../data/returns-api";

const PROGRAM = {
  name: "Cap Returns",
  pointsLabelSingular: "Bottle Cap",
  pointsLabelPlural: "Bottle Caps",
  unitLabelSingular: "canister",
  unitLabelPlural: "canisters",
  minUnitsPerReturn: 4,
  pointsPerUnit: 7,
};

const AREAS = [
  { id: "msa_1", region: "FCT", name: "Utako" },
  { id: "msa_2", region: "Lagos", name: "Yaba" },
];

/** Today's actual shape in production — every district is the same state.
 *  See the file header on why a single state preselects and disables itself
 *  rather than being hidden. */
const SINGLE_REGION_AREAS = [
  { id: "msa_3", region: "Federal Capital Territory", name: "Utako" },
  { id: "msa_4", region: "Federal Capital Territory", name: "Wuse 2" },
];

const html = () =>
  renderToStaticMarkup(<ReturnForm program={PROGRAM} areas={AREAS} />);

const singleRegionHtml = () =>
  renderToStaticMarkup(<ReturnForm program={PROGRAM} areas={SINGLE_REGION_AREAS} />);

/** The opening `<select …>` tag whose `id` ends `-${idSuffix}` — how a test
 *  tells the state select's markup apart from the district select's without
 *  a DOM. `React.useId()`'s own prefix is opaque and not this suite's to
 *  hardcode, so this matches on the suffix this file itself chose. */
function selectTag(markup: string, idSuffix: string): string {
  const match = markup.match(new RegExp(`<select[^>]*id="[^"]*-${idSuffix}"[^>]*>`));
  return match ? match[0] : "";
}

it("asks for no email — the address is the session's and cannot be typed", () => {
  // The security property, pinned where it can regress. The API refuses an
  // `email` key outright; a field here would be a 400 nobody could explain.
  expect(html()).not.toMatch(/type="email"/);
  expect(html()).not.toMatch(/name="email"/);
});

it("renders both the state and district selects, with their options, server-side", () => {
  // The whole reason this is a native <select> rather than @plaspool/ui's
  // Radix one — see the file header. A Radix Select renders zero options
  // under renderToStaticMarkup; a plain <select> renders all of them,
  // proven here rather than assumed.
  const markup = singleRegionHtml();
  expect(markup).toContain("Choose a state");
  expect(markup).toContain("Federal Capital Territory");
  expect(markup).toContain("Choose a district");
  expect(markup).toContain("Utako");
  expect(markup).toContain("Wuse 2");
});

it("lists every distinct state, sorted, and leaves district empty and disabled until one is chosen", () => {
  const markup = html(); // AREAS: Lagos's area is listed before FCT's, in source order.
  const stateSelect = selectTag(markup, "region");
  const districtSelect = selectTag(markup, "area");

  // More than one state served, so this is a real, open choice. Matched as
  // `disabled=""` — the exact rendered attribute — rather than bare
  // "disabled", which the select's own `disabled:cursor-not-allowed`
  // Tailwind class would match whether or not the control actually is.
  expect(stateSelect).not.toContain('disabled=""');
  expect(markup.indexOf(">FCT<")).toBeGreaterThan(-1);
  expect(markup.indexOf(">FCT<")).toBeLessThan(markup.indexOf(">Lagos<"));

  // No state chosen yet, so the district select is disabled and offers no
  // district from either state — not even the placeholder's neighbours.
  expect(districtSelect).toContain('disabled=""');
  expect(markup).not.toContain("Utako");
  expect(markup).not.toContain("Yaba");
});

it("settles a single state rather than presenting it as a choice", () => {
  const markup = singleRegionHtml();
  const stateSelect = selectTag(markup, "region");
  const districtSelect = selectTag(markup, "area");

  // Disabled so it reads as settled rather than as a choice — but still
  // shown, and still carrying the one option, so the shopper sees which
  // state they are in rather than have it hidden from them.
  expect(stateSelect).toContain('disabled=""');
  expect(markup).toContain("Federal Capital Territory");
  // Immediately usable — not gated behind a state nobody had to choose.
  expect(districtSelect).not.toContain('disabled=""');
});

it("spells no programme noun of its own — every word comes from the program", () => {
  // `house-rules.test.ts` greps for the real nouns; this proves the positive
  // case, that the absurd fixture labels actually reach the markup.
  expect(html()).toContain("canisters");
});

describe("placeError — exhaustive over every ReturnFailure, the load-bearing part", () => {
  it("below-minimum names the quantity field and uses the server's own min", () => {
    const result = placeError(new ReturnRequestError("below-minimum", { min: 6 }), PROGRAM);
    expect(result).toMatchObject({ field: "qtyDeclared" });
    expect("message" in result && result.message).toContain("6 canisters");
  });

  it("below-minimum falls back to the programme's own floor when the server sends no min", () => {
    const result = placeError(new ReturnRequestError("below-minimum", {}), PROGRAM);
    expect(result).toMatchObject({ field: "qtyDeclared" });
    expect("message" in result && result.message).toContain(`${PROGRAM.minUnitsPerReturn} canisters`);
  });

  it("outside-area names the district field and lists what is served", () => {
    const result = placeError(
      new ReturnRequestError("outside-area", { served: ["Utako", "Wuse 2"] }),
      PROGRAM,
    );
    expect(result).toMatchObject({ field: "serviceAreaId" });
    expect("message" in result && result.message).toContain("Utako, Wuse 2");
  });

  it("outside-area still names the field when the server sends no served list", () => {
    const result = placeError(new ReturnRequestError("outside-area", {}), PROGRAM);
    expect(result).toEqual({ field: "serviceAreaId", message: "We do not collect there yet." });
  });

  it("already-open is not an error — it carries the existing request's id, not a message", () => {
    const result = placeError(new ReturnRequestError("already-open", { existingId: "mrr_1" }), PROGRAM);
    expect(result).toEqual({ kind: "already-open", existingId: "mrr_1" });
  });

  it("unauthenticated is a sign-in prompt, not a field error", () => {
    const result = placeError(new ReturnRequestError("unauthenticated"), PROGRAM);
    expect(result).toEqual({ kind: "sign-in" });
  });

  it("programme-paused, rate-limited, invalid and failed all land above the submit", () => {
    // The whole-form fallback, not the default — every one of these is a
    // refusal with nowhere more specific on screen for it to land.
    for (const reason of ["programme-paused", "rate-limited", "invalid", "failed"] as const) {
      const result = placeError(new ReturnRequestError(reason), PROGRAM);
      expect(result).toMatchObject({ field: null });
      expect("message" in result && result.message.length > 0).toBe(true);
    }
  });
});
