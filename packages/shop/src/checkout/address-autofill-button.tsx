"use client";

import * as React from "react";
import { Button } from "@plaspool/ui";
import { Check, Loader2, MapPin } from "lucide-react";

import { reverseGeocode, type GeocodedAddress } from "./address-autofill";

/**
 * "Fill in from my location" — a tap that turns the device's fix into the
 * address, with the shopper told to check it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS NEVER REQUIRED AND NEVER BLOCKS — the same rules as the rider's
 * `LocationCapture`, for the same reason: a permission prompt standing
 * between a shopper and a completed order costs more orders than a saved
 * minute of typing is worth. Asked once, on a tap; "no" accepted silently;
 * every failure path leaves the form exactly as it was.
 *
 * WHAT IT FILLS IS DECIDED IN `address-autofill.ts`, not here. This file is a
 * permission prompt, a fetch and four sentences.
 *
 * ═══ THE SENTENCE AFTER A FILL IS THE FEATURE ═══
 * A fix indoors is routinely a street out, and the area it lands on sets the
 * delivery price. The copy therefore does not say "done"; it says check every
 * line. `aria-live` so a screen reader hears the same thing.
 *
 * ATTRIBUTION IS NOT OPTIONAL. The address comes from OpenStreetMap under the
 * ODbL, whose one condition on a site like this is a credit where the data is
 * shown.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Status =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "filled" }
  | { kind: "refused" }
  | { kind: "unplaced" };

/** The browser's own default is "no timeout", which leaves the button
 *  spinning forever indoors. Fifteen seconds, then the form carries on. */
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

export function AddressAutofill({
  onFill,
  disabled,
}: {
  /** The address the fix described, for the form to merge in. */
  onFill: (result: GeocodedAddress) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  const fill = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({ kind: "refused" });
      return;
    }
    setStatus({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void reverseGeocode(position.coords.latitude, position.coords.longitude).then((result) => {
          if (!result) {
            setStatus({ kind: "unplaced" });
            return;
          }
          onFill(result);
          setStatus({ kind: "filled" });
        });
      },
      () => {
        /* DENIED, UNAVAILABLE OR TIMED OUT — all one outcome here. The
           shopper does not need to know which, and the form works unchanged
           either way. Nothing is logged: a denied permission is a choice, not
           an error. */
        setStatus({ kind: "refused" });
      },
      GEOLOCATION_OPTIONS,
    );
  }, [onFill]);

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={fill}
          disabled={disabled || status.kind === "asking"}
          className="h-10"
        >
          {status.kind === "asking" ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : status.kind === "filled" ? (
            <Check aria-hidden="true" className="mr-2 h-4 w-4" />
          ) : (
            <MapPin aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {status.kind === "asking"
            ? "Finding your location…"
            : status.kind === "filled"
              ? "Fill in again from my location"
              : "Fill in from my location"}
        </Button>
      </div>

      {/* The result is announced, because the button's own label is the only
          other thing that changes and a screen reader would not revisit it. */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {status.kind === "filled" ? (
          <>
            <span className="font-medium text-foreground">
              Filled in from your location — please check every line before you continue.
            </span>{" "}
            A location can be a street or two out, and the area sets your delivery price.
            Address data © OpenStreetMap contributors.
          </>
        ) : status.kind === "refused" ? (
          "We couldn't get your location. Type the address in instead."
        ) : status.kind === "unplaced" ? (
          "We found your location but couldn't turn it into an address. Type it in instead."
        ) : (
          "We'll read the address from your device's location. You can change anything it gets wrong."
        )}
      </p>
    </div>
  );
}
