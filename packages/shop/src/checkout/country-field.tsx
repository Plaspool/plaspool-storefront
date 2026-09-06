"use client";

import * as React from "react";

import { allCountries, countryName } from "../data/countries";
import type { DeliveryConfig } from "../data/delivery-config";
import { Field, NATIVE_SELECT_CLASSES } from "./address-field";

/**
 * The delivery country.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A SELECT OF EVERY COUNTRY; A SUBMIT ONLY TO THE SERVER'S.
 *
 * This used to render as fixed text while `country.locked` was true, on the
 * rule that the storefront never spells a country list. The list of ALL
 * countries is not that list — see `data/countries.ts` — and a real selector
 * is what lets the connection's hint and the GPS fill land on a value. What
 * is still the server's, entirely, is which of them a parcel may go to:
 * `config.country.allowed` heads the list under its own heading, and picking
 * anywhere else says so in a sentence and takes the Continue button away
 * (`isCountryServed`, read by the form's submit). Nothing outside `allowed`
 * can reach `PUT /checkout/addresses`, where it would price at the catch-all
 * zone and quote a fee nobody can honour.
 *
 * ═══ THE FULL LIST RENDERS AFTER HYDRATION, ON PURPOSE ═══
 * Names come from `Intl.DisplayNames`, and the server's ICU and the browser's
 * do not always agree on one — "Türkiye"/"Turkey" is enough for React to
 * refuse to hydrate the select. So the server renders only the current
 * choice, and the other 248 appear on the first client render, before a
 * shopper could open the menu.
 *
 * ═══ CHANGING IT CAN HIDE THE DISTRICT PICKER, AND THAT IS THE POINT ═══
 * Districts are Nigerian. `fieldRows` reads the address, so selecting
 * anywhere else removes the picker in the same render, and `submittedAddress`
 * omits the key from the body rather than sending an empty one.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const COUNTRY_FIELD_ID = "checkout-country";

/** Where the preselected country came from, for the sentence under it. */
export type CountryHint = "ip" | "gps";

/** Whether the shop delivers to a country — the gate on the submit. */
export function isCountryServed(config: DeliveryConfig, countryCode: string): boolean {
  const code = (countryCode || config.country.default).toUpperCase();
  return config.country.allowed.includes(code);
}

const subscribeToNothing = () => () => {};

/** A list of names joined the way a sentence wants them. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function CountryField({
  config,
  value,
  onChange,
  hint,
}: {
  config: DeliveryConfig;
  value: string;
  onChange: (countryCode: string) => void;
  /** Set when the value was chosen for the shopper rather than by them. */
  hint?: CountryHint | null;
}) {
  const hydrated = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const current = (value || config.country.default).toUpperCase();
  const served = isCountryServed(config, current);
  const allowed = config.country.allowed;

  const others = hydrated
    ? allCountries().filter((country) => !allowed.includes(country.code))
    : allowed.includes(current)
      ? []
      : [{ code: current, name: countryName(current) }];

  const helpId = `${COUNTRY_FIELD_ID}-note`;

  return (
    <Field id={COUNTRY_FIELD_ID} label="Country" required>
      <select
        id={COUNTRY_FIELD_ID}
        required
        autoComplete="country"
        value={current}
        aria-describedby={helpId}
        aria-invalid={served ? undefined : true}
        onChange={(e) => onChange(e.target.value)}
        className={NATIVE_SELECT_CLASSES}
      >
        <optgroup label="We deliver to">
          {allowed.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </optgroup>
        {others.length > 0 && (
          <optgroup label="Everywhere else">
            {others.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {/* One sentence, and it changes with the value, so it is announced. */}
      <p id={helpId} aria-live="polite" className="text-xs text-muted-foreground">
        {!served
          ? `We don't deliver to ${countryName(current)} yet — only to ${joinNames(allowed.map(countryName))}. Choose one of those to continue.`
          : hint
            ? `We set this to ${countryName(current)} from your ${hint === "gps" ? "location" : "connection"}. Change it if you're sending somewhere else.`
            : null}
      </p>
    </Field>
  );
}
