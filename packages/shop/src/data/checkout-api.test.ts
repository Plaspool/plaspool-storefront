import { afterEach, describe, expect, it, vi } from "vitest";
import { setCheckoutAddress, startCheckout, type Address } from "./checkout-api";

/**
 * What a checkout call answers when it does not answer a checkout.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BUG THESE EXIST TO PREVENT COMING BACK.
 *
 * `classify()` had no tests at all, and three refusals the API sends routinely
 * fell through its list to `{ code: "unknown" }` — which the checkout renders
 * as "That didn't go through. Try again — if it keeps happening, come back
 * later." A shopper hit this on the live site at step 1 of 4 with a full cart.
 *
 * Two of the three are worse than merely vague:
 *
 *   - `rate_limited` is advice that CAUSES the error. Ten `/checkout/start`
 *     calls per cart per 15 minutes (`CHECKOUT_START_LIMIT`) is a budget a
 *     shopper spends by taking "try again" literally, and the banner then
 *     says it again.
 *   - `precondition_failed` + `operation: "checkout_start"` is the admin's
 *     spelling of an EMPTY CART (`plaspool-admin` checkout routes), and this
 *     client only ever looked for `operation: "empty_cart"`. The one refusal
 *     with a perfectly good screenful of copy already written was the one
 *     that never reached it.
 *
 * The assertions below are about that fall-through. Every case here is a body
 * the API demonstrably sends, not a hypothetical.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** A `Response`-shaped stub. Only the parts `request` actually reads. */
function respond(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const ADDRESS: Address = {
  name: "Emmanuel Abah",
  line1: "OAU Quarters Maitama",
  city: "Abuja",
  region: "FCT",
  countryCode: "NG",
};

describe("a checkout refused because the shopper has tried too often", () => {
  it("names the wait instead of repeating the advice that caused it", async () => {
    /*
     * `{ error: 'rate_limited', retryAfter }` with a `Retry-After` header is
     * what `RateLimitedError` maps to for every shop route. `retryAfter` is
     * SECONDS until the window ends.
     */
    global.fetch = vi
      .fn()
      .mockResolvedValue(respond(429, { error: "rate_limited", retryAfter: 720 }));

    const result = await startCheckout();

    expect(result).toEqual({
      ok: false,
      error: { code: "rate_limited", retryAfter: 720 },
    });
  });

  it("survives a 429 that names no wait, because the copy must still work", async () => {
    // A proxy can synthesise a 429 with no body of ours at all.
    global.fetch = vi.fn().mockResolvedValue(respond(429, null));

    const result = await startCheckout();

    expect(result).toEqual({
      ok: false,
      error: { code: "rate_limited", retryAfter: null },
    });
  });
});

describe("an empty cart, in both of the admin's spellings", () => {
  it("reads `operation: checkout_start` as the empty cart it actually is", async () => {
    /*
     * THE MISMATCH THAT PRODUCED THE PRODUCTION BUG. `/checkout/start`
     * reports its `empty_cart` reason under `operation: 'checkout_start'` —
     * the name of the OPERATION, not of the reason — while `/checkout/freeze`
     * reports the same condition as `operation: 'empty_cart'`.
     */
    global.fetch = vi.fn().mockResolvedValue(
      respond(409, { error: "precondition_failed", operation: "checkout_start" }),
    );

    const result = await startCheckout();

    expect(result).toEqual({ ok: false, error: { code: "empty_cart" } });
  });

  it("still reads `operation: empty_cart`, which other routes send", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      respond(409, { error: "precondition_failed", operation: "empty_cart" }),
    );

    const result = await startCheckout();

    expect(result).toEqual({ ok: false, error: { code: "empty_cart" } });
  });
});

describe("a refusal this client has no specific copy for", () => {
  it("separates a fault on the store's side from one it cannot name", async () => {
    /*
     * 5xx is the one case where "try again" is honest advice and the shopper
     * did nothing wrong — so it must not share a screen with the refusals
     * they could act on.
     */
    global.fetch = vi
      .fn()
      .mockResolvedValue(respond(500, { error: "internal", requestId: "req_7f3a91" }));

    const result = await startCheckout();

    expect(result).toEqual({
      ok: false,
      error: { code: "server", status: 500, requestId: "req_7f3a91" },
    });
  });

  it("keeps the requestId the API already sends, so the shopper can quote it", async () => {
    /*
     * EVERY error body the admin produces carries `requestId`, and every error
     * response repeats it as `x-request-id` — logged beside the detail that is
     * deliberately kept out of the response. It is the only thing that turns
     * "it didn't work" into a line somebody can find. This client threw it
     * away.
     */
    global.fetch = vi
      .fn()
      .mockResolvedValue(respond(418, { error: "teapot", requestId: "req_c0ffee" }));

    const result = await setCheckoutAddress(ADDRESS, 3);

    expect(result).toEqual({
      ok: false,
      error: { code: "unknown", status: 418, detail: undefined, requestId: "req_c0ffee" },
    });
  });

  it("does not invent a requestId when the API sent none", async () => {
    global.fetch = vi.fn().mockResolvedValue(respond(418, { error: "teapot" }));

    const result = await setCheckoutAddress(ADDRESS, 3);

    expect(result).toEqual({
      ok: false,
      error: { code: "unknown", status: 418, detail: undefined, requestId: null },
    });
  });
});

describe("the refusals that already had copy, which must keep it", () => {
  it("still reads 410 as gone", async () => {
    global.fetch = vi.fn().mockResolvedValue(respond(410, {}));

    const result = await startCheckout();

    expect(result).toEqual({ ok: false, error: { code: "gone" } });
  });

  it("still reads insufficient_stock, with the numbers that make it actionable", async () => {
    const shortfalls = [{ variantId: "var_1", requested: 4, available: 3 }];
    global.fetch = vi
      .fn()
      .mockResolvedValue(respond(409, { error: "insufficient_stock", shortfalls }));

    const result = await startCheckout();

    expect(result).toEqual({
      ok: false,
      error: { code: "insufficient_stock", shortfalls },
    });
  });

  it("still reads a transport failure as network, never as a refusal", async () => {
    // The distinction `cart-api` learned the hard way: nothing was reached, so
    // nothing about the cart is known to have changed.
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await startCheckout();

    expect(result).toEqual({ ok: false, error: { code: "network" } });
  });
});
