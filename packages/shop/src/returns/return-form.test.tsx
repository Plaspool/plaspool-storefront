import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnForm } from "./return-form";

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
