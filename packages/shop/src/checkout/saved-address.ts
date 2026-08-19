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
};

/**
 * A saved address, read defensively into the shape the form edits.
 *
 * IT ARRIVES AS AN ORDER'S SNAPSHOT — `Record<string, unknown>`, the same
 * untyped jsonb the order detail page reads — so every field is checked rather
 * than assumed.
 *
 * AN ENTRY MISSING WHAT THE API REQUIRES IS DROPPED, NOT OFFERED. A selectable
 * address that fails validation the moment it is submitted is worse than one
 * fewer choice: the shopper picked the thing the shop showed them, and the
 * error that follows is the shop's fault and reads as their mistake.
 */
export function readSavedAddress(saved: SavedAddress): Address | null {
  const raw = saved.address ?? {};
  const str = (key: string): string | undefined =>
    typeof raw[key] === "string" && raw[key] !== "" ? (raw[key] as string) : undefined;

  const name = str("name");
  const line1 = str("line1");
  const city = str("city");
  if (!name || !line1 || !city) return null;

  return {
    name,
    line1,
    line2: str("line2") ?? "",
    city,
    region: str("region") ?? "",
    postalCode: str("postalCode") ?? "",
    /* THE COUNTRY CODE IS NOT COSMETIC. The API derives the shipping zone — and
       therefore the tax rate — from it, and refuses anything that is not an
       uppercase alpha-2, so a lowercase or absent code would silently pick the
       fallback zone. Defaulted to this shop's country rather than to whatever
       the snapshot happens to hold. */
    countryCode: (str("countryCode") ?? NIGERIA).toUpperCase(),
    phone: str("phone") ?? "",
  };
}
