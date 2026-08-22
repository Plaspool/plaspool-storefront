import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnsSkeleton, ReturnsView, stageOf } from "./returns-page";
import type { MyReturn } from "../data/returns-api";
import type { RewardsProgram } from "../data/marketing";

/**
 * DELIBERATELY DECOY NOUNS, the same move `returns-cta.test.tsx` makes: if the
 * award line ever renders "Spool Points" instead of what THIS fixture's
 * programme calls it, that is this file hardcoding the real programme's word
 * rather than reading `program` — exactly the defect `house-rules.test.ts`'s
 * "no points or unit noun" check exists to catch at the source level. This is
 * the render-level twin of that check.
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

const CREATED = 1_763_208_000_000; // 15 Nov 2025, a literal — never `Date.now()`.

function myReturn(over: Partial<MyReturn> = {}): MyReturn {
  return {
    id: "ret_test",
    status: "requested",
    qtyDeclared: 5,
    qtyAccepted: null,
    pointsAwarded: null,
    pickupScheduledAt: null,
    driverName: null,
    createdAt: CREATED,
    ...over,
  };
}

function render(program: RewardsProgram | null, items: MyReturn[] | null): string {
  return renderToStaticMarkup(<ReturnsView program={program} items={items} />);
}

it("names every status the API can send, including the closed ones", () => {
  // A status with no case renders an empty stage, which reads as a bug on a
  // page whose entire job is telling somebody where their spools are.
  for (const status of ["requested", "scheduled", "collected", "received",
                        "awarded", "rejected", "cancelled"]) {
    expect(stageOf(status)).toBeTruthy();
  }
});

it("falls back rather than blanking on a status it has never heard of", () => {
  expect(stageOf("teleported")).toBeTruthy();
});

it("shows the stage and the declared figure on every card", () => {
  const html = render(PROGRAM, [myReturn({ status: "collected", qtyDeclared: 9 })]);
  expect(html).toContain(stageOf("collected"));
  expect(html).toContain("9 declared");
});

it("shows the pickup time and driver only once a pickup is scheduled", () => {
  const noPickup = render(PROGRAM, [myReturn()]);
  expect(noPickup).not.toContain("Pickup");

  const withDriver = render(PROGRAM, [
    myReturn({ status: "scheduled", pickupScheduledAt: CREATED, driverName: "Ade Bello" }),
  ]);
  expect(withDriver).toContain("Pickup");
  expect(withDriver).toContain("Ade Bello");

  // A pickup can be scheduled before a driver is assigned to it.
  const noDriverYet = render(PROGRAM, [
    myReturn({ status: "scheduled", pickupScheduledAt: CREATED, driverName: null }),
  ]);
  expect(noDriverYet).toContain("Pickup");
  expect(noDriverYet).not.toContain("Ade Bello");
});

it("builds the award from the programme's own words, singular and plural alike", () => {
  const one = render(PROGRAM, [myReturn({ status: "awarded", pointsAwarded: 1 })]);
  expect(one).toContain("1 Bottle Cap");
  expect(one).not.toContain("1 Bottle Caps");

  const many = render(PROGRAM, [myReturn({ status: "awarded", pointsAwarded: 28 })]);
  expect(many).toContain("28 Bottle Caps");
});

it("renders no award line for a return that has not been awarded anything", () => {
  const html = render(PROGRAM, [myReturn({ status: "requested" })]);
  expect(html).not.toContain("Bottle Cap");
});

it("omits the award line rather than printing a bare number when the programme can't be read", () => {
  // `RewardsBalance`'s own rule: a number with no noun is unreadable rather
  // than partially useful, so this hides the line entirely rather than
  // printing a naked "28" nobody can put a unit to.
  const html = render(null, [myReturn({ status: "awarded", pointsAwarded: 28 })]);
  expect(html).not.toContain("28");
});

it("falls back to the empty state, linking to /returns, when there are no returns yet", () => {
  const html = render(PROGRAM, []);
  expect(html).toMatch(/<a[^>]+href="\/returns"/);
  expect(html).toContain("Request a pickup");
});

it("says the read failed rather than claiming there are none, when it could not load", () => {
  // The bug this pinned: `listMyReturns()` answers `null` for every failure —
  // CORS, a stray 401, a network error — and collapsing that to `[]` printed
  // "Nothing sent back yet" over a request the page never actually read.
  const html = render(PROGRAM, null);
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("Nothing sent back yet");
  expect(html).not.toContain("Request a pickup");
});

it("titles the page from the programme, falling back to the API's own word for the feature", () => {
  expect(render(PROGRAM, [])).toContain("Cap Returns");
  expect(render(null, [])).toContain("Returns");
});

it("draws the title and the cards' own boxes while it waits, and marks the region busy", () => {
  const html = renderToStaticMarkup(<ReturnsSkeleton title="Cap Returns" />);
  expect(html).toContain("Cap Returns");
  expect(html).toContain('aria-busy="true"');
  // Three placeholder cards, each hidden from assistive tech individually —
  // the region's `aria-busy` announces the wait once, for all of them.
  expect((html.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(3);
});
