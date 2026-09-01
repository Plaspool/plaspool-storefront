"use client";

import * as React from "react";
import { Button } from "@plaspool/ui";
import { Check, Loader2, MapPin } from "lucide-react";

import type { AddressLocation } from "../data/checkout-api";
import type { DeliveryConfig } from "../data/delivery-config";
import { isRough, readingFrom } from "./location-reading";

/**
 * "Use my current location" — the optional spot that helps a rider find the
 * door.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT IS NEVER REQUIRED AND NEVER BLOCKS. Asked once, "no" accepted silently,
 * and every failure path leaves the form exactly as it was. A permission
 * prompt standing between a shopper and a completed order would cost more
 * orders than a rider's saved walk is worth.
 *
 * IT DOES NOT PRICE ANYTHING. There is no geographic data in this system —
 * the service areas carry a name, a key and a region, with no coordinates or
 * boundaries — so nothing here can move the delivery total, and the copy says
 * so rather than leaving the shopper to wonder.
 *
 * RENDERED ONLY WHEN `config.location.offer` IS TRUE, which is also the gate
 * on sending the field at all — see `submittedAddress()`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

type Status =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "captured"; rough: boolean; accuracyM: number }
  | { kind: "refused" };

/** The browser's own default is "no timeout", which leaves the button
 *  spinning forever indoors. Fifteen seconds, then the form carries on. */
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

export function LocationCapture({
  config,
  value,
  onChange,
}: {
  config: DeliveryConfig;
  value: AddressLocation | undefined;
  onChange: (location: AddressLocation | undefined) => void;
}) {
  const [status, setStatus] = React.useState<Status>(() =>
    value ? { kind: "captured", rough: false, accuracyM: value.accuracyM } : { kind: "idle" },
  );

  const capture = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({ kind: "refused" });
      return;
    }
    setStatus({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const reading = readingFrom(position);
        onChange(reading);
        setStatus({ kind: "captured", rough: isRough(reading, config), accuracyM: reading.accuracyM });
      },
      () => {
        /* DENIED, UNAVAILABLE OR TIMED OUT — all one outcome here. The
           shopper does not need to know which, and the form works unchanged
           either way. Nothing is logged: a denied permission is a choice, not
           an error. */
        onChange(undefined);
        setStatus({ kind: "refused" });
      },
      GEOLOCATION_OPTIONS,
    );
  }, [config, onChange]);

  const clear = React.useCallback(() => {
    onChange(undefined);
    setStatus({ kind: "idle" });
  }, [onChange]);

  const label = config.location.label ?? "Use my current location";

  /**
   * THE ADDRESS IS THE TRUTH, NOT THIS COMPONENT'S STATE.
   *
   * Picking a saved address replaces the whole address, `location` included —
   * so a "Location saved" button left over from a capture against the
   * PREVIOUS address would be claiming a spot the shop no longer holds.
   * Derived during render rather than corrected by an effect, so there is no
   * committed render in which the button lies.
   */
  const shown: Status =
    value === undefined && status.kind === "captured" ? { kind: "idle" } : status;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={capture}
          disabled={shown.kind === "asking"}
          className="h-10"
        >
          {shown.kind === "asking" ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : shown.kind === "captured" ? (
            <Check aria-hidden="true" className="mr-2 h-4 w-4" />
          ) : (
            <MapPin aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {shown.kind === "captured" ? "Location saved" : label}
        </Button>
        {shown.kind === "captured" && (
          <Button type="button" variant="link" tone="none" onClick={clear} className="h-10 px-1">
            Remove
          </Button>
        )}
      </div>

      {/* The result is announced, because the button's own label is the only
          other thing that changes and a screen reader would not revisit it. */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {shown.kind === "captured"
          ? shown.rough
            ? `Saved, but it's rough — about ${shown.accuracyM}m out. Check the address above is right.`
            : "Saved. The rider will see this spot."
          : shown.kind === "refused"
            ? "We couldn't get your location. The address above is all we need."
            : (config.location.help ??
              "We'll save the spot so the rider can find you. It doesn't change your price.")}
      </p>
    </div>
  );
}
