import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CURRENCY_CONFIG_PATH,
  NAIRA_ONLY,
  isCurrencyCode,
  isSwitchable,
  parseCurrencyConfig,
  readCurrencyConfig,
} from "./currency-config";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GATE, AND THE FACT THAT IT IS SHUT.
 *
 * `GET /api/public/shop/currency-config` is not deployed. Every assertion
 * about the fallback below is therefore describing what production does
 * TODAY, not a hypothetical error path — shipping this must change nothing a
 * shopper sees, and these are the tests that say so.
 *
 * The dangerous direction is failing OPEN. A storefront that decided USD was
 * available before Paystack approved the currency would send a shopper who
 * chose dollars to a payment page that refuses them with "Currency not
 * supported by merchant" and nothing to click. So every ambiguous input here
 * must land on naira-only.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function respond(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("the gate, while dollars are switched off", () => {
  it("reads today's single-currency answer and offers no choice", () => {
    const config = parseCurrencyConfig({
      config: { currencies: ["NGN"], default: "NGN", revision: 1 },
    });

    expect(config).toEqual({ currencies: ["NGN"], default: "NGN", revision: 1 });
    expect(isSwitchable(config)).toBe(false);
  });

  it("opens only when the SERVER lists a second currency", () => {
    const config = parseCurrencyConfig({
      config: { currencies: ["NGN", "USD"], default: "NGN", revision: 1 },
    });

    expect(config.currencies).toEqual(["NGN", "USD"]);
    expect(isSwitchable(config)).toBe(true);
  });

  it("falls back to naira-only for a route that is not deployed", async () => {
    /* THE STATE OF PRODUCTION TODAY. A 404 is the normal answer, not an
       incident, and it must be indistinguishable from the shop as it is. */
    global.fetch = vi.fn().mockResolvedValue(respond(404, { error: "not_found" }));

    await expect(readCurrencyConfig()).resolves.toEqual(NAIRA_ONLY);
  });

  it("falls back to naira-only when the API cannot be reached at all", async () => {
    /* Every `localhost` render, where the commerce API sends no CORS header. */
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readCurrencyConfig()).resolves.toEqual(NAIRA_ONLY);
    expect(isSwitchable(NAIRA_ONLY)).toBe(false);
  });

  it("never sends credentials, because the response is shared-cached", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond(200, { config: { currencies: ["NGN"], default: "NGN", revision: 1 } }));
    global.fetch = fetchMock;

    await readCurrencyConfig();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(CURRENCY_CONFIG_PATH);
    expect(init.credentials).toBeUndefined();
    expect(init.cache).toBe("no-store");
  });
});

describe("a config this storefront cannot honour", () => {
  it("drops a currency it has no symbol or precision for", () => {
    /* Paystack allows a Nigeria-registered business NGN and USD and nothing
       else; cedis would need a separate company in Ghana. A third code here is
       a bug or a rollback, and rendering it would print a figure with no idea
       what denomination it is in. */
    const config = parseCurrencyConfig({
      config: { currencies: ["NGN", "GHS", "ZAR"], default: "NGN", revision: 2 },
    });

    expect(config.currencies).toEqual(["NGN"]);
    expect(isSwitchable(config)).toBe(false);
  });

  it("refuses a default that is not one of its own currencies", () => {
    /* Incoherent rather than merely odd: the shop would be quoting a currency
       the switcher cannot select. Repairing it into something plausible would
       be guessing which half was right. */
    expect(
      parseCurrencyConfig({ config: { currencies: ["NGN"], default: "USD", revision: 3 } }),
    ).toEqual(NAIRA_ONLY);
  });

  it("refuses an empty currency list", () => {
    expect(
      parseCurrencyConfig({ config: { currencies: [], default: "NGN", revision: 4 } }),
    ).toEqual(NAIRA_ONLY);
  });

  it("refuses a body with no config at all", () => {
    expect(parseCurrencyConfig({})).toEqual(NAIRA_ONLY);
    expect(parseCurrencyConfig(null)).toEqual(NAIRA_ONLY);
    expect(parseCurrencyConfig("nonsense")).toEqual(NAIRA_ONLY);
  });

  it("does not render one currency twice", () => {
    /* A duplicate would draw a duplicate control. */
    const config = parseCurrencyConfig({
      config: { currencies: ["USD", "NGN", "USD"], default: "NGN", revision: 5 },
    });

    expect(config.currencies).toEqual(["USD", "NGN"]);
  });

  it("survives a missing revision rather than rejecting the whole config", () => {
    /* The revision is bookkeeping — it decides nothing on screen, so it is not
       worth failing an otherwise-usable config over. */
    expect(parseCurrencyConfig({ config: { currencies: ["NGN"], default: "NGN" } })).toEqual({
      currencies: ["NGN"],
      default: "NGN",
      revision: 0,
    });
  });
});

describe("isCurrencyCode", () => {
  it("accepts only what this storefront can actually render", () => {
    expect(isCurrencyCode("NGN")).toBe(true);
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("GHS")).toBe(false);
    expect(isCurrencyCode("ngn")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
    expect(isCurrencyCode(840)).toBe(false);
  });
});
