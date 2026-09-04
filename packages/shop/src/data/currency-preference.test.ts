import { afterEach, describe, expect, it, vi } from "vitest";

import { NAIRA_ONLY, type CurrencyConfig } from "./currency-config";
import {
  CURRENCY_COOKIE,
  readCurrencyCookie,
  resolveCurrency,
} from "./currency-preference";
import { createCart } from "./cart-api";

const BOTH: CurrencyConfig = { currencies: ["NGN", "USD"], default: "NGN", revision: 1 };

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function respond(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("remembering what the shopper chose", () => {
  it("reads the code back out of a cookie header", () => {
    expect(readCurrencyCookie(`${CURRENCY_COOKIE}=USD`)).toBe("USD");
    expect(readCurrencyCookie(`a=1; ${CURRENCY_COOKIE}=USD; b=2`)).toBe("USD");
  });

  it("ignores a cookie holding something this build cannot render", () => {
    /* A stale or hand-edited value must not become a currency. */
    expect(readCurrencyCookie(`${CURRENCY_COOKIE}=GHS`)).toBeNull();
    expect(readCurrencyCookie(`${CURRENCY_COOKIE}=`)).toBeNull();
    expect(readCurrencyCookie("other=USD")).toBeNull();
    expect(readCurrencyCookie(null)).toBeNull();
  });

  it("is not confused by a cookie whose name merely ends in the same word", () => {
    expect(readCurrencyCookie(`not_${CURRENCY_COOKIE}=USD`)).toBeNull();
  });
});

describe("a stored choice the shop can no longer honour", () => {
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THE FAIL-CLOSED RULE, AND WHY IT IS NOT PARANOIA.
   *
   * An operator can switch dollars off — and every shopper who chose USD still
   * has the cookie. Honouring it would quote a currency the server will refuse
   * with a 400 and that Paystack cannot charge, and the shopper only finds out
   * at the payment page, where the dead end is "Currency not supported by
   * merchant" and there is nothing to click.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it("honours the choice while the shop still offers it", () => {
    expect(resolveCurrency("USD", BOTH)).toBe("USD");
  });

  it("drops it the moment the shop stops offering it", () => {
    expect(resolveCurrency("USD", NAIRA_ONLY)).toBe("NGN");
  });

  it("falls back to the config's default, never to a hardcoded guess", () => {
    const usdShop: CurrencyConfig = { currencies: ["USD"], default: "USD", revision: 2 };
    expect(resolveCurrency(null, usdShop)).toBe("USD");
    expect(resolveCurrency("NGN", usdShop)).toBe("USD");
  });

  it("answers the default when nothing was ever chosen", () => {
    expect(resolveCurrency(null, BOTH)).toBe("NGN");
  });
});

describe("creating the basket in a currency", () => {
  /*
   * The cart's currency is written at creation and NEVER updated — order
   * totals freeze against it. Everything below is about not writing the wrong
   * one, and about not throwing a basket away without being asked.
   */
  it("sends no body at all when no currency is known", () => {
    /* A storefront that has not read the currency config must not assert a
       currency of its own; the server's default decides. */
    const fetchMock = vi.fn().mockResolvedValue(respond(201, { cart: null, lines: [], preview: null, changes: [] }));
    global.fetch = fetchMock;

    void createCart();

    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("asks for the chosen currency", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(201, { cart: null, lines: [], preview: null, changes: [] }));
    global.fetch = fetchMock;

    await createCart("USD");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currency: "USD" });
  });

  it("never sends `replace` unless it was asked for", () => {
    /* `replace` DISCARDS THE BASKET. A default-on, or a stray `replace: false`
       that a server read as present, is a shopper's cart deleted without a
       question being put to them. */
    const fetchMock = vi.fn().mockResolvedValue(respond(201, { cart: null, lines: [], preview: null, changes: [] }));
    global.fetch = fetchMock;

    void createCart("USD");

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("replace");
  });

  it("sends `replace` only when the shopper has agreed to lose the basket", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(201, { cart: null, lines: [], preview: null, changes: [] }));
    global.fetch = fetchMock;

    await createCart("USD", true);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ currency: "USD", replace: true });
  });
});

describe("the 409 that has a question attached", () => {
  it("names `currency_locked` rather than leaving it as a generic refusal", async () => {
    /* The generic refusal's copy is "try again", which here would either loop
       or quietly discard the shopper's lines. It needs its own branch so the
       provider can ASK before retrying with `replace`. */
    global.fetch = vi.fn().mockResolvedValue(respond(409, { error: "currency_locked" }));

    await expect(createCart("USD")).resolves.toEqual({ ok: false, reason: "currency_locked" });
  });

  it("does not fire on a 409 that means something else", async () => {
    global.fetch = vi.fn().mockResolvedValue(respond(409, { error: "insufficient_stock" }));

    const result = await createCart("USD");

    expect(result).toEqual({
      ok: false,
      reason: "refused",
      status: 409,
      detail: "insufficient_stock",
    });
  });

  it("does not fire on a non-409 that merely mentions the string", async () => {
    /* Status-checked as well as name-checked: nothing but the documented 409
       may raise a prompt offering to empty somebody's basket. */
    global.fetch = vi.fn().mockResolvedValue(respond(400, { error: "currency_locked" }));

    const result = await createCart("USD");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("refused");
  });

  it("still reads a transport failure as offline, never as a refusal", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(createCart("USD")).resolves.toEqual({ ok: false, reason: "offline" });
  });
});
