import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnIntro } from "./return-intro";
import type { RewardsProgram } from "../data/marketing";

/**
 * Nouns nobody at PlaSpool would ever choose, on purpose.
 *
 * The live programme says "Spool Points"/"spools", so a component that
 * hardcoded either would still render correctly against a realistic fixture
 * and pass. Against "Bottle Caps"/"canisters" it cannot: every assertion below
 * is only satisfiable by a component that read `program`. This is the same
 * trick `return-form-gate.test.tsx` uses, for the same reason.
 */
const PROGRAM: RewardsProgram = {
  name: "Cap Returns",
  pointsLabelSingular: "Bottle Cap",
  pointsLabelPlural: "Bottle Caps",
  unitLabelSingular: "canister",
  unitLabelPlural: "canisters",
  minUnitsPerReturn: 4,
  pointsPerUnit: 7,
};

function render(program: RewardsProgram, dismissed = false) {
  return renderToStaticMarkup(
    <ReturnIntro
      program={program}
      dismissed={dismissed}
      onDismissedChange={() => {}}
      onNext={() => {}}
    />,
  );
}

it("leads with the slogan, which names no programme and so is ours to spell", () => {
  expect(render(PROGRAM)).toContain("Print. Return. Repeat.");
});

it("builds the offer out of the programme rather than remembering it", () => {
  const html = render(PROGRAM);
  expect(html).toContain("7 Bottle Caps");
  expect(html).toContain("canisters");
  expect(html).toContain("eligible canister");
});

it("agrees a count with its noun, so one point is not `1 Bottle Caps`", () => {
  // The live programme pays exactly this today (`pointsPerUnit: 1`), so the
  // plural-only version of this sentence would have been wrong in production
  // from the first deploy, not in some hypothetical future.
  const html = render({ ...PROGRAM, pointsPerUnit: 1 });
  expect(html).toContain("1 Bottle Cap ");
  expect(html).not.toContain("1 Bottle Caps");
});

it("labels the forward control with the programme's own points noun", () => {
  expect(render(PROGRAM)).toContain("Earn Bottle Caps");
});

it("offers a checkbox that reflects the choice already made", () => {
  expect(render(PROGRAM, false)).not.toContain("checked=");
  expect(render(PROGRAM, true)).toContain("checked=");
});

it("hides the spool band from assistive tech rather than narrating decoration", () => {
  // The band says nothing the copy underneath does not say in words, so it is
  // decoration. `SpoolImage` emits a `<title>` for every spool it is asked to
  // name; none should appear here.
  const html = render(PROGRAM);
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("<title>");
});
