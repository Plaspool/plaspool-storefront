import type { Address } from "../data/checkout-api";
import type { SavedAddress } from "../data/orders-api";

/**
 * Reading an address the shop has already shipped to, for the checkout's
 * address step.
 *
 * SPLIT OUT OF `checkout-flow.tsx` so it can be tested without mounting a
 * client component. This is the part with the actual decisions in it, and every
 * one of them is about not trusting the input.
 */

/** This shop ships from and mostly to Nigeria; the country field is not asked
 *  for, so every address defaults here. */
export const NIGERIA = "NG";

/** The radio value for "not one of my saved ones". */
export const NEW_ADDRESS = "new";

export const keyOfSaved = (i: number) => `saved-${i}`;

export const BLANK_ADDRESS: Address = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: NIGERIA,
  phone: "",
  /* `null` rather than `""` like the text fields above: a district is a KEY
     the picker chose, and "none chosen" is the absence of one, not an empty
     string the API would store as if it were an opinion. */
  district: null,
};

/**
 * A saved address, read defensively into the shape the form edits.
 *
 * IT ARRIVES AS AN ORDER'S SNAPSHOT — `Record<string, unknown>`, the same
 * untyped jsonb the order detail page reads — so every field is checked rather
 * than assumed.
 *
 * AN ENTRY MISSING WHAT THIS FORM REQUIRES IS DROPPED, NOT OFFERED. A
 * selectable address that fails validation the moment it is submitted is worse
 * than one fewer choice: the shopper picked the thing the shop showed them, and
 * the error that follows is the shop's fault and reads as their mistake.
 *
 * ═══ "WHAT THIS FORM REQUIRES", NOT "WHAT THE API REQUIRES" ═══
 * These were different, and the gap was a live defect. The API's `assertAddress`
 * wants name, line1, city and countryCode; the checkout ALSO marks State
 * (`co-region`) required, and `shop_addresses.region` is nullable — so a
 * snapshot from a checkout that predates that field passed this reader, was
 * offered, was preselected, filled the form, and then refused to submit with a
 * native "Please fill out this field" on a field the shopper never touched.
 * The stricter of the two rules is the one that decides what may be offered.
 */
export function readSavedAddress(saved: SavedAddress): Address | null {
  const raw = saved.address ?? {};
  const str = (key: string): string | undefined =>
    typeof raw[key] === "string" && raw[key] !== "" ? (raw[key] as string) : undefined;

  const name = str("name");
  const line1 = str("line1");
  const city = str("city");
  const region = str("region");
  if (!name || !line1 || !city || !region) return null;

  return {
    name,
    line1,
    line2: str("line2") ?? "",
    city,
    region,
    postalCode: str("postalCode") ?? "",
    /* THE COUNTRY CODE IS NOT COSMETIC. The API derives the shipping zone — and
       therefore the tax rate — from it, and refuses anything that is not an
       uppercase alpha-2, so a lowercase or absent code would silently pick the
       fallback zone. Defaulted to this shop's country rather than to whatever
       the snapshot happens to hold. */
    countryCode: (str("countryCode") ?? NIGERIA).toUpperCase(),
    phone: str("phone") ?? "",
    /* Snapshots written since the district picker existed carry the key the
       shopper chose; older ones simply lack it. Either way it rides along —
       the checkout's own stale-district guard drops a key the public areas
       list no longer offers, so a district deactivated since the last order
       cannot be resubmitted silently. */
    district: str("district") ?? null,
  };
}
