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

const html = () =>
  renderToStaticMarkup(<ReturnForm program={PROGRAM} areas={AREAS} />);

it("asks for no email — the address is the session's and cannot be typed", () => {
  // The security property, pinned where it can regress. The API refuses an
  // `email` key outright; a field here would be a 400 nobody could explain.
  expect(html()).not.toMatch(/type="email"/);
  expect(html()).not.toMatch(/name="email"/);
});

it("groups the districts by region", () => {
  const markup = html();
  expect(markup).toContain("FCT");
  expect(markup).toContain("Lagos");
  expect(markup).toContain("Utako");
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
