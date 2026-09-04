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

describe("a district we don't reach, in a shop that may not ask for districts", () => {
  /*
   * ═══ MERGED IN FROM THE SERVER-DESCRIBED ADDRESS FORM ═══
   * The two changes landed on the same function from different branches: one
   * moved it here and added rate_limited/server, the other gave it an
   * AddressMode so this case could stop naming a control the shopper was never
   * shown. Both are wanted, so `mode` came with it — and these two tests are
   * what prove the merge did not quietly drop the second one.
   *
   * The handler stays in BOTH modes: the server can still refuse under
   * `simple` (servedRegions is the documented way), and this is the only thing
   * that tells the shopper why. Only the wording moves.
   */
  it("names the district picker when there is a district picker", () => {
    expect(errorCopy({ code: "outside_delivery_area" }, "district")).toEqual({
      title: "We don't deliver to that district yet",
      body: "Pick a different district — or leave the district blank to use your state's standard delivery.",
    });
  });

  it("never names a district to a shopper who was never shown one", () => {
    const copy = errorCopy({ code: "outside_delivery_area" }, "simple");
    expect(copy).toEqual({
      title: "We don't deliver to that address yet",
      body: "Check the state and town are right. If they are, we don't reach there yet — contact us and we'll see what we can do.",
    });
    expect(copy.body).not.toMatch(/district/i);
  });

  it("defaults to the district wording, so an un-passed mode cannot silently change copy", () => {
    expect(errorCopy({ code: "outside_delivery_area" })).toEqual(
      errorCopy({ code: "outside_delivery_area" }, "district"),
    );
  });
});

describe("a checkout refused because the money was already taken", () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THE ONE PIECE OF COPY ON THIS SCREEN THAT COULD COST A SECOND CHARGE.
   *
   * `checkout_paid` means a capture succeeded and its inline completion did
   * not — the cart is stuck at `converting` but the card HAS been charged and
   * an order is being created from it. Before this, the code fell through to
   * `unknown`, whose body is "Try again." Told to a shopper whose money is
   * gone, beside a Pay button, that is an instruction to pay twice.
   *
   * So this case owes three things the default cannot give it: it must say the
   * payment worked, it must NOT say "try again", and it must point AWAY from
   * the basket — the basket is where a second attempt starts.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it("tells the shopper their payment went through, not that it failed", () => {
    const copy = errorCopy({ code: "checkout_paid" });

    expect(copy.title).toBe("Your payment went through");
    expect(copy.body).toBe(
      "This order is already paid and we're finishing it now. Check your orders for the confirmation — don't pay again.",
    );
  });

  it("never tells them to try again, which is what the default would have said", () => {
    const copy = errorCopy({ code: "checkout_paid" });

    expect(copy.body).not.toMatch(/try again/i);
    expect(copy.title).not.toMatch(/didn't go through/i);
  });

  it("never sends them back to the basket, which is where a second charge starts", () => {
    const copy = errorCopy({ code: "checkout_paid" });

    expect(`${copy.title} ${copy.body}`).not.toMatch(/cart|basket/i);
  });

  it("is not reachable from the unknown fall-through any more", () => {
    /* The regression guard proper: if the variant is ever dropped from
       `CheckoutError`, this stops matching the switch case and inherits the
       default's wording — which is exactly the bug. */
    expect(errorCopy({ code: "checkout_paid" })).not.toEqual(
      errorCopy({ code: "unknown", status: 409, requestId: null }),
    );
  });
});

describe("an address outside the region the shop serves at all", () => {
  /*
   * `outside_service_region` is the simple-delivery-mode refusal, and the
   * admin deliberately gave it a DIFFERENT code from `outside_delivery_area`
   * because under `simple` there is no district list to name. It was falling
   * through to `unknown` — "That didn't go through. Try again." — for an
   * address that will be refused every single time it is retried.
   */
  it("says we don't reach there, rather than that something went wrong", () => {
    const copy = errorCopy({ code: "outside_service_region" });

    expect(copy.title).toBe("We don't deliver to that area yet");
    expect(copy.body).toBe(
      "We don't reach that part of the country yet. Try a different delivery address, or contact us and we'll see what we can do.",
    );
  });

  it("never names a district, because this mode never showed one", () => {
    expect(errorCopy({ code: "outside_service_region" }).body).not.toMatch(/district/i);
    expect(errorCopy({ code: "outside_service_region" }, "simple").body).not.toMatch(/district/i);
  });

  it("never says try again, because retrying the same address cannot work", () => {
    expect(errorCopy({ code: "outside_service_region" }).body).not.toMatch(/try again/i);
  });

  it("stays distinct from outside_delivery_area, which is a different refusal", () => {
    /* Same shape of problem, different cause: one is a district switched off,
       the other is a region the shop does not serve. Collapsing them would
       tell a `simple`-mode shopper to change a district they were never
       shown. */
    expect(errorCopy({ code: "outside_service_region" })).not.toEqual(
      errorCopy({ code: "outside_delivery_area" }, "simple"),
    );
  });
});
