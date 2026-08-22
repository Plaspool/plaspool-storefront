import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnsCta, isOwnEntry } from "./returns-cta";

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

describe("isOwnEntry — the disambiguation the double-open fix rests on", () => {
  /*
   * `/store` mounts a `ReturnsCta` in `AnnouncementBar` AND one in
   * `RewardsBand` at once, and each gets its OWN `React.useId()` tag. This is
   * the one piece of that fix reachable without a DOM: it proves two
   * instances' tags can never both answer `true` for the same pushed state,
   * which is what stops Forward from reopening both dialogs at once — see the
   * file header for the full trace.
   */
  it("answers true only for the exact tag that pushed the entry", () => {
    expect(isOwnEntry({ returnsModal: "bar-tag" }, "bar-tag")).toBe(true);
    expect(isOwnEntry({ returnsModal: "bar-tag" }, "band-tag")).toBe(false);
  });

  it("two mounted instances' tags never both match one shared push", () => {
    // Simulates the exact `/store` case: the bar's click pushed this entry,
    // tagged with ITS OWN id. The band's instance, mounted at the same time
    // with a DIFFERENT id, must not also see itself as the owner.
    const pushedByTheBar = { returnsModal: "id-from-the-bar" };
    expect(isOwnEntry(pushedByTheBar, "id-from-the-bar")).toBe(true);
    expect(isOwnEntry(pushedByTheBar, "id-from-the-band")).toBe(false);
  });

  it("a state with no tag, or shaped like the old shared boolean, matches nothing", () => {
    expect(isOwnEntry(null, "id-from-the-bar")).toBe(false);
    expect(isOwnEntry({}, "id-from-the-bar")).toBe(false);
    // The pre-fix shape, in case any entry pushed before this shipped is
    // still sitting in a shopper's history.
    expect(isOwnEntry({ returnsModal: true }, "id-from-the-bar")).toBe(false);
  });
});
