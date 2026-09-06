import type { Address } from "../data/checkout-api";
import type { DeliveryConfig, DeliveryField, FieldKey } from "../data/delivery-config";
import type { ServiceArea } from "../data/returns-api";
import { matchNigerianState, nigerianStateName } from "../data/nigerian-states";

/**
 * What the address step renders, and what it submits.
 *
 * SPLIT OUT OF `checkout-flow.tsx` so it can be tested without mounting a
 * client component — the same reason `saved-address.ts` exists, and the same
 * kind of content: this is the part with the actual decisions in it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE CONFIG DECIDES THE FORM; THESE FUNCTIONS DECIDE THE TWO THINGS A FLAT
 * `fields[]` ARRAY CANNOT SAY.
 *
 *   1. A district picker is not rendered when it would have no options —
 *      whatever the config says about `required`. The config describes the
 *      shop's policy; the areas list decides whether that policy has anything
 *      to offer THIS shopper, and a required select with nothing in it is a
 *      dead control that blocks checkout.
 *
 *   2. City and State sit side by side. They do on screen today, a flat list
 *      would stack them, and a shopper must not be able to tell the config
 *      exists when the switch is off.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Case- and space-insensitive: "lagos" must find the areas filed under
 *  "Lagos". Foreign states, and the odd Nigerian one nothing recognises, are
 *  compared this way. */
const normRegion = (value: string) => value.trim().toLowerCase();

/**
 * Whether two region strings name the same place.
 *
 * BY STATE WHERE BOTH ARE NIGERIAN STATES, so "FCT", "Abuja" and "Federal
 * Capital Territory" are one region however the areas list or a saved address
 * spells it; by folded text otherwise. The select stores the canonical name,
 * but a snapshot from before it existed does not.
 */
function sameRegion(a: string, b: string): boolean {
  const stateA = matchNigerianState(a);
  const stateB = matchNigerianState(b);
  if (stateA && stateB) return stateA.code === stateB.code;
  return normRegion(a) === normRegion(b);
}

/**
 * The districts filed under the State — the picker's options.
 *
 * An area with no `key` is dropped: the key is the handle a rename does not
 * move and the only thing the checkout may submit, so an area without one
 * could never be chosen. (The field is optional on the wire because that
 * response is ISR-cached and a copy rendered before the API gained it is
 * still being served somewhere.)
 */
export function districtChoicesFor(
  areas: ServiceArea[],
  region: string | null | undefined,
): ServiceArea[] {
  const target = region ?? "";
  if (!normRegion(target)) return [];
  return areas.filter((area) => area.key && sameRegion(area.region, target));
}

/**
 * The state as the body carries it.
 *
 * THE CANONICAL NAME FOR A NIGERIAN ADDRESS — what the select shows — and the
 * text as typed anywhere else, where the field is free text. The server's
 * `zoneFor` and `servesRegion` compare folded strings, so "Lagos State" from
 * an old snapshot would miss a zone named "Lagos"; the select never produces
 * that, and this makes sure a snapshot cannot either.
 */
export function canonicalRegion(address: Address, config: DeliveryConfig): string | null {
  const region = address.region ?? null;
  if (!region) return region;
  return districtsApply(address, config) ? (nigerianStateName(region) ?? region) : region;
}

/**
 * Whether the checkout should fetch the public areas list at all.
 *
 * §6.1 — under `simple` there is no picker, so the round trip buys nothing.
 * Also false in district mode if the config has hidden the field, which is a
 * shop that has areas configured but is not asking about them.
 */
export function wantsServiceAreas(config: DeliveryConfig): boolean {
  return (
    config.mode === "district" &&
    config.fields.some((field) => field.key === "district" && field.show)
  );
}

/**
 * The one country districts exist for.
 *
 * ═══ DISTRICTS ARE A NIGERIAN CONCEPT, NOT A GENERIC ADDRESS FIELD ═══
 * The served-areas list is Abuja and Lagos districts priced at Nigerian zone
 * rates. Shown to somebody entering a London address it is a picker with
 * nothing in it that could be right — and worse, a leftover key from a
 * previous Nigerian address would ride the submit and price an international
 * parcel at a Maitama rate.
 *
 * A CONSTANT AND NOT A CONFIG FIELD, because the delivery config does not
 * carry one. `districts.source` names the endpoint, not the country it applies
 * to. When the admin grows a country scope for districts this becomes a read
 * of it; until then the storefront must not send a district for an address
 * that is not in Nigeria, and this is the honest way to say so.
 */
const DISTRICT_COUNTRY = "NG";

/**
 * Whether districts apply to the address as it currently stands.
 *
 * `countryCode` may legitimately be empty while a shopper is mid-form, which
 * is the config's default country — the same fallback `submittedAddress` uses
 * to build `countryCode`, so the picker and the payload cannot disagree about
 * which country they are describing.
 */
export function districtsApply(address: Address, config: DeliveryConfig): boolean {
  const country = (address.countryCode || config.country.default).toUpperCase();
  return country === DISTRICT_COUNTRY;
}

const PAIRED: ReadonlyArray<readonly [DeliveryField["key"], DeliveryField["key"]]> = [
  ["city", "region"],
  ["region", "city"],
];

const isPair = (a: DeliveryField, b: DeliveryField) =>
  PAIRED.some(([first, second]) => a.key === first && b.key === second);

/**
 * The visible fields, in the server's order, grouped into rows.
 *
 * ORDER IS THE ARRAY'S ORDER (§5.1) — never sorted, never re-grouped beyond
 * the one pairing above, which holds in both modes because City and State are
 * adjacent in each (in opposite orders, which is why `PAIRED` lists both).
 */
export function fieldRows(
  config: DeliveryConfig,
  districtChoices: ServiceArea[],
  /* The address as it stands, so the district row can disappear the moment the
     shopper picks a country it does not apply to. OPTIONAL so the existing
     callers and the package's own tests keep their two-argument shape and
     their current behaviour — an omitted address is read as "the config's
     default country", which is Nigeria today. */
  address?: Address,
): DeliveryField[][] {
  const districtsOff = address ? !districtsApply(address, config) : false;
  const visible = config.fields.filter(
    (field) =>
      field.show &&
      // See the header: never a picker with nothing in it, whatever `required`
      // says. This is the rule `checkout-flow.tsx` already followed by hand.
      !(field.key === "district" && districtChoices.length === 0) &&
      // AND NEVER OUTSIDE NIGERIA. A district picker over a London address
      // offers nothing that could be right — see `DISTRICT_COUNTRY`.
      !(field.key === "district" && districtsOff),
  );

  const rows: DeliveryField[][] = [];
  for (let i = 0; i < visible.length; i += 1) {
    const field = visible[i];
    const next = visible[i + 1];
    if (next && isPair(field, next)) {
      rows.push([field, next]);
      i += 1;
    } else {
      rows.push([field]);
    }
  }
  return rows;
}

/**
 * The district that actually goes on the address.
 *
 * THE MODE DECIDES FIRST (§7). Under `simple` this is always null, however the
 * address came by one — a saved address captured before the switch flipped
 * still carries the key it was placed with, and letting that price a new order
 * is how a shopper watches the number move after they have seen it.
 *
 * Under `district` the stale guard applies, and it only applies ONCE THE AREAS
 * HAVE LOADED: an empty list is the fetch failing, not the district being
 * wrong, and stripping a saved address's district because the network hiccuped
 * would quietly change its price.
 */
export function effectiveDistrict(
  address: Address,
  config: DeliveryConfig,
  areas: ServiceArea[],
  districtChoices: ServiceArea[],
): string | null {
  if (config.mode !== "district") return null;
  if (!address.district) return null;
  if (areas.length === 0) return address.district;
  return districtChoices.some((area) => area.key === address.district)
    ? address.district
    : null;
}

/**
 * The body `PUT /checkout/addresses` receives.
 *
 * HIDDEN FIELDS ARE OMITTED, NOT SENT AS `""` (§5.2). `district` and
 * `postalCode` are both `.nullable().optional()` server-side, so absent is
 * legal and means "no opinion, price at the state's rate". An empty string is
 * an opinion, and the wrong one.
 *
 * SHOWN-BUT-EMPTY IS NOT HIDDEN. A blank optional field the shopper simply did
 * not fill in still goes as `""`, exactly as it does today.
 *
 * `name`, `line1`, `city` and `countryCode` GO REGARDLESS. The API's
 * `assertAddress` requires all four; a config hiding one describes an address
 * that cannot be submitted, and honouring it would turn a bad config into a
 * checkout the shopper cannot complete.
 */
export function submittedAddress(
  address: Address,
  config: DeliveryConfig,
  areas: ServiceArea[],
): Address {
  const shown = new Set(config.fields.filter((field) => field.show).map((field) => field.key));
  const choices = districtChoicesFor(areas, address.region);

  const body: Address = {
    name: address.name,
    line1: address.line1,
    city: address.city,
    /* §5.4 — always two uppercase letters. The server regex-refuses anything
       else, and a lowercase code would silently fall into the catch-all zone
       and price wrong rather than erroring. */
    countryCode: (address.countryCode || config.country.default).toUpperCase(),
  };

  if (shown.has("phone")) body.phone = address.phone ?? null;
  if (shown.has("line2")) body.line2 = address.line2 ?? null;
  if (shown.has("region")) body.region = canonicalRegion(address, config);
  if (shown.has("postalCode")) body.postalCode = address.postalCode ?? null;
  /* ═══ OMITTED, NOT SENT AS `null`, WHEN THE COUNTRY IS NOT NIGERIA ═══
     The field is not on screen for such an address (see `fieldRows`), and the
     rule this whole function follows is that a hidden field is absent from the
     body rather than present and empty. It also matters more here than
     elsewhere: a district key left over from a previous Nigerian address would
     otherwise ride an international submit and price the parcel at an Abuja
     zone rate. */
  if (shown.has("district") && districtsApply(address, config)) {
    body.district = effectiveDistrict(address, config, areas, choices);
  }

  /* THE GATE (§8). `AddressesBody` is `.strict()`, so a `location` sent to a
     server that has not shipped the column is a 400 with no useful message.
     The config is the feature flag for the wire shape — a server old enough
     to refuse the field is also old enough never to say `offer: true`. */
  if (config.location.offer && address.location) body.location = address.location;

  return body;
}

/**
 * One field's current value, as a controlled input wants it.
 *
 * A SWITCH RATHER THAN `address[key]`, and that is the point. The renderer is
 * a loop over the config's fields, so the alternative is an index signature
 * and a cast — which is exactly where a field silently starts editing the
 * wrong property, with nothing to catch it. Here the compiler proves every
 * key is handled and handled once.
 *
 * `district` READS THE EFFECTIVE KEY, not the raw one, so an orphaned key
 * sitting in state renders as "none chosen" — what is on screen is what is
 * submitted.
 *
 * NEVER `null`: a controlled input handed null warns and goes uncontrolled.
 */
export function fieldValue(address: Address, key: FieldKey, district: string | null): string {
  switch (key) {
    case "name":
      return address.name;
    case "phone":
      return address.phone ?? "";
    case "line1":
      return address.line1;
    case "line2":
      return address.line2 ?? "";
    case "city":
      return address.city;
    case "region":
      return address.region ?? "";
    case "postalCode":
      return address.postalCode ?? "";
    case "district":
      return district ?? "";
  }
}

/** The patch one field's edit makes. See `fieldValue` for why this is a
 *  switch. */
export function fieldPatch(key: FieldKey, value: string): Partial<Address> {
  switch (key) {
    case "name":
      return { name: value };
    case "phone":
      return { phone: value };
    case "line1":
      return { line1: value };
    case "line2":
      return { line2: value };
    case "city":
      return { city: value };
    case "region":
      return { region: value };
    case "postalCode":
      return { postalCode: value };
    case "district":
      /* `null`, not `""`. A district is a KEY the picker chose, and "none" is
         the absence of one rather than an empty string the API would store as
         if it were an opinion. */
      return { district: value || null };
  }
}
