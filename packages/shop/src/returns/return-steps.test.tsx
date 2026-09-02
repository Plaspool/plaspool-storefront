import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ReturnSteps, stepOnOpen } from "./return-steps";
import { INTRO_DISMISSED_KEY } from "./intro-dismissed";

const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

it("offers no way back from the first step, because there is nothing behind it", () => {
  const html = renderToStaticMarkup(<ReturnSteps step="intro" onSelect={() => {}} />);
  expect(html).not.toContain("Back");
});

it("offers a way back from the form", () => {
  const html = renderToStaticMarkup(<ReturnSteps step="form" onSelect={() => {}} />);
  expect(html).toContain("Back");
});

it("marks exactly one dot as the step being shown", () => {
  const html = renderToStaticMarkup(<ReturnSteps step="form" onSelect={() => {}} />);
  expect(occurrences(html, 'aria-current="step"')).toBe(1);
});

it("names every dot, because an 8px circle is not a label", () => {
  const html = renderToStaticMarkup(<ReturnSteps step="intro" onSelect={() => {}} />);
  expect(html).toContain("Step 1 of 2");
  expect(html).toContain("Step 2 of 2");
});

it("draws the dots as buttons, so the indicator is also the control", () => {
  // A `<div>` with an onClick would look identical and be unreachable by
  // keyboard. Two dots, plus no Back on the intro step, is two buttons.
  const html = renderToStaticMarkup(<ReturnSteps step="intro" onSelect={() => {}} />);
  expect(occurrences(html, "<button")).toBe(2);
});

it("is a step indicator, not a carousel", () => {
  // `aria-roledescription="carousel"` — which `FeaturedCarousel` correctly
  // uses — tells a screen reader to expect rotating content it can browse.
  // This is a two-step flow where the second step is a form that submits; the
  // wrong roledescription would promise a shopper the wrong thing.
  const html = renderToStaticMarkup(<ReturnSteps step="intro" onSelect={() => {}} />);
  expect(html).not.toContain("carousel");
});

describe("the step an open lands on", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  function withDismissed(dismissed: boolean) {
    const map = new Map<string, string>();
    if (dismissed) map.set(INTRO_DISMISSED_KEY, "1");
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: (k: string) => map.get(k) ?? null } as unknown as Storage,
      configurable: true,
      writable: true,
    });
  }

  it("is the explanation for a shopper who has not dismissed it", () => {
    withDismissed(false);
    expect(stepOnOpen()).toBe("intro");
  });

  it("is the form for a shopper who has", () => {
    // Asked at OPEN time, not at mount: the box may have been ticked in this
    // dialog's own last open, or in another tab, since this component mounted.
    withDismissed(true);
    expect(stepOnOpen()).toBe("form");
  });

  it("is the explanation where there is no storage to ask", () => {
    expect(stepOnOpen()).toBe("intro");
  });
});
