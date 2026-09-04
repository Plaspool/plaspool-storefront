import { describe, expect, it } from "vitest";

import { formatMinor, formatMoney, sameCurrency, symbolFor } from "./format-money";
import { formatNaira } from "./money";
import { majorUnits } from "./cart-api";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE BUG THIS MODULE EXISTS TO MAKE IMPOSSIBLE.
 *
 * `formatNaira(amount: number)` takes a bare number and always prints `₦`. It
 * was correct for a shop that could only charge naira, and it is a trap the
 * moment one cannot: the currency is dropped on the floor two steps earlier,
 * at `majorUnits()`, which also ROUNDS TO A WHOLE UNIT.
 *
 * Run $49.99 through that pipeline and it renders `₦50`: the wrong glyph, and
 * the cents silently gone. Not a crash, not a `NaN` — a completely plausible
 * price, in the wrong currency, in the wrong denomination. The shopper reads
 * it, agrees to it, and Paystack charges something else.
 *
 * So the assertions below are mostly about USD, and the naira ones exist to
 * prove the old rendering did not move underneath the shop while this was
 * added.
 * ═══════════════════════════════════════════════════════════════════════════
 */

describe("the naira rendering, which must not drift", () => {
  it("still prints whole naira with comma groups and no decimals", () => {
    expect(formatMoney({ amount: 2800000, currency: "NGN" })).toBe("₦28,000");
    expect(formatMoney({ amount: 300000, currency: "NGN" })).toBe("₦3,000");
    expect(formatMoney({ amount: 100, currency: "NGN" })).toBe("₦1");
  });

  it("agrees with `formatNaira`, so no price on the site changes", () => {
    /* The migration guard. Every existing call site renders through
       `formatNaira(majorUnits(money))`; this pins that the new path produces
       the identical string for the currency the shop charges today. */
    for (const minor of [0, 100, 99900, 2800000, 3310000, 123456700]) {
      const money = { amount: minor, currency: "NGN" };
      expect(formatMoney(money)).toBe(formatNaira(majorUnits(money)));
    }
  });

  it("keeps the sign outside the symbol for a negative, as a discount line is", () => {
    expect(formatMoney({ amount: -50000, currency: "NGN" })).toBe("-₦500");
  });
});

describe("dollars, where the old pipeline silently lied", () => {
  it("prints cents, which `majorUnits` would have rounded away", () => {
    expect(formatMoney({ amount: 4999, currency: "USD" })).toBe("$49.99");
    expect(formatMoney({ amount: 5000, currency: "USD" })).toBe("$50.00");
    expect(formatMoney({ amount: 1, currency: "USD" })).toBe("$0.01");
  });

  it("is nothing like what the naira pipeline would have rendered", () => {
    /* The regression this file is named for, stated as an assertion: $49.99
       through the old path is `₦50` — right-looking, entirely wrong. */
    const usd = { amount: 4999, currency: "USD" };
    expect(formatNaira(majorUnits(usd))).toBe("₦50");
    expect(formatMoney(usd)).toBe("$49.99");
  });

  it("groups thousands and still keeps both decimal places", () => {
    expect(formatMoney({ amount: 123456789, currency: "USD" })).toBe("$1,234,567.89");
  });

  it("rounds to the currency's own precision rather than printing a long tail", () => {
    /* A server-side rounding rule can hand back a fractional minor unit. Two
       decimals is what a dollar has; `$49.999` is not a price. */
    expect(formatMinor(4999.9, "USD")).toBe("$50.00");
    expect(formatMinor(4999.4, "USD")).toBe("$49.99");
  });

  it("carries the sign the same way naira does", () => {
    expect(formatMoney({ amount: -2550, currency: "USD" })).toBe("-$25.50");
  });
});

describe("a value that does not say what it is", () => {
  it("falls back rather than throwing, because a price slot takes the page with it", () => {
    expect(formatMoney(null)).toBe("₦0");
    expect(formatMoney(undefined)).toBe("₦0");
  });

  it("honours an explicit fallback currency when the value carries none", () => {
    /* For a USD shopper: a missing figure should read as zero DOLLARS, not
       zero naira, or the empty state announces the wrong currency. */
    expect(formatMoney(null, "USD")).toBe("$0.00");
  });

  it("does not trust an unknown currency code on the wire", () => {
    /* A code this build has no symbol or precision for cannot be rendered
       honestly. It falls back rather than inventing a glyph. */
    expect(formatMoney({ amount: 4999, currency: "GHS" }, "USD")).toBe("$49.99");
  });

  it("renders a NaN amount as zero rather than as `NaN`", () => {
    expect(formatMoney({ amount: Number.NaN, currency: "USD" })).toBe("$0.00");
  });
});

describe("the helpers that keep call sites honest", () => {
  it("hands back the symbol for a label", () => {
    expect(symbolFor("NGN")).toBe("₦");
    expect(symbolFor("USD")).toBe("$");
  });

  it("knows when two amounts may not be added together", () => {
    /* `subtotal + shipping` across currencies is a number with no meaning —
       the same error the API refuses as `currency_mismatch`. */
    expect(sameCurrency({ amount: 1, currency: "NGN" }, { amount: 2, currency: "NGN" })).toBe(true);
    expect(sameCurrency({ amount: 1, currency: "NGN" }, { amount: 2, currency: "USD" })).toBe(false);
    expect(sameCurrency(null, { amount: 2, currency: "USD" })).toBe(false);
  });
});

describe("nothing here converts", () => {
  it("has no rate in it, and cannot acquire one", () => {
    /*
     * THE RULE, PINNED. The exchange rate is deliberately not on the wire: a
     * client-side conversion disagrees with what Paystack actually charges,
     * so the shopper reads one number and is billed another.
     *
     * The same minor figure in two currencies must render as the same NUMBER
     * with a different symbol and precision — never as one converted into the
     * other. If somebody ever wires a rate into this module, this fails.
     */
    expect(formatMoney({ amount: 500000, currency: "NGN" })).toBe("₦5,000");
    expect(formatMoney({ amount: 500000, currency: "USD" })).toBe("$5,000.00");
  });
});
