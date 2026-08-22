import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnsCta } from "./returns-cta";

const PROGRAM = {
  name: "Cap Returns",
  pointsLabelSingular: "Bottle Cap", pointsLabelPlural: "Bottle Caps",
  unitLabelSingular: "canister", unitLabelPlural: "canisters",
  minUnitsPerReturn: 4, pointsPerUnit: 7,
};

it("server-renders a real anchor to /returns, so the no-JS path is a navigation", () => {
  /*
   * THE WHOLE INTERCEPTION CONTRACT, PINNED. The dialog is progressive
   * enhancement over a link; if this ever renders a <button>, a shopper without
   * JavaScript — or with the bundle still loading — gets a dead control instead
   * of the page that does the same job.
   */
  const html = renderToStaticMarkup(
    <ReturnsCta program={PROGRAM} areas={[]} label="Send spools back" />,
  );
  expect(html).toMatch(/<a[^>]+href="\/returns"/);
  expect(html).toContain("Send spools back");
});
