import { COMMERCE_API_BASE } from "./config";
import {
  NIGERIAN_STATES,
  foldRegion,
  matchNigerianState,
  type NigerianState,
} from "./nigerian-states";

/**
 * The places the active courier will deliver to — the STATE LIST, from the
 * server rather than from this repo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS WHEN `nigerian-states.ts` ALREADY LISTS THE STATES.
 *
 * The 36 states and the FCT are a fact of geography and do not move. What
 * moves is WHICH OF THEM THE COURIER ACCEPTS, and that is a courier setting:
 * Fez takes all 37, Terminal does not, and the shop can be switched between
 * them in the admin with no deploy. A list spelled in this repo cannot follow
 * that switch, so the OFFERED list is read from here.
 *
 * ═══ WHAT THIS LIST IS NOT ALLOWED TO DO: NAME THE STATE ═══
 * `delivery-places` returns the COURIER'S spelling. Read live on 2026-09-09
 * it ends `{"code":"37","name":"FCT"}` — while every Abuja row in
 * `/api/public/marketing/areas` is filed under
 * `"region": "Federal Capital Territory"`, and the shop's own delivery zones
 * are keyed the same way.
 *
 * Those are two different vocabularies and only one of them prices an order.
 * Storing `"FCT"` on an address would leave `districtChoicesFor()` matching
 * nothing — the district picker that SETS THE DELIVERY PRICE would vanish for
 * the capital, and the order would fall to the state's catch-all rate. So:
 *
 *   THE BACKEND CHOOSES WHICH STATES ARE OFFERED.
 *   THE SHOP'S OWN CANONICAL NAME IS WHAT THE ADDRESS CARRIES.
 *
 * `matchNigerianState()` reconciles the two — `"FCT"` is already an alias of
 * `"Federal Capital Territory"` — so a courier switch changes the offered
 * list and changes no stored value and no price.
 *
 * And the courier's own spelling is not this storefront's problem in the
 * first place: Fez wants `FCT`, Terminal answers `400 Invalid state` on it
 * and wants `Abuja`. No single stored string can satisfy both, which is why
 * the admin carries `fezStateName`/`terminalStateName` and translates at
 * BOOKING time. Do not try to pre-translate here.
 *
 * ═══ EMPTY IS "NO CONSTRAINT", NEVER AN ERROR ═══
 * This route never fails. No cache yet, an unknown country, or a shop
 * shipping by hand all answer `regions: []`. That means *fall back to the
 * full list*, not *refuse to take an order* — a shop that has not pressed
 * "Refresh place lists" in the admin must still be able to sell.
 *
 * COOKIELESS, `Cache-Control: public`, AND A SIMPLE REQUEST. Do not add a
 * request header to this fetch: it would make the preflight non-simple and
 * the browser would need a CORS answer this route does not send.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** One place the courier serves. `code` is the courier's internal id and
 *  nothing consumes it; `name` is the courier's own spelling. */
export interface PlaceRegion {
  code: string;
  name: string;
}

export interface DeliveryPlaces {
  country: string;
  /** `"fez"`, `"terminal"`, or `"manual"` when the shop ships by hand. */
  provider: string;
  regions: PlaceRegion[];
  /**
   * ═══ `null` IS NOT `{}` — BRANCH ON IT EXPLICITLY (§2) ═══
   * `null` means *this courier enforces no city list; let the shopper type
   * anything*. An empty object would mean *every region's list is empty, so
   * nothing is acceptable*. Fez is always `null`; Terminal would populate it,
   * and the city field would then have to become a constrained pick.
   *
   * Parsed and carried so the seam is real rather than assumed. Nothing
   * renders from it yet — the city field is free text while `cities === null`,
   * which is every deploy to date.
   */
  cities: Record<string, string[]> | null;
}

/** No constraint: the full state list, free-text city. What a shop with no
 *  cached place list, an unknown country, or manual shipping gets. */
export const NO_PLACES: DeliveryPlaces = {
  country: "NG",
  provider: "unknown",
  regions: [],
  cities: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

function parseRegion(raw: unknown): PlaceRegion | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name);
  if (!name) return null;
  // The code is the courier's id and may legitimately be absent; the name is
  // the only part anything reads.
  return { code: str(raw.code) ?? "", name };
}

/**
 * `cities` as sent, or null.
 *
 * ANYTHING THAT IS NOT RECOGNISABLY A MAP OF LISTS BECOMES `null` — which is
 * the permissive answer (type your city), never the restrictive one. A
 * malformed body must not be able to lock a shopper out of their own city.
 */
function parseCities(raw: unknown): Record<string, string[]> | null {
  if (!isRecord(raw)) return null;
  const out: Record<string, string[]> = {};
  for (const [region, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const names = list.filter((c): c is string => typeof c === "string" && c.trim() !== "");
    out[region] = names.map((c) => c.trim());
  }
  return out;
}

/** A response body as places, or `NO_PLACES`. Never throws. */
export function parseDeliveryPlaces(raw: unknown): DeliveryPlaces {
  if (!isRecord(raw)) return NO_PLACES;

  const regions = Array.isArray(raw.regions)
    ? raw.regions.map(parseRegion).filter((r): r is PlaceRegion => r !== null)
    : [];

  return {
    country: (str(raw.country) ?? NO_PLACES.country).toUpperCase(),
    provider: str(raw.provider) ?? NO_PLACES.provider,
    regions,
    cities: "cities" in raw ? parseCities(raw.cities) : null,
  };
}

/** Where the list lives. Public, cookieless, cacheable. */
export const DELIVERY_PLACES_PATH = "/api/public/shop/delivery-places";

/**
 * The courier's places for a country, or `NO_PLACES`.
 *
 * NEVER THROWS AND NEVER REJECTS. On `localhost` this always falls back,
 * because the commerce API sends no CORS header for that origin — the
 * documented local-dev condition, not a bug in the call. Falling back means
 * the full state list, so the form is unchanged in dev.
 */
export async function readDeliveryPlaces(
  country: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryPlaces> {
  try {
    const url = `${COMMERCE_API_BASE}${DELIVERY_PLACES_PATH}?country=${encodeURIComponent(
      country.toUpperCase(),
    )}`;
    // No `credentials`, and NO HEADERS — see the header: this must stay a
    // simple request.
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) return NO_PLACES;
    return parseDeliveryPlaces(await res.json());
  } catch {
    return NO_PLACES;
  }
}

/**
 * The states to offer in the State select, in this repo's canonical spelling.
 *
 * ═══ THE RECONCILIATION, AND THE WHOLE POINT OF THIS MODULE ═══
 * Each courier name goes through `matchNigerianState()`, so what the select
 * stores is always the string the areas list and the shop's zones are keyed
 * by — `"FCT"` from Fez becomes `"Federal Capital Territory"`, and the
 * district picker and the price both keep working.
 *
 * FALLS BACK TO THE FULL LIST when the server named no regions (no cache,
 * unknown country, manual shipping) or when NOTHING it named could be
 * reconciled — an empty select is a checkout nobody can complete, and a
 * courier list this storefront cannot read is a reason to constrain nothing,
 * not a reason to sell nothing.
 *
 * A SINGLE unreconcilable name is DROPPED rather than offered verbatim: it
 * would be a state this repo has never heard of, and storing its raw name
 * would price the order at the catch-all rate without anyone noticing.
 */
export function offeredStates(places: DeliveryPlaces): readonly NigerianState[] {
  if (places.regions.length === 0) return NIGERIAN_STATES;

  const matched = new Map<string, NigerianState>();
  const unknown: string[] = [];
  for (const region of places.regions) {
    const state = matchNigerianState(region.name);
    if (state) matched.set(state.code, state);
    else unknown.push(region.name);
  }

  if (unknown.length > 0) {
    console.warn(
      `[delivery-places] ignoring ${unknown.length} unrecognised region name(s): ${unknown.join(", ")}`,
    );
  }

  if (matched.size === 0) return NIGERIAN_STATES;

  // Kept in this repo's order, not the courier's — the courier sends them in
  // its own internal id order ("Kano, Lagos, Kaduna, …"), which is not an
  // order any shopper scans a select in.
  return NIGERIAN_STATES.filter((state) => matched.has(state.code));
}

/**
 * The cities a region constrains to, or null for "type anything".
 *
 * THE `cities === null` BRANCH, spelled once so no call site has to remember
 * which of `null` and `{}` means which. Fez sends `null` and every city is
 * free text; a Terminal shop would send a map and the city field would become
 * a required pick from this.
 */
export function citiesFor(places: DeliveryPlaces, region: string): string[] | null {
  if (places.cities === null) return null;
  const target = foldRegion(region);
  if (!target) return null;
  for (const [name, list] of Object.entries(places.cities)) {
    if (foldRegion(name) === target) return list;
  }
  return [];
}
