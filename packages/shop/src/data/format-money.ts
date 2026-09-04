import type { ApiMoney } from "./cart-api";
import { isCurrencyCode, type CurrencyCode } from "./currency-config";

/**
 * Money, rendered from the currency it arrives with.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTHING HERE CONVERTS. THE EXCHANGE RATE IS DELIBERATELY NOT ON THE WIRE.
 *
 * The API prices every value server-side and hands back `{ amount, currency }`
 * in MINOR UNITS. This module picks a symbol and inserts separators; it does
 * not multiply by anything. A client-side conversion would disagree with what
 * Paystack actually charges — the shopper reads one number and is billed
 * another — and there is no rate available here to do it with even if it were
 * wanted. If a price looks wrong, the fix is server-side.
 *
 * ═══ AND IT NEVER INFERS THE SYMBOL FROM CONTEXT ═══
 * `formatNaira` in `money.ts` takes a bare number and always prints `₦`, which
 * was correct for a shop that could only charge naira. A USD amount through
 * that function renders `₦49` for $49.99 — the right glyph replaced by the
 * wrong one AND the cents silently dropped, which is a plausible-looking price
 * for the wrong currency in the wrong denomination. The currency code is read
 * from the value, always, and a value that does not carry one is not
 * formattable by this module.
 *
 * ═══ HAND-ROLLED, NOT `Intl.NumberFormat` ═══
 * `money.ts` explains why and the reason is unchanged: NGN formatting varies
 * with the ICU build — full-icu Node emits `₦18,500`, a small-icu or Workers
 * runtime emits `NGN 18,500` — and a server and client disagreeing on a price
 * string is a hydration error on every product on the page. USD is better
 * behaved across builds but is formatted the same way here so that one
 * function cannot produce two conventions.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * How each currency is written, and how many minor units make one of it.
 *
 * `decimals` IS THE HALF THAT IS EASY TO GET WRONG. Both currencies store 100
 * minor units to the major one, so `amount / 100` is right for both — but NGN
 * is quoted in whole naira (kobo are not priced, not charged and not shown)
 * while USD without its cents is a different price. `majorUnits()` in
 * `cart-api.ts` rounds to a whole number and is therefore NAIRA-ONLY by
 * construction; this table is why nothing in this module calls it.
 */
const CURRENCIES: Record<CurrencyCode, { symbol: string; minor: number; decimals: number }> = {
  NGN: { symbol: "₦", minor: 100, decimals: 0 },
  USD: { symbol: "$", minor: 100, decimals: 2 },
};

/** `1234567` → `"1,234,567"`. The separator rule both currencies share. */
function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * `{ amount: 2800000, currency: "NGN" }` → `"₦28,000"`
 * `{ amount: 4999, currency: "USD" }` → `"$49.99"`
 *
 * A NULL OR UNREADABLE VALUE RENDERS AS ZERO IN THE FALLBACK CURRENCY rather
 * than throwing or printing `NaN`. `majorUnits()` already made that call for
 * the naira path ("an absent price is zero, not NaN") and a price slot that
 * throws takes the whole page with it — but see `formatMoneyStrict` for the
 * call sites that would rather know.
 */
export function formatMoney(money: ApiMoney | null | undefined, fallback: CurrencyCode = "NGN"): string {
  const code = money && isCurrencyCode(money.currency) ? money.currency : fallback;
  const amount = money && Number.isFinite(money.amount) ? money.amount : 0;
  return formatMinor(amount, code);
}

/**
 * The same rendering, from a raw minor-unit figure and an explicit code.
 *
 * For the values that reach the UI as a bare number with the currency carried
 * beside them rather than on them — an `Order`, whose fields are plain numbers
 * with ONE `currency` on the order itself (see `money-units.test.ts` on the
 * two conventions this system has). The code is a REQUIRED argument here
 * precisely so that such a call site cannot forget to go and find it.
 */
export function formatMinor(minor: number, code: CurrencyCode): string {
  const { symbol, minor: per, decimals } = CURRENCIES[code];
  const value = (Number.isFinite(minor) ? minor : 0) / per;
  const negative = value < 0;
  const abs = Math.abs(value);

  /* Rounded to the currency's own precision BEFORE splitting, so 49.999 in a
     2-decimal currency is `$50.00` and not `$49.100`. */
  const fixed = abs.toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const body = fraction ? `${group(whole)}.${fraction}` : group(whole);
  return `${negative ? "-" : ""}${symbol}${body}`;
}

/**
 * The symbol alone, for the rare slot that needs it without a figure — a
 * switcher's label, an input's prefix.
 *
 * NOT FOR BUILDING A PRICE STRING BY CONCATENATION. Assembling
 * `symbolFor(code) + someNumber` reintroduces exactly the bug this module
 * exists to remove: it skips the minor-unit division and the per-currency
 * precision, so a USD price comes out a hundred times too large. Use
 * `formatMoney` or `formatMinor`.
 */
export function symbolFor(code: CurrencyCode): string {
  return CURRENCIES[code].symbol;
}

/**
 * Whether two money values can be compared or summed at all.
 *
 * Mixing currencies in one arithmetic expression is the error that produces a
 * number with no meaning — `subtotal + shipping` across NGN and USD is neither
 * — and the API's own `currency_mismatch` refusal exists for the same reason.
 * Call sites that add money should assert this rather than assume it.
 */
export function sameCurrency(a: ApiMoney | null, b: ApiMoney | null): boolean {
  return !!a && !!b && a.currency === b.currency;
}
