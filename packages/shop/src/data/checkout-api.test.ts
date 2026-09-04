import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelCheckout,
  setCheckoutAddress,
  startCheckout,
  type Address,
} from "./checkout-api";

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

describe("a checkout that was actually PAID, refused for reopening", () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THE FALL-THROUGH THIS BLOCK EXISTS TO STOP, WHICH IS THE WORST ONE HERE.
   *
   * A capture whose inline completion failed leaves a genuinely PAID cart
   * sitting at `converting`, indistinguishable from a stuck one. The admin
   * refuses to reopen it with `operation: "checkout_paid"` — and this client
   * read neither `checkout_paid` spelling, so it fell past both branches of
   * `precondition_failed` to `{ code: "unknown" }`.
   *
   * `unknown` renders as "That didn't go through. Try again." — told to
   * somebody whose card HAS been charged, next to a control that invites them
   * to charge it again. It is the same fall-through `checkout_start` had, with
   * money on the other end of it.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it("reads `reason: checkout_paid` rather than falling through to unknown", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      respond(409, { error: "precondition_failed", reason: "checkout_paid" }),
    );

    const result = await cancelCheckout();

    expect(result).toEqual({ ok: false, error: { code: "checkout_paid" } });
  });

  it("reads the `operation` spelling too, so a rollback of the API still works", async () => {
    /* The rule `classify()`'s own comment sets out: `reason` is the
       unambiguous field and is read first, but a storefront that only works
       against the newest deploy of its backend breaks on every rollback. */
    global.fetch = vi.fn().mockResolvedValue(
      respond(409, { error: "precondition_failed", operation: "checkout_paid" }),
    );

    const result = await cancelCheckout();

    expect(result).toEqual({ ok: false, error: { code: "checkout_paid" } });
  });

  it("prefers `reason` over `operation` when the two disagree", async () => {
    /* Pins the precedence the existing branch already implements, now that a
       third code depends on it. `operation` legitimately carries the OPERATION
       on most admin routes, so a cancel that was refused for a paid checkout
       can arrive as operation: "cancel_checkout" with the real cause in
       `reason`. */
    global.fetch = vi.fn().mockResolvedValue(
      respond(409, {
        error: "precondition_failed",
        reason: "checkout_paid",
        operation: "cancel_checkout",
      }),
    );

    const result = await cancelCheckout();

    expect(result).toEqual({ ok: false, error: { code: "checkout_paid" } });
  });
});

describe("cancelling a frozen checkout so the shopper can edit it again", () => {
  /*
   * The transition this whole change exists for. A cart that reached
   * `converting` could never go back to `open`, so a shopper who was sent to
   * Paystack and did not pay got `409 precondition_failed` from every later
   * address or shipping edit, permanently, and the cart cookie kept resolving
   * to the same dead basket.
   */
  it("posts to the cancel route and answers the reopened cart", async () => {
    const cart = { id: "cart_1", status: "open", revision: 10, currency: "NGN" };
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { cart }));
    global.fetch = fetchMock;

    const result = await cancelCheckout();

    expect(result).toEqual({ ok: true, data: { cart } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/shop\/checkout\/cancel$/);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("sends no body at all when no baseRevision is offered", async () => {
    /* The whole body is optional, and an omitted `baseRevision` is what makes
       this safe to fire from an unload handler that has no fresh revision to
       read. Sending `{}` instead would also work, but `request()` only sets
       the JSON content-type when there IS a body — so an empty object would
       start declaring a content-type for no reason. */
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { cart: { id: "c", status: "open", revision: 3, currency: "NGN" } }));
    global.fetch = fetchMock;

    await cancelCheckout();

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("sends baseRevision when the caller has one, for the stale-write check", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { cart: { id: "c", status: "open", revision: 9, currency: "NGN" } }));
    global.fetch = fetchMock;

    await cancelCheckout(9);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ baseRevision: 9 });
  });

  it("still sends baseRevision 0, which is a real revision and not an absence", async () => {
    /* `if (baseRevision)` would drop this one. A cart's first revision is a
       legitimate value to guard a write against. */
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { cart: { id: "c", status: "open", revision: 0, currency: "NGN" } }));
    global.fetch = fetchMock;

    await cancelCheckout(0);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ baseRevision: 0 });
  });

  it("surfaces the rate limit rather than hiding it, since it has its own bucket", async () => {
    /* 10 per cart per 15 minutes, on a bucket of its own. Over-calling cancel
       is safe; pretending a 429 did not happen is not. */
    global.fetch = vi
      .fn()
      .mockResolvedValue(respond(429, { error: "rate_limited", retryAfter: 300 }));

    const result = await cancelCheckout();

    expect(result).toEqual({ ok: false, error: { code: "rate_limited", retryAfter: 300 } });
  });

  it("reads a 501 as the store's fault, not the shopper's", async () => {
    /* `not_implemented` is a deployment fault — the storefront is talking to
       an admin that predates this route. The shopper did nothing, so it must
       not read as a refusal of anything they did. */
    global.fetch = vi.fn().mockResolvedValue(respond(501, { error: "not_implemented" }));

    const result = await cancelCheckout();

    expect(result).toEqual({
      ok: false,
      error: { code: "server", status: 501, requestId: null },
    });
  });

  it("can outlive the document, which is the only way a closed tab is covered", async () => {
    /* The API'''s implicit thaw (addresses/shipping unfreeze before writing)
       cannot see a closed tab, because no request is ever made. An ordinary
       fetch is cancelled with the page that started it, so the unload path
       needs `keepalive` — and it still needs this module'''s `credentials:
       "include"`, because the call is worthless without the cart cookie. */
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { cart: { id: "c", status: "open", revision: 4, currency: "NGN" } }));
    global.fetch = fetchMock;

    await cancelCheckout(undefined, { keepalive: true });

    const init = fetchMock.mock.calls[0][1];
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("include");
  });

  it("does not set keepalive for an ordinary call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { cart: { id: "c", status: "open", revision: 4, currency: "NGN" } }));
    global.fetch = fetchMock;

    await cancelCheckout();

    expect(fetchMock.mock.calls[0][1].keepalive).toBeUndefined();
  });

  it("reads a missing cart cookie as gone", async () => {
    global.fetch = vi.fn().mockResolvedValue(respond(404, { error: "gone" }));

    const result = await cancelCheckout();

    expect(result).toEqual({ ok: false, error: { code: "gone" } });
  });
});
