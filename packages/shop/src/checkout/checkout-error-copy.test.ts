import { describe, expect, it } from "vitest";
import { errorCopy, retryWaitLabel } from "./checkout-error-copy";

/**
 * The words a shopper reads when checkout refuses them.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY COPY IS ASSERTED VERBATIM HERE, WHICH IS NOT THIS SUITE'S HABIT.
 *
 * The copy IS the change. Every case below was, on the live site, the same
 * forty characters — "That didn't go through. Try again — if it keeps
 * happening, come back later." — and the point of the work is that the
 * sentences now differ from one another in ways a shopper can act on. A test
 * that only checked `title.length > 0` would have passed before the change
 * and after it, which makes it a test of nothing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("being told to wait when the store has stopped listening", () => {
  it("names the actual wait rather than repeating the advice that caused it", () => {
    /*
     * Ten `/checkout/start` calls per cart per fifteen minutes. A shopper
     * spends that budget by obeying "try again", so the one thing this copy
     * must not do is say it without a number attached.
     */
    expect(errorCopy({ code: "rate_limited", retryAfter: 720 })).toEqual({
      title: "Too many attempts",
      body: "Wait about 12 minutes, then try again. Nothing has been ordered and your cart is safe.",
    });
  });

  it("says 'a minute' rather than '1 minutes'", () => {
    expect(errorCopy({ code: "rate_limited", retryAfter: 45 }).body).toBe(
      "Wait about a minute, then try again. Nothing has been ordered and your cart is safe.",
    );
  });

  it("stays vague only when the API named no wait, never inventing a number", () => {
    expect(errorCopy({ code: "rate_limited", retryAfter: null }).body).toBe(
      "Wait a few minutes, then try again. Nothing has been ordered and your cart is safe.",
    );
  });
});

describe("retryWaitLabel", () => {
  it("rounds part-minutes up, because a wait that is not over yet is not over", () => {
    // 61s must not read as "about a minute" when the window has 61 seconds left.
    expect(retryWaitLabel(61)).toBe("about 2 minutes");
    expect(retryWaitLabel(60)).toBe("about a minute");
    expect(retryWaitLabel(1)).toBe("about a minute");
  });

  it("has a phrase for no number at all", () => {
    expect(retryWaitLabel(null)).toBe("a few minutes");
  });

  it("does not claim a wait is over when the API says zero", () => {
    expect(retryWaitLabel(0)).toBe("a few minutes");
  });
});

describe("a fault on the store's side", () => {
  it("says whose fault it is, because the shopper will otherwise assume it is theirs", () => {
    expect(errorCopy({ code: "server", status: 500, requestId: "req_1" })).toEqual({
      title: "The store is having a problem",
      body: "This is on our side, not yours. Your cart is safe — try again in a few minutes.",
    });
  });
});

describe("the refusal this client genuinely cannot name", () => {
  it("asks for the reference, when there is a reference to quote", () => {
    expect(errorCopy({ code: "unknown", status: 418, requestId: "req_c0ffee" })).toEqual({
      title: "That didn't go through",
      body: "Try again. If it keeps happening, send us the reference below and we'll find it in our logs.",
    });
  });

  it("does not point at a reference that will not be on the screen", () => {
    /*
     * THE FAILURE THIS PREVENTS IS A SMALL, HUMILIATING ONE: copy that says
     * "quote the reference below" under a banner with nothing below it. The
     * body and the rendered reference have to agree, so they are decided
     * together, here.
     */
    expect(errorCopy({ code: "unknown", status: 418, requestId: null })).toEqual({
      title: "That didn't go through",
      body: "Try again. If it keeps happening, get in touch and we'll look into it.",
    });
  });
});

describe("the copy that was already right, which must not drift", () => {
  it("keeps the empty-cart wording that this fix finally lets a shopper reach", () => {
    expect(errorCopy({ code: "empty_cart" })).toEqual({
      title: "Your cart is empty",
      body: "Add something to the cart before checking out.",
    });
  });

  it("keeps the expired-checkout wording", () => {
    expect(errorCopy({ code: "gone" }).title).toBe("This checkout has expired");
  });

  it("keeps the transport-failure wording distinct from a refusal", () => {
    expect(errorCopy({ code: "network" })).toEqual({
      title: "Couldn't reach the store",
      body: "Check your connection and try again.",
    });
  });
});
