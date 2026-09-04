import { COMMERCE_API_BASE } from "./config";

/**
 * The currency config — the server's answer to "what may this shop charge in?"
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS FILE IS THE FEATURE GATE, AND IT DEFAULTS TO OFF.
 *
 * `GET /api/public/shop/currency-config` is NOT DEPLOYED YET. Every call here
 * 404s today and will keep 404ing until the admin ships it, so the fallback is
 * not an error path — it is the normal state, and it is exactly today's shop:
 * one currency, naira, no switcher, nothing on screen that was not there
 * before. The same rule `delivery-config.ts` follows, for the same reason.
 *
 * `isSwitchable()` is the ONE question the UI asks. A single-entry list means
 * render no switcher at all — not a disabled one, not a one-option dropdown.
 * A shopper cannot be shown a choice that does not exist.
 *
 * ═══ AND IT MUST STAY OFF UNTIL PAYSTACK SAYS OTHERWISE ═══
 * Dollars cannot be enabled until the account has requested USD and attached a
 * Zenith USD domiciliary account. A USD checkout before Paystack approves the
 * currency dead-ends at "Currency not supported by merchant", which the
 * shopper cannot recover from — they have chosen a currency, filled an
 * address, and the payment page refuses them with nothing to click. So the
 * storefront never decides USD is available: it renders the switcher if and
 * only if the SERVER lists more than one currency, and the server will not
 * list USD until the admin can charge it.
 *
 * COOKIELESS AND SHARED-CACHED, like the delivery config. Every shopper gets
 * the same answer and nothing per-viewer may go into it, so this sends no
 * credentials.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * The currencies this storefront knows how to render, and nothing else.
 *
 * A CLOSED UNION, and the parser DROPS anything outside it. Paystack allows a
 * Nigeria-registered business exactly these two — NGN as the base, USD as the
 * one permitted addition — and cedis or rand would each need a separate
 * business registered in that country, so a third code arriving here is a bug
 * or a rollback, not a feature. An unknown code has no symbol and no minor-unit
 * rule in `money.ts`, so rendering it would print a number with no idea what it
 * means. Dropped, and the shop stays on the currencies it can actually charge.
 */
export type CurrencyCode = "NGN" | "USD";

const KNOWN: readonly CurrencyCode[] = ["NGN", "USD"];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (KNOWN as readonly string[]).includes(value);
}

export interface CurrencyConfig {
  /** What the shop may charge in. Never empty — the parser guarantees the
   *  default is a member, so `currencies[0]` is always renderable. */
  currencies: CurrencyCode[];
  /** What a shopper who has never chosen gets. Always in `currencies`. */
  default: CurrencyCode;
  revision: number;
}

/**
 * TODAY'S SHOP, AND THE ANSWER TO EVERY FAILURE.
 *
 * Naira only, so `isSwitchable` is false, so no switcher renders and every
 * price is quoted the way it is quoted now. Failing toward the SINGLE currency
 * is the safe direction here, and it is the opposite of the delivery config's
 * rule on purpose: there, failing toward the richer form only asks for a field
 * too many; here, failing toward the richer answer would offer a shopper a
 * currency the shop may not be able to charge, and strand them at Paystack.
 */
export const NAIRA_ONLY: CurrencyConfig = {
  currencies: ["NGN"],
  default: "NGN",
  revision: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCurrencyConfig(body: unknown): CurrencyConfig {
  const raw = isRecord(body) && isRecord(body.config) ? body.config : null;
  if (!raw) return NAIRA_ONLY;

  /* Unknown codes dropped rather than passed through — see `CurrencyCode`.
     Deduplicated too: a repeated entry would render a duplicate control. */
  const listed = Array.isArray(raw.currencies)
    ? raw.currencies.filter(isCurrencyCode)
    : [];
  const currencies = [...new Set(listed)];

  const fallback = isCurrencyCode(raw.default) ? raw.default : NAIRA_ONLY.default;

  /* ═══ THE DEFAULT MUST BE ONE OF THE CHOICES, OR THERE IS NO CONFIG ═══
     A default outside its own list is incoherent — it would leave the shop
     quoting a currency the switcher cannot select and the server may not
     accept. Rather than repair it into something plausible, this falls back to
     naira-only: an unreadable config is not a licence to guess which half was
     right. Same for an empty list. */
  if (currencies.length === 0 || !currencies.includes(fallback)) return NAIRA_ONLY;

  return {
    currencies,
    default: fallback,
    revision: typeof raw.revision === "number" ? raw.revision : 0,
  };
}

/**
 * WHETHER TO RENDER A SWITCHER AT ALL — the gate, in one predicate.
 *
 * Not "does the shop support USD" and not "is the flag on": one currency means
 * there is no choice to offer, so there is no control. A disabled switcher or
 * a dropdown with one option would both announce a feature the shop does not
 * have, which is worse than the absence it is standing in for.
 */
export function isSwitchable(config: CurrencyConfig): boolean {
  return config.currencies.length > 1;
}

/** Where the config lives. Public, cookieless, cacheable. */
export const CURRENCY_CONFIG_PATH = "/api/public/shop/currency-config";

/**
 * The shop's currencies, or naira-only.
 *
 * NEVER THROWS AND NEVER REJECTS. Today it always answers `NAIRA_ONLY`,
 * because the route is not deployed — and on `localhost` it would anyway,
 * since the commerce API sends no CORS header for that origin.
 */
export async function readCurrencyConfig(): Promise<CurrencyConfig> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}${CURRENCY_CONFIG_PATH}`, {
      // No `credentials`. See the header — this response is shared-cached.
      cache: "no-store",
    });
    if (!res.ok) return NAIRA_ONLY;
    return parseCurrencyConfig(await res.json());
  } catch {
    return NAIRA_ONLY;
  }
}
