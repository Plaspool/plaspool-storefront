import type { Address } from "../data/checkout-api";
import type { DeliveryConfig } from "../data/delivery-config";
import type { GeoHint } from "../data/geo-hint";
import type { ServiceArea } from "../data/returns-api";
import { isCountryCode } from "../data/countries";
import { NIGERIA, nigerianStateName } from "../data/nigerian-states";

/**
 * Filling the address in for the shopper — from the connection, and from the
 * device.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO SOURCES, TRUSTED DIFFERENTLY.
 *
 *   1. THE CONNECTION (`prefillFromGeoHint`). Cloudflare's placement of the
 *      IP, read on mount, silently. Right about the country nearly always
 *      and wrong about the state often enough on mobile that it is allowed
 *      to set the COUNTRY and nothing else — and only to a country the shop
 *      delivers to, because a diaspora shopper in London is more likely to be
 *      sending to Lagos than expecting delivery in London.
 *
 *   2. THE DEVICE (`reverseGeocode`). A GPS fix, asked for by a tap and
 *      turned into an address by OpenStreetMap's Nominatim. Accurate to the
 *      street, so it fills the state, the area, the city, the street and the
 *      postcode — and the button's copy tells the shopper to check every
 *      line, because the area sets the delivery price and a fix indoors can
 *      land a street over.
 *
 * NOMINATIM IS A PUBLIC SERVICE WITH A USAGE POLICY: one request a second,
 * no bulk, a Referer that identifies the site (the browser sends one), and
 * attribution on screen (`address-autofill-button.tsx` carries it). One call
 * per tap is well inside that. If the shop ever needs more, this is the one
 * function to point at a keyed provider.
 *
 * SPLIT FROM THE BUTTON so every decision here runs under Vitest with a
 * canned response and no Geolocation API.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

/** The request for one fix. `zoom=18` is building level; `jsonv2` carries
 *  `addressdetails` broken into named parts rather than one string. */
export function reverseGeocodeUrl(lat: number, lng: number): string {
  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");
  return url.toString();
}

export interface GeocodedAddress {
  /** The fields the fix could name. Absent keys are fields it could not —
   *  they are left as they were, never blanked. */
  patch: Partial<Address>;
  /** Every neighbourhood-sized name the fix carried, most specific first,
   *  for `suggestDistrict` to match against the served areas. */
  localities: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A Nominatim `reverse` body as the address patch it describes.
 *
 * NULL when the fix could not be turned into anything an address needs —
 * `{"error": "Unable to geocode"}` over open water, or a body with none of
 * the parts. A patch with only a country is still a patch: the shopper is
 * told to check it either way.
 *
 * THE STATE IS CANONICAL FOR NIGERIA. The ISO code (`ISO3166-2-lvl4`,
 * "NG-LA") is tried before the name, and both go through the states list so
 * what lands in the field is exactly the string the areas are filed under.
 * Anywhere else the state is the geocoder's own wording, because the field
 * there is free text.
 */
export function readReverseGeocode(body: unknown): GeocodedAddress | null {
  if (!isRecord(body) || !isRecord(body.address)) return null;
  const a = body.address;
  const s = (key: string): string | undefined =>
    typeof a[key] === "string" && (a[key] as string).trim() !== ""
      ? (a[key] as string).trim()
      : undefined;

  const rawCountry = s("country_code")?.toUpperCase();
  const countryCode = isCountryCode(rawCountry) ? rawCountry : undefined;

  const region =
    countryCode === NIGERIA
      ? (nigerianStateName(s("ISO3166-2-lvl4")) ??
        nigerianStateName(s("state")) ??
        nigerianStateName(s("state_district")) ??
        undefined)
      : (s("state") ?? s("province") ?? s("region") ?? s("county"));

  const city =
    s("city") ?? s("town") ?? s("village") ?? s("municipality") ?? s("city_district") ?? s("county");

  const houseAndRoad = [s("house_number"), s("road")].filter(Boolean).join(" ");
  const locality = s("suburb") ?? s("neighbourhood") ?? s("quarter") ?? s("residential") ?? s("hamlet");
  const line1 = [houseAndRoad, locality].filter(Boolean).join(", ");

  const postalCode = s("postcode");

  const patch: Partial<Address> = {};
  if (countryCode) patch.countryCode = countryCode;
  if (region) patch.region = region;
  if (city) patch.city = city;
  if (line1) patch.line1 = line1;
  if (postalCode) patch.postalCode = postalCode;
  if (Object.keys(patch).length === 0) return null;

  /* MOST SPECIFIC FIRST, and the LGA last: Lagos's served areas are its local
     government areas ("Eti-Osa", "Ikeja"), which Nominatim files under
     `county`, while Abuja's are districts it files under `suburb`. */
  const localities = [
    s("suburb"),
    s("neighbourhood"),
    s("quarter"),
    s("residential"),
    s("hamlet"),
    s("city_district"),
    s("town"),
    s("village"),
    s("county"),
    s("state_district"),
  ].filter((name): name is string => Boolean(name));

  return { patch, localities: [...new Set(localities)] };
}

/**
 * One fix, as an address — or null for every way that can fail.
 *
 * NEVER THROWS AND NEVER REJECTS. A geocoder having a bad day is exactly as
 * useful to the shopper as no geocoder, and the button says the same thing
 * for both: type it in.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodedAddress | null> {
  try {
    const res = await fetchImpl(reverseGeocodeUrl(lat, lng), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return readReverseGeocode(await res.json());
  } catch {
    return null;
  }
}

/** "Wuse II District", "wuse ii", "Wuse 2" — the same place. */
const foldArea = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+district$/, "")
    .replace(/\b2\b/g, "ii")
    .replace(/\b3\b/g, "iii")
    .trim();

/**
 * The served area a fix's neighbourhood names, when exactly one does.
 *
 * ONE MATCH OR NONE. The area sets the delivery price, so a guess between
 * "Wuse" and "Wuse II" is not made — the picker is left for the shopper,
 * whose attention the button's copy has already asked for. An exact name
 * wins over a prefix, so "Garki" chooses Garki and not Garki II.
 */
export function suggestDistrict(choices: ServiceArea[], localities: string[]): string | null {
  const named = choices
    .filter((area) => area.key)
    .map((area) => ({ key: area.key as string, name: foldArea(area.name) }));
  for (const locality of localities) {
    const target = foldArea(locality);
    if (!target) continue;
    const exact = named.filter((area) => area.name === target);
    if (exact.length === 1) return exact[0].key;
    if (exact.length > 1) return null;
    const loose = named.filter(
      (area) => area.name.startsWith(`${target} `) || target.startsWith(`${area.name} `),
    );
    if (loose.length === 1) return loose[0].key;
    if (loose.length > 1) return null;
  }
  return null;
}

/**
 * What the connection's hint may set: the country, if the shop delivers
 * there. Null otherwise, which leaves the config's default in place.
 */
export function prefillFromGeoHint(
  hint: GeoHint,
  config: DeliveryConfig,
): { countryCode: string } | null {
  if (!hint.country) return null;
  if (!config.country.allowed.includes(hint.country)) return null;
  return { countryCode: hint.country };
}
