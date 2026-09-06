import { isCountryCode } from "./countries";

/**
 * Where the connection seems to be, from the edge's own geolocation.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A HINT, NOT A FACT, AND ONLY EVER USED TO PRESELECT THE COUNTRY.
 *
 * Cloudflare stamps every request with the country, region and city its IP
 * database places it in (`request.cf`, and the `CF-IPCountry` header). The
 * country is right nearly always; the region and city are right on fixed
 * lines and wrong often enough on mobile — a phone in Ibadan is routinely
 * placed in Lagos — that preselecting a STATE from them would set the
 * delivery price from a guess. So the checkout reads the whole hint but acts
 * on `country` alone; `region` and `city` ride along for the day something
 * wants to show them, never to fill a field. The GPS fill in
 * `address-autofill.ts` is what fills the rest, because a device fix is
 * accurate and the shopper asked for it.
 *
 * `detectGeoHint` IS PURE so the app's `/api/geo` route can be tested with a
 * `Headers` and a plain object. `readGeoHint` is the browser's side.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface GeoHint {
  /** ISO 3166-1 alpha-2, uppercase — or null when the edge did not know. */
  country: string | null;
  /** The edge's region name, e.g. "Lagos". Informational only. */
  region: string | null;
  /** ISO 3166-2 subdivision code without the country prefix, e.g. "LA". */
  regionCode: string | null;
  city: string | null;
}

export const EMPTY_HINT: GeoHint = Object.freeze({
  country: null,
  region: null,
  regionCode: null,
  city: null,
});

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/**
 * The hint from what the Worker was handed.
 *
 * `cf` FIRST, THE HEADER SECOND. `request.cf` is what Cloudflare itself
 * computed; the header carries the same country and nothing else, and is the
 * only source under `next dev`, where there is no `cf` at all (there it is
 * absent too, and the hint is empty — which is the documented local-dev
 * condition, not a bug).
 *
 * "XX" AND "T1" ARE NOT COUNTRIES. Cloudflare sends the first for "unknown"
 * and the second for Tor exits; `isCountryCode` refuses both, so a shopper on
 * either gets the config's default rather than a two-letter mystery.
 */
export function detectGeoHint(headers: Headers, cf?: Record<string, unknown> | null): GeoHint {
  const rawCountry = str(cf?.country) ?? str(headers.get("cf-ipcountry"));
  const country = rawCountry ? rawCountry.toUpperCase() : null;
  return {
    country: isCountryCode(country) ? country : null,
    region: str(cf?.region),
    regionCode: str(cf?.regionCode)?.toUpperCase() ?? null,
    city: str(cf?.city),
  };
}

/** The app's own route — same origin, so no CORS and no credentials. */
export const GEO_HINT_PATH = "/api/geo";

/**
 * The hint for this browser, or the empty one.
 *
 * NEVER THROWS AND NEVER REJECTS. A failed read is exactly as useful as an
 * empty hint — the form keeps its default country — so the two are the same
 * value here.
 */
export async function readGeoHint(fetchImpl: typeof fetch = fetch): Promise<GeoHint> {
  try {
    const res = await fetchImpl(GEO_HINT_PATH, { cache: "no-store" });
    if (!res.ok) return EMPTY_HINT;
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) return EMPTY_HINT;
    const raw = body as Record<string, unknown>;
    const country = str(raw.country)?.toUpperCase() ?? null;
    return {
      country: isCountryCode(country) ? country : null,
      region: str(raw.region),
      regionCode: str(raw.regionCode)?.toUpperCase() ?? null,
      city: str(raw.city),
    };
  } catch {
    return EMPTY_HINT;
  }
}
