import { afterEach, describe, expect, it, vi } from "vitest";
import { addLine, readCart, removeLine } from "./cart-api";

/**
 * What a cart call answers when it does not answer a cart.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BUG THESE EXIST TO PREVENT COMING BACK.
 *
 * Every failure used to collapse to `null` — a timeout and a refusal were the
 * same value. The provider correctly keeps the basket on screen when the
 * network drops, because clearing it looks exactly like a customer's cart being
 * thrown away; but with one value for both, it also kept the basket on screen
 * when the server said that cart had become an order. The result in production
 * was a dead basket with a Remove button that did nothing, silently, forever
 * (`Plaspool/plaspool-admin#38`).
 *
 * So the assertions below are all about the DISTINCTION, not about the happy
 * path: transport failure, "there is no cart", and "the server declined this"
 * must never again be indistinguishable to the caller.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

/** A `Response`-shaped stub. Only the parts `call` actually reads. */
function respond(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const EMPTY_VIEW = { cart: null, lines: [], preview: null, changes: [] };
const CART = { id: "crt_1", currency: "NGN", status: "open", revision: 3 };

describe("a cart call that cannot reach the API", () => {
  it("answers `offline`, which the provider is required to treat as 'keep what you have'", async () => {
    // `fetch` rejects for transport failures and for nothing else — offline,
    // DNS, a CORS preflight that never completed.
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await readCart();
    expect(result).toEqual({ ok: false, reason: "offline" });
  });
});

describe("a cart the server says is not there", () => {
  it("reads 404 as `gone` rather than as an error to show anyone", async () => {
    /*
     * Three situations arrive as 404 and all three mean the same thing to a
     * shopper: this browser has no basket. It never had one, it expired, or —
     * the case that produced the bug — the one it had became an order and the
     * API retired the cookie naming it.
     */
    global.fetch = vi.fn().mockResolvedValue(respond(404));

    expect(await removeLine("line_1")).toEqual({ ok: false, reason: "gone" });
  });
});

describe("a cart write the server declines", () => {
  it("distinguishes a refusal from a transport failure, and keeps the status", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(respond(409, { error: "precondition_failed", operation: "remove_line" }));

    const result = await removeLine("line_1");
    expect(result.ok).toBe(false);
    // The whole point: NOT `offline`, so the provider resyncs instead of
    // leaving a stale basket on screen.
    expect(result).toMatchObject({ reason: "refused", status: 409 });
  });

  it("carries the API's own detail when it sent one", async () => {
    global.fetch = vi.fn().mockResolvedValue(respond(400, { detail: "baseRevision" }));

    expect(await removeLine("line_1")).toMatchObject({
      reason: "refused",
      status: 400,
      detail: "baseRevision",
    });
  });

  it("treats a 200 that is not a cart as a refusal, not as offline", async () => {
    // The server answered; we just cannot use what it said. Calling that
    // `offline` would tell the provider to keep showing a basket on the basis
    // of a round trip that did in fact complete.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    } as unknown as Response);

    expect(await readCart()).toMatchObject({ reason: "refused" });
  });
});

describe("adding a line", () => {
  it("passes the preliminary read's failure through unflattened", async () => {
    /*
     * `addLine` reads the cart first for its revision. That read failing IS the
     * add failing, and which way it failed still matters — flattening it here
     * would reintroduce exactly the ambiguity this file exists to remove.
     */
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await addLine("var_1", 1)).toEqual({ ok: false, reason: "offline" });
  });

  it("reports `gone` when the read succeeds but there is no cart to add to", async () => {
    // The API answers an empty view rather than 404 for a browser that has
    // never had a cart, so this is the shape that case arrives in.
    global.fetch = vi.fn().mockResolvedValue(respond(200, EMPTY_VIEW));

    expect(await addLine("var_1", 1)).toEqual({ ok: false, reason: "gone" });
  });

  it("sends the revision it just read, so a stale local counter cannot 400 it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(200, { ...EMPTY_VIEW, cart: CART }))
      .mockResolvedValueOnce(respond(201, { ...EMPTY_VIEW, cart: { ...CART, revision: 4 } }));
    global.fetch = fetchMock;

    const result = await addLine("var_1", 2);
    expect(result.ok).toBe(true);

    const body = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(body).toEqual({ variantId: "var_1", qty: 2, baseRevision: 3 });
  });
});

describe("every call", () => {
  it("sends cookies, because the cart's identity IS a cookie", async () => {
    /*
     * Without `credentials: "include"` the browser withholds `__Host-shop_cart`
     * and the API mints a fresh empty basket on every request — which looks like
     * a cart that silently empties itself rather than like an error. The
     * storefront and the API are on different registrable domains, so this is
     * cross-site and not merely cross-origin.
     */
    const fetchMock = vi.fn().mockResolvedValue(respond(200, EMPTY_VIEW));
    global.fetch = fetchMock;

    await readCart();

    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBe("include");
  });
});
