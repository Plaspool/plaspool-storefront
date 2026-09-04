import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { QuantityStepper } from "../components/quantity-stepper";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRESSING PLUS ON A CART ROW USED TO DO NOTHING YOU COULD SEE.
 *
 * In the buy box the stepper's value is local state and moves on the click's
 * own frame. On a cart row it is the SERVER's `qty` — the basket lives in the
 * commerce API and an edit is a round trip — so the figure cannot move until
 * the response lands, and nothing on the control said a request was in flight.
 * For the length of that round trip it was indistinguishable from a dead
 * button, which is how a shopper presses plus four times and orders four more
 * than they meant to.
 *
 * Rendered through `react-dom/server`, no jsdom — the suite is
 * `environment: "node"` on purpose. This component takes props and no context,
 * so it renders standalone where the drawer around it cannot.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const idle = renderToStaticMarkup(
  <QuantityStepper value={3} onChange={() => {}} max={9} label="PLA Basic" />,
);
const busy = renderToStaticMarkup(
  <QuantityStepper value={3} onChange={() => {}} max={9} pending label="PLA Basic" />,
);

describe("the quantity stepper while a write is in flight", () => {
  it("shows the figure when nothing is happening", () => {
    expect(idle).toContain(">3<");
    expect(idle).not.toContain("animate-pulse");
  });

  /* A PLACEHOLDER, NOT THE OLD NUMBER DIMMED. Mid-write the quantity is
     genuinely unknown — the server may clamp it to what is left — so showing
     the previous figure faintly asserts something we are still finding out. */
  it("replaces the figure with a placeholder rather than dimming it", () => {
    expect(busy).toContain("animate-pulse");
    expect(busy).not.toContain(">3<");
  });

  /* Two presses in flight at once land in whatever order the network chose,
     and the second would be computed from a figure the first has replaced. */
  it("refuses further presses until the server answers", () => {
    const idleDisabled = (idle.match(/disabled=""/g) ?? []).length;
    const busyDisabled = (busy.match(/disabled=""/g) ?? []).length;
    expect(idleDisabled).toBe(0);
    expect(busyDisabled).toBe(2);
  });

  /* The label is the only thing a screen reader should get here; the bar is a
     rectangle and is announced by nothing. */
  it("keeps the spoken label and hides the bar from assistive tech", () => {
    expect(busy).toContain("Quantity of PLA Basic");
    expect(busy).toContain('aria-live="polite"');
    expect(busy).toMatch(/aria-hidden="true"[^>]*animate-pulse|animate-pulse[^>]*aria-hidden="true"/);
  });

  /* The buttons must not slide under a finger that is mid-press, so the
     figure's box is a fixed minimum whether it holds a number or a bar. */
  it("holds the figure's box so the buttons do not move", () => {
    expect(idle).toContain("min-w-[2.5rem]");
    expect(busy).toContain("min-w-[2.5rem]");
  });

  /* The bar stands in for a `text-sm` figure, so it must be a line box of that
     type — a `Skeleton` with no line box collapses to 0px. */
  it("sizes the bar to the line it stands in for", () => {
    expect(busy).toMatch(/animate-pulse[^"]*"[^>]*>\u00a0<|text-sm/);
    expect(busy).toContain("\u00a0");
  });

  /* The ceiling still applies while idle: at `max` the plus is already off. */
  it("still disables plus at the stock ceiling", () => {
    const atMax = renderToStaticMarkup(
      <QuantityStepper value={4} onChange={() => {}} max={4} label="PLA Basic" />,
    );
    expect((atMax.match(/disabled=""/g) ?? []).length).toBe(1);
  });
});
