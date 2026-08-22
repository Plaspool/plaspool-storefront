import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnFormGate } from "./return-form-gate";

const PROGRAM = {
  name: "Cap Returns",
  pointsLabelSingular: "Bottle Cap",
  pointsLabelPlural: "Bottle Caps",
  unitLabelSingular: "canister",
  unitLabelPlural: "canisters",
  minUnitsPerReturn: 4,
  pointsPerUnit: 7,
};

const AREAS = [{ id: "msa_1", region: "FCT", name: "Utako" }];

it("shows the form before the session read resolves — the unknown doctrine forbids withholding it", () => {
  // `renderToStaticMarkup` never runs effects, so `session` is exactly
  // "unknown" here — the render every visitor sees for the brief window
  // before `readShopSession()` answers, and the one an unreachable commerce
  // API leaves a guest on indefinitely. Withholding the form on THIS render
  // was Important 3's bug: a guest filled five fields in before ever being
  // told they needed to sign in.
  const html = renderToStaticMarkup(<ReturnFormGate program={PROGRAM} areas={AREAS} />);
  expect(html).toMatch(/<form/);
  expect(html).not.toContain("Sign in to send a return request.");
});
