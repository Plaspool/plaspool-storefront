import { isCurrencyCode, type CurrencyCode, type CurrencyConfig } from "./currency-config";

/**
 * The shopper's chosen currency, remembered between visits.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A COOKIE, NOT `localStorage`, AND THE REASON IS THE SERVER.
 *
 * Nothing on the storefront renders a price in the browser: `/store` and every
 * product page are Server Components, prerendered and served from KV
 * (`revalidate = 300` and `3600`, with `generateStaticParams` enumerating every
 * slug). A preference the server cannot see would mean the first paint of every
 * price is the wrong currency, corrected on hydration — a flash on the one
 * number a shopper is deciding with.
 *
 * `localStorage` is unreachable from a Server Component by construction. A
 * cookie at least CAN be read there, so this is the only mechanism that leaves
 * the server-rendered option open.
 *
 * ═══ BUT READING IT ON THE SERVER IS NOT FREE, AND IS NOT DONE HERE ═══
 * `cookies()` in a Server Component opts the route into DYNAMIC rendering. On
 * the catalogue that would discard `generateStaticParams`, stop `/store` being
 * served from KV, and full-render on every view — which is precisely the
 * condition behind storefront #9's Error 1102 outage (27ms median against a
 * 10ms budget), and it would multiply the KV write traffic the account is
 * already sized against. So NOTHING in this module is called from a Server
 * Component today; it is read client-side, and how the server learns the
 * currency is a separate decision that this file deliberately does not make.
 *
 * ═══ NOT `HttpOnly`, ON PURPOSE ═══
 * The client half has to read it to render the switcher's current state
 * without waiting on a round trip. It holds a three-letter currency code and
 * nothing else — no identity, no session, nothing worth protecting — so it is
 * `SameSite=Lax` and readable. The CART's currency is not this value: that is
 * written server-side at cart creation and is authoritative. This is only what
 * to ASK for.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const CURRENCY_COOKIE = "plaspool_currency";

/** A year. The choice is a preference, not a session — somebody who shops in
 *  dollars in March is shopping in dollars in September. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Parses one cookie header / `document.cookie` string. Exported so the
 *  parsing is provable without a DOM. */
export function readCurrencyCookie(cookieHeader: string | null | undefined): CurrencyCode | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (rawName?.trim() !== CURRENCY_COOKIE) continue;
    const value = decodeURIComponent(rest.join("=").trim());
    return isCurrencyCode(value) ? value : null;
  }
  return null;
}

/**
 * What to quote this shopper in.
 *
 * ═══ THE CONFIG ALWAYS WINS OVER THE STORED CHOICE ═══
 * A shopper who picked USD while it was enabled still has that cookie after an
 * operator switches dollars off — and the shop would then be quoting a
 * currency the server will refuse and Paystack cannot charge. So a stored
 * choice is honoured if and only if it is STILL in `config.currencies`, and
 * otherwise the config's own default answers. This is the same fail-closed
 * direction `currency-config.ts` takes, one layer up: the storefront never
 * decides a currency is available.
 */
export function resolveCurrency(
  stored: CurrencyCode | null,
  config: CurrencyConfig,
): CurrencyCode {
  return stored && config.currencies.includes(stored) ? stored : config.default;
}

/** Browser-side read. Answers null outside a browser and for an unset or
 *  unrecognised value alike — the caller resolves that against the config. */
export function storedCurrency(): CurrencyCode | null {
  if (typeof document === "undefined") return null;
  return readCurrencyCookie(document.cookie);
}

/**
 * Browser-side write.
 *
 * `path=/` because the choice is site-wide; a cookie scoped to the page it was
 * set on would be forgotten the moment the shopper opened a product.
 */
export function storeCurrency(code: CurrencyCode): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${CURRENCY_COOKIE}=${encodeURIComponent(code)}` +
    `; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
