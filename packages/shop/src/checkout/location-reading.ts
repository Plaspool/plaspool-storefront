import type { AddressLocation } from "../data/checkout-api";
import type { DeliveryConfig } from "../data/delivery-config";

/**
 * A browser fix, as the address carries it.
 *
 * SPLIT FROM THE BUTTON so the arithmetic can be tested without a Geolocation
 * API — the button is a permission prompt and two callbacks, and none of the
 * decisions are in it.
 */

/** `coords.accuracy` is a float; the server's column is an integer metre. */
export function readingFrom(position: GeolocationPosition): AddressLocation {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyM: Math.round(position.coords.accuracy),
    source: "device",
    /* THE BROWSER'S TIMESTAMP, NOT `Date.now()`. A fix can be served from the
       device's cache and be minutes old; when it was taken is what tells a
       rider whether to trust it. */
    capturedAt: position.timestamp,
  };
}

/**
 * Whether to tell the shopper the fix is rough.
 *
 * A ROUGH READING IS KEPT, NEVER DISCARDED — a 2km fix still narrows a
 * rider's search, and throwing it away leaves them with nothing. The shopper
 * is told so they can correct the address text if they want to.
 */
export function isRough(reading: AddressLocation, config: DeliveryConfig): boolean {
  const max = config.location.maxAccuracyMeters;
  if (max === undefined) return false;
  return reading.accuracyM > max;
}
